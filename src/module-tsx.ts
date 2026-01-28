import type ts from "typescript";
import { ModuleTSXError } from "./error.ts";
import { parseImportMaps, resolveFromImportMap, type ImportMapData } from "./importmap.ts";
import { cssLoader, cssModuleLoader, type Loader } from "./loader.ts";
import { fetchText } from "./network.ts";
import {
  collectSpecifiers,
  createRewriteImportTransformer,
  isBareSpecifier,
  isRelativeSpecifier,
} from "./specifier.ts";
import { addReactImport, needsReactImport } from "./react.ts";
import { createSourceFile, printSourceFile, transform } from "./ts.ts";

export class ModuleTSX {
  private readonly baseUrl: string;
  private readonly fetchCode: (url: string) => Promise<string>;
  private readonly importMap: ImportMapData;
  constructor(config?: {
    baseUrl?: string;
    fetchCode?: (fullURL: string) => Promise<string>;
    importMap?: ImportMapData;
  }) {
    this.baseUrl = config?.baseUrl ?? location.href;
    this.fetchCode = config?.fetchCode ?? fetchText;
    this.importMap = config?.importMap ?? parseImportMaps();
  }
  public async import(id: string, options?: any): Promise<any> {
    if (isBareSpecifier(id)) {
      const mappedSpecifier = resolveFromImportMap(id, this.importMap, this.baseUrl);
      if (mappedSpecifier) {
        id = mappedSpecifier;
      } else {
        id = new URL(id, "https://esm.sh/").href;
      }
    }
    const url = isRelativeSpecifier(id) ? new URL(id, this.baseUrl).href : id;
    const code = await this.fetchCode(url);
    return this.importCode(url, code, options);
  }

  public async importCode(sourceUrl: string, code: string, options?: any): Promise<any> {
    const transformedUrl = await this.transformSourceModule("esm", sourceUrl, code);
    return import(transformedUrl, options);
  }

  /** Transform module source code and return a blob URL with the transformed content */
  private async transformSourceModule(sourceType: ResourceType, sourceUrl: string, sourceCode: string) {
    if (this._sourceMap.has(sourceUrl)) {
      return this._sourceMap.get(sourceUrl)!;
    }
    const loader = this.getLoaderByResourceType(sourceType);
    const code = `import.meta.url=${JSON.stringify(sourceUrl)};\n` + (await loader(sourceUrl, sourceCode));
    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    this._track(sourceUrl, blobUrl);
    return blobUrl;
  }

  private getLoaderByResourceType(type: ResourceType): Loader {
    switch (type) {
      case "css":
        return cssLoader;
      case "css-module":
        return cssModuleLoader;
      case "esm":
        // Built-in loader for ES modules
        return this.tsxLoader.bind(this);
      default:
        throw new ModuleTSXError(`Unsupported resource type: ${type}`);
    }
  }

  private async tsxLoader(sourceUrl: string, sourceCode: string): Promise<string> {
    const sourceFile = createSourceFile(sourceCode, getFileName(sourceUrl));

    const specifiers = collectSpecifiers(sourceFile);
    // Collect and resolve all specifiers
    const rewrittenSpecifiers = await this.resolveSpecifiers(specifiers, sourceUrl);

    let workingSourceFile = sourceFile;
    if (needsReactImport(workingSourceFile)) {
      workingSourceFile = addReactImport(workingSourceFile);
    }

    const transformers: ts.TransformerFactory<ts.SourceFile>[] = [createRewriteImportTransformer(rewrittenSpecifiers)];
    const transformedFile = transform(workingSourceFile, transformers);
    return printSourceFile(transformedFile);
  }

  private async resolveSpecifier(specifier: string, sourceUrl: string): Promise<string> {
    const mappedSpecifier = resolveFromImportMap(specifier, this.importMap, sourceUrl);
    if (mappedSpecifier) {
      return mappedSpecifier;
    }

    if (isRelativeSpecifier(specifier)) {
      const targetUrl = new URL(specifier, sourceUrl);

      if (targetUrl.pathname.endsWith(".module.css")) {
        const cssCode = await this.fetchCode(targetUrl.href);
        const blobUrl = await this.transformSourceModule("css-module", targetUrl.href, cssCode);
        return blobUrl;
      } else if (targetUrl.pathname.endsWith(".css")) {
        const blobUrl = await this.transformSourceModule("css", targetUrl.href, "");
        return blobUrl;
      } else if (targetUrl.pathname.endsWith(".wasm")) {
        // wasm will be handled natively by the browser
        // so we just return the original full URL
        return targetUrl.href;
      } else {
        const childCode = await this.fetchCode(targetUrl.href);
        const blobUrl = await this.transformSourceModule("esm", targetUrl.href, childCode);
        //! ^ Recursive call
        return blobUrl;
      }
    } else if (specifier.startsWith("npm:")) {
      return `https://esm.sh/${specifier.slice(4)}`;
    } else if (specifier.startsWith("node:")) {
      return `https://raw.esm.sh/@jspm/core/nodelibs/browser/${specifier.slice(5)}.js`;
    } else if (isBareSpecifier(specifier)) {
      return new URL(specifier, "https://esm.sh/").href;
    } else {
      // Fallback: return the original specifier
      return specifier;
    }
  }

  private async resolveSpecifiers(specifiers: Set<string>, sourceUrl: string): Promise<Map<string, string>> {
    const resolved = new Map<string, string>();

    const tasks = Array.from(specifiers).map(async (specifier) => {
      const specifier2 = await this.resolveSpecifier(specifier, sourceUrl);
      if (specifier !== specifier2) {
        resolved.set(specifier, specifier2);
      }
    });

    await Promise.all(tasks);
    return resolved;
  }

  private _sourceMap: Map<string, string> = new Map<string, string>();
  private _blobMap: Map<string, string> = new Map<string, string>();
  private _track(sourceUrl: string, blobUrl: string) {
    this._sourceMap.set(sourceUrl, blobUrl);
    this._blobMap.set(blobUrl, sourceUrl);
  }
}

type ResourceType = "esm" | "css" | "css-module";

function getFileName(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).pathname;
  } catch {
    return "temp.tsx";
  }
}

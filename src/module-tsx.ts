import type ts from "typescript";
import { ModuleTSXError } from "./error.ts";
import { parseImportMaps, resolveFromImportMap, type ImportMapData } from "./importmap.ts";
import { cssLoader, cssModuleLoader, type Loader } from "./loader.ts";
import { fetchResponse } from "./network.ts";
import {
  collectSpecifiers,
  createRewriteImportTransformer,
  isBareSpecifier,
  isRelativeSpecifier,
} from "./specifier.ts";
import { addReactImport, needsReactImport } from "./react.ts";
import { createSourceFile, printSourceFile, transform } from "./ts.ts";

export class ModuleTSX extends EventTarget {
  public readonly baseUrl: string;
  public readonly importMap: ImportMapData;
  public readonly fetch: (url: string) => Promise<Response>;
  private readonly fetchText = async (url: string) => {
    return this.fetch(url).then((res) => res.text());
  };

  constructor(config?: {
    baseUrl?: string;
    /** A simplified fetch function, since we do not need pass any header or other options */
    fetch?: (fullURL: string) => Promise<Response>;
    importMap?: ImportMapData;
    cssStrategy?: "style" | "link";
  }) {
    super();
    this.baseUrl = config?.baseUrl ?? location.href;
    this.importMap = config?.importMap ?? parseImportMaps();
    this.fetch = config?.fetch ?? fetchResponse;
  }

  private emit(type: string, detail?: any) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
    this.dispatchEvent(
      new CustomEvent("*", {
        detail: {
          type,
          payload: detail,
        },
      }),
    );
  }

  public async import(id: string, options?: any): Promise<any> {
    this.emit("import", { id });
    try {
      if (isBareSpecifier(id)) {
        const mappedSpecifier = resolveFromImportMap(id, this.importMap, this.baseUrl);
        if (mappedSpecifier) {
          id = mappedSpecifier;
        } else {
          id = new URL(id, "https://esm.sh/").href;
        }
      }
      const url = isRelativeSpecifier(id) ? new URL(id, this.baseUrl).href : id;
      const code = await this.fetchText(url);
      return this.importCode(url, code, options);
    } catch (error) {
      this.emit("import:error", { id, error });
      throw error;
    }
  }

  public async importCode(sourceUrl: string, code: string, options?: any): Promise<any> {
    const transformedUrl = await this.transformSourceModule("esm", sourceUrl, code);
    const module = await import(transformedUrl, options);
    return module;
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
        // return this.cssStrategy === "link" ? cssLinkLoader : cssLoader;
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
    this.emit("transform", { sourceUrl });

    try {
      const sourceFile = createSourceFile(sourceCode, getFileName(sourceUrl));
      const specifiers = collectSpecifiers(sourceFile);
      // Collect and resolve all specifiers
      const rewrittenSpecifiers = await this.resolveSpecifiers(specifiers, sourceUrl);

      let workingSourceFile = sourceFile;
      if (needsReactImport(workingSourceFile)) {
        workingSourceFile = addReactImport(workingSourceFile);
      }

      const transformers: ts.TransformerFactory<ts.SourceFile>[] = [
        createRewriteImportTransformer(rewrittenSpecifiers),
      ];
      const transformedFile = transform(workingSourceFile, transformers);
      return printSourceFile(transformedFile);
    } catch (error) {
      this.emit("transform:error", { sourceUrl, error });
      throw error;
    }
  }

  private async resolveSpecifier(specifier: string, sourceUrl: string): Promise<string> {
    const mappedSpecifier = resolveFromImportMap(specifier, this.importMap, sourceUrl);
    if (mappedSpecifier) {
      return mappedSpecifier;
    }
    const getCssUrl = async (fullURL: string) => {
      // const code = this.cssStrategy === "link" ? "" : await this.fetchCode(url);
      return await this.transformSourceModule("css", fullURL, await this.fetchText(fullURL));
    };
    const toEsmSh = (specifier: string) => {
      // this avoid we accidentally convert a package named xxx.css to a css file on esm.sh
      const subpath = specifier.startsWith("@")
        ? // @scope/pkg/subpath -> /subpath
          specifier.split("/").slice(2).join("/")
        : // pkg/subpath -> /subpath
          specifier.split("/").slice(1).join("/");

      const url = `https://esm.sh/${specifier}`;
      if (subpath.endsWith(".css")) {
        return getCssUrl(url);
      }
      return url;
    };

    if (isRelativeSpecifier(specifier)) {
      const targetUrl = new URL(specifier, sourceUrl);
      // local file, we fetch and transform it, then return the blob URL
      if (targetUrl.pathname.endsWith(".module.css")) {
        const blobUrl = await this.transformSourceModule(
          "css-module",
          targetUrl.href,
          await this.fetchText(targetUrl.href),
        );
        return blobUrl;
      } else if (targetUrl.pathname.endsWith(".css")) {
        return getCssUrl(targetUrl.href);
      } else if (targetUrl.pathname.endsWith(".wasm")) {
        // wasm will be handled natively by the browser
        // so we just return the original full URL
        return targetUrl.href;
      } else {
        const blobUrl = await this.transformSourceModule("esm", targetUrl.href, await this.fetchText(targetUrl.href));
        //! ^ transformSourceModule is recursive ^
        return blobUrl;
      }
    } else if (specifier.startsWith("node:")) {
      return `https://raw.esm.sh/@jspm/core/nodelibs/browser/${specifier.slice(5)}.js`;
    } else if (specifier.startsWith("npm:")) {
      return toEsmSh(specifier.slice(4));
    } else if (isBareSpecifier(specifier)) {
      return toEsmSh(specifier);
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

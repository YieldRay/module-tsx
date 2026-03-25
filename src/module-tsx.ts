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
import { SourceTransformTracker } from "./source-tracker.ts";
import { createSourceFile, printSourceFile, transform } from "./ts.ts";

interface ModuleTSXConfig {
  /**
   * The base URL to resolve relative module specifiers.
   * This is typically the URL of the main script or the HTML page.
   */
  baseUrl?: string;
  fetch?: (fullURL: string) => Promise<Response>;
  importMap?: ImportMapData;
  // cssStrategy?: "style" | "link";
  /**
   * Given a bare specifier, return a full URL to load the module.
   * This can be used to convert for example import "react" to import "https://esm.sh/react".
   * If not provided, it will default to using "https://esm.sh/" as the base URL for bare specifiers.
   * @default "https://esm.sh/"
   */
  resolveBareSpecifier?: string | ((specifier: string) => string | Promise<string>);
}

interface ModuleTSXEventMap {
  import: CustomEvent<{ id: string }>;
  "import:error": CustomEvent<{ id: string; error: any }>;
  transform: CustomEvent<{ sourceUrl: string }>;
  "transform:error": CustomEvent<{ sourceUrl: string; error: any }>;
}

interface IModuleTSX extends EventTarget {
  addEventListener<T extends keyof ModuleTSXEventMap>(
    type: T,
    listener: (this: ModuleTSX, ev: ModuleTSXEventMap[T]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

export class ModuleTSX extends EventTarget implements IModuleTSX {
  public readonly baseUrl: string;
  public readonly importMap: ImportMapData;
  public readonly fetch: (url: string) => Promise<Response>;
  public readonly resolveBareSpecifier?: string | ((specifier: string) => string | Promise<string>);
  private readonly sourceTracker = new SourceTransformTracker<ResourceType>();
  private readonly fetchText = async (url: string) => {
    return this.fetch(url).then((res) => res.text());
  };

  constructor(config?: ModuleTSXConfig) {
    super();
    this.baseUrl = config?.baseUrl ?? location.href;
    this.importMap = config?.importMap ?? parseImportMaps();
    this.fetch = config?.fetch ?? fetchResponse;
    this.resolveBareSpecifier = config?.resolveBareSpecifier;
  }

  private emit<T extends keyof ModuleTSXEventMap>(type: T, detail?: ModuleTSXEventMap[T]["detail"]) {
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
          if (typeof this.resolveBareSpecifier === "function") {
            id = await this.resolveBareSpecifier(id);
          } else {
            id = (this.resolveBareSpecifier ?? "https://esm.sh/") + id;
          }
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
    const cachedBlobUrl = this.sourceTracker.get(sourceType, sourceUrl);
    if (cachedBlobUrl) {
      return cachedBlobUrl;
    }

    return this.sourceTracker.runWithDedup(sourceType, sourceUrl, async () => {
      const loader = this.getLoaderByResourceType(sourceType);
      const code = `import.meta.url=${JSON.stringify(sourceUrl)};\n` + (await loader(sourceUrl, sourceCode));
      const blob = new Blob([code], { type: "text/javascript" });
      const blobUrl = URL.createObjectURL(blob);
      this.sourceTracker.set(sourceType, sourceUrl, blobUrl);
      return blobUrl;
    });
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
        // If this URL is already being transformed (circular import), return the raw URL.
        // The browser handles circular ESM natively; we just need to avoid deadlocking.
        if (this.sourceTracker.isInFlight("esm", targetUrl.href)) {
          return targetUrl.href;
        }
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
}

type ResourceType = "esm" | "css" | "css-module";

function getFileName(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).pathname;
  } catch {
    return "temp.tsx";
  }
}

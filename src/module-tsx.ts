import type ts from "typescript";
import { ModuleTSXError } from "./error.ts";
import { ImportMap, type SpecifierResolutionRecord } from "./import-map.ts";
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
  importMap?: ImportMap;
  // cssStrategy?: "style" | "link";
  /**
   * Given a bare specifier, return a full URL to load the module.
   * This can be used to convert for example import "react" to import "https://esm.sh/react".
   * If not provided, it will default to using "https://esm.sh/" as the base URL for bare specifiers.
   * @default "https://esm.sh/"
   */
  resolveBareSpecifier?: string | ((specifier: string) => string);
}

interface ModuleTSXEventMap {
  /** Fired when an import starts. `id` is the original specifier as passed by the caller. */
  import: CustomEvent<{ id: string }>;
  /** Fired when an import fails. `id` is the specifier at the point of failure. */
  "import:error": CustomEvent<{ id: string; error: any }>;
  /** Fired when a source file starts being transpiled. */
  transform: CustomEvent<{ sourceUrl: string }>;
  /** Fired when transpilation fails. */
  "transform:error": CustomEvent<{ sourceUrl: string; error: any }>;
}

interface IModuleTSX extends EventTarget {
  addEventListener<T extends keyof ModuleTSXEventMap>(
    type: T,
    listener: (this: ModuleTSX, ev: ModuleTSXEventMap[T]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

export class ModuleTSX extends EventTarget implements IModuleTSX {
  public readonly baseUrl: string;
  public readonly importMap: ImportMap;
  public readonly fetch: (url: string) => Promise<Response>;
  public readonly resolveBareSpecifier: (specifier: string) => string;
  private readonly resolvedModuleSet: SpecifierResolutionRecord[] = [];
  private readonly sourceTracker = new SourceTransformTracker<ResourceType>();
  private readonly fetchText = async (url: string) => {
    return this.fetch(url).then((res) => res.text());
  };

  constructor(config?: ModuleTSXConfig) {
    super();
    this.baseUrl = config?.baseUrl ?? location.href;
    this.importMap = config?.importMap ?? new ImportMap();
    this.fetch = config?.fetch ?? fetchResponse;
    this.resolveBareSpecifier =
      typeof config?.resolveBareSpecifier === "function"
        ? config?.resolveBareSpecifier
        : (specifier: string) =>
            (config?.resolveBareSpecifier ?? "https://esm.sh/") + specifier;
  }

  /** Add a new import map, merging it into the existing one per the spec.
   *  Rules that conflict with already-resolved modules are silently dropped. */
  public addImportMap(newImportMap: ImportMap): void {
    ImportMap.merge(this.importMap, newImportMap, this.resolvedModuleSet);
  }

  /** Resolve a blob URL back to its original source URL. Returns undefined if not found. */
  public getSourceUrlByBlob(blobUrl: string): string | undefined {
    return this.sourceTracker.getSourceUrlByBlob(blobUrl);
  }

  /** Get the original source code that was compiled into a given blob URL. */
  public getOriginalSource(blobUrl: string): string | undefined {
    return this.sourceTracker.getOriginalSource(blobUrl);
  }

  private emit<T extends keyof ModuleTSXEventMap>(
    type: T,
    detail?: ModuleTSXEventMap[T]["detail"],
  ) {
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
        const resolved = ImportMap.resolve(id, this.importMap, this.baseUrl);
        if (resolved) {
          this.resolvedModuleSet.push(resolved.record);
          id = resolved.url;
        } else {
          id = this.resolveBareSpecifier(id);
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

  public async importCode(
    sourceUrl: string,
    code: string,
    options?: any,
  ): Promise<any> {
    try {
      const transformedUrl = await this.transformSourceModule(
        "esm",
        sourceUrl,
        code,
        new Set(),
      );
      return await import(transformedUrl, options);
    } catch (error) {
      this.emit("import:error", { id: sourceUrl, error });
      throw error;
    }
  }

  /**
   * Transform module source code and return a blob URL with the transformed
   * content.
   *
   * `ancestors` lists the source URLs that are already being transformed above
   * this module in the current import chain. We use it to tell two situations
   * apart:
   *
   *   - A cycle: the module imports something that (directly or indirectly)
   *     imports it back. Waiting for that import would wait forever.
   *   - A diamond: the same module is reached through two separate paths. This
   *     is safe to wait for; it just needs the same result twice.
   */
  private async transformSourceModule(
    sourceType: ResourceType,
    sourceUrl: string,
    sourceCode: string,
    ancestors: ReadonlySet<string>,
  ) {
    const cachedBlobUrl = this.sourceTracker.get(sourceType, sourceUrl);
    if (cachedBlobUrl) {
      return cachedBlobUrl;
    }

    return this.sourceTracker.runWithDedup(sourceType, sourceUrl, async () => {
      const loader = this.getLoaderByResourceType(sourceType);
      // Add this module to the chain so its own imports can detect a cycle
      // that leads back here.
      const nextAncestors = new Set(ancestors).add(sourceUrl);
      const code =
        `import.meta.url=${JSON.stringify(sourceUrl)};\n` +
        (await loader(sourceUrl, sourceCode, nextAncestors));
      const blob = new Blob([code], { type: "text/javascript" });
      const blobUrl = URL.createObjectURL(blob);
      this.sourceTracker.set(sourceType, sourceUrl, blobUrl, sourceCode);
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

  private async tsxLoader(
    sourceUrl: string,
    sourceCode: string,
    ancestors: ReadonlySet<string> = new Set(),
  ): Promise<string> {
    this.emit("transform", { sourceUrl });

    try {
      const sourceFile = createSourceFile(sourceCode, getFileName(sourceUrl));
      const specifiers = collectSpecifiers(sourceFile);
      // Collect and resolve all specifiers
      const rewrittenSpecifiers = await this.resolveSpecifiers(
        specifiers,
        sourceUrl,
        ancestors,
      );

      let workingSourceFile = sourceFile;
      if (needsReactImport(workingSourceFile)) {
        workingSourceFile = addReactImport(workingSourceFile);
        // "react" was injected after resolveSpecifiers ran — resolve it now so
        // the transformer rewrites it to a full URL like every other specifier
        if (!rewrittenSpecifiers.has("react")) {
          const reactUrl = await this.resolveSpecifier(
            "react",
            sourceUrl,
            ancestors,
          );
          if (reactUrl !== "react") rewrittenSpecifiers.set("react", reactUrl);
        }
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

  private async resolveLocalUrl(
    fullUrl: string,
    ancestors: ReadonlySet<string>,
  ): Promise<string> {
    const { pathname } = new URL(fullUrl);
    if (pathname.endsWith(".module.css")) {
      return this.transformSourceModule(
        "css-module",
        fullUrl,
        await this.fetchText(fullUrl),
        ancestors,
      );
    }
    if (pathname.endsWith(".css")) {
      return this.transformSourceModule(
        "css",
        fullUrl,
        await this.fetchText(fullUrl),
        ancestors,
      );
    }
    if (pathname.endsWith(".wasm")) {
      // wasm will be handled natively by the browser
      // so we just return the original full URL
      return fullUrl;
    }
    // This module is already in our import chain, so it imports us back: a
    // cycle. We can't wait for its transform to finish (it's waiting on ours),
    // so return the raw URL and let the browser link the cycle itself.
    if (ancestors.has(fullUrl)) {
      return fullUrl;
    }
    // Not a cycle. transformSourceModule may recurse into this module's own
    // imports; if it's already being transformed elsewhere (a diamond), the
    // tracker hands back the same blob URL instead of transforming twice.
    return this.transformSourceModule(
      "esm",
      fullUrl,
      await this.fetchText(fullUrl),
      ancestors,
    );
  }

  private async resolveSpecifier(
    specifier: string,
    sourceUrl: string,
    ancestors: ReadonlySet<string>,
  ): Promise<string> {
    const resolved = ImportMap.resolve(specifier, this.importMap, sourceUrl);
    if (resolved) {
      this.resolvedModuleSet.push(resolved.record);
      // CSS resolved via import map still needs to be injected as a <style> tag
      const { pathname } = new URL(resolved.url);
      if (pathname.endsWith(".module.css")) {
        return this.transformSourceModule(
          "css-module",
          resolved.url,
          await this.fetchText(resolved.url),
          ancestors,
        );
      }
      if (pathname.endsWith(".css")) {
        return this.transformSourceModule(
          "css",
          resolved.url,
          await this.fetchText(resolved.url),
          ancestors,
        );
      }
      return resolved.url;
    }

    if (isRelativeSpecifier(specifier)) {
      // local file, we fetch and transform it, then return the blob URL
      return this.resolveLocalUrl(new URL(specifier, sourceUrl).href, ancestors);
    }

    // Node built-ins (`node:fs`, etc.). The import map is consulted first
    // (above), so a user can point `node:*` anywhere they like; this is only
    // the fallback when the import map has no entry for it. We map to the jspm
    // browser polyfills, which cover most Node core modules.
    if (specifier.startsWith("node:")) {
      return `https://raw.esm.sh/@jspm/core/nodelibs/browser/${specifier.slice(5)}.js`;
    }

    const bareSpecifier = specifier.startsWith("npm:")
      ? specifier.slice(4)
      : specifier;
    if (specifier.startsWith("npm:") || isBareSpecifier(specifier)) {
      // this avoid we accidentally convert a package named xxx.css to a css file on esm.sh
      const subpath = bareSpecifier.startsWith("@")
        ? // @scope/pkg/subpath -> subpath
          bareSpecifier.split("/").slice(2).join("/")
        : // pkg/subpath -> subpath
          bareSpecifier.split("/").slice(1).join("/");
      const url = this.resolveBareSpecifier(bareSpecifier);
      if (subpath.endsWith(".css")) {
        // if the subpath (not the package name) ends with .css, we treat it as a css file
        return this.transformSourceModule(
          "css",
          url,
          await this.fetchText(url),
          ancestors,
        );
      }
      return url;
    }

    // Fallback: return the original specifier
    return specifier;
  }

  private async resolveSpecifiers(
    specifiers: Set<string>,
    sourceUrl: string,
    ancestors: ReadonlySet<string>,
  ): Promise<Map<string, string>> {
    const resolved = new Map<string, string>();

    const tasks = Array.from(specifiers).map(async (specifier) => {
      const specifier2 = await this.resolveSpecifier(
        specifier,
        sourceUrl,
        ancestors,
      );
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

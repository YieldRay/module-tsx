import ts from "typescript";
import { createSourceFile, printSourceFile, transform } from "./ts.ts";
import { needsReactImport, addReactImport } from "./react.ts";
import { fetchESModule, fetchText } from "./network.ts";
import { cssLoader, cssModuleLoader, type Loader } from "./loader.ts";
import { parseImportMaps, resolveFromImportMap, type ImportMapData } from "./importmap.ts";
import { ModuleTSXError } from "./error.ts";

/** Track blob URLs to original source URLs */
const blobMap = new Map<string, string>();

/** Track source URLs to transformed blob URLs */
const sourceMap = new Map<string, string>();

/** Cached import maps from <script type="importmap"> */
let cachedImportMaps: ImportMapData | null = null;

function track(sourceUrl: string, blobUrl: string) {
  sourceMap.set(sourceUrl, blobUrl);
  blobMap.set(blobUrl, sourceUrl);
}

type ResourceType = "esm" | "css" | "css-module";
const getLoaderByResourceType = (type: ResourceType): Loader => {
  switch (type) {
    case "css":
      return cssLoader;
    case "css-module":
      return cssModuleLoader;
    case "esm":
      // Built-in loader for ES modules
      return rewriteModuleImport;
    default:
      throw new ModuleTSXError(`Unsupported resource type: ${type}`);
  }
};

/** Transform module source code and return a blob URL with the transformed content */
export async function transformSourceModule(sourceType: ResourceType, sourceUrl: string, sourceCode: string) {
  if (sourceMap.has(sourceUrl)) {
    return sourceMap.get(sourceUrl)!;
  }
  const loader = getLoaderByResourceType(sourceType);
  const code = `import.meta.url=${JSON.stringify(sourceUrl)};\n` + (await loader(sourceUrl, sourceCode));
  const blob = new Blob([code], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  track(sourceUrl, blobUrl);
  return blobUrl;
}

function getFileName(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).pathname;
  } catch {
    return "temp.tsx";
  }
}

async function rewriteModuleImport(sourceUrl: string, sourceCode: string): Promise<string> {
  const sourceFile = createSourceFile(sourceCode, getFileName(sourceUrl));

  const specifiers = collectSpecifiers(sourceFile);
  // Collect and resolve all specifiers
  const rewrittenSpecifiers = await resolveSpecifiers(specifiers, sourceUrl);

  let workingSourceFile = sourceFile;
  if (needsReactImport(workingSourceFile)) {
    workingSourceFile = addReactImport(workingSourceFile);
  }

  const transformers: ts.TransformerFactory<ts.SourceFile>[] = [createRewriteImportTransformer(rewrittenSpecifiers)];
  const transformedFile = transform(workingSourceFile, transformers);
  return printSourceFile(transformedFile);
}

function isBareSpecifier(specifier: string): boolean {
  if (specifier.match(/^\.*\//)) return false;

  try {
    new URL(specifier);
    return false;
  } catch {
    return true;
  }
}

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith(".") || specifier.startsWith("/");
}

function collectSpecifiers(sourceFile: ts.SourceFile): Set<string> {
  const set = new Set<string>();

  const visit = (node: ts.Node) => {
    const addSpecifier = (literal?: ts.StringLiteral) => {
      if (literal) {
        set.add(literal.text);
      }
    };

    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      addSpecifier(node.moduleSpecifier);
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        addSpecifier(arg);
      }
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      addSpecifier(node.moduleSpecifier);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return set;
}

async function resolveSpecifiers(specifiers: Set<string>, sourceUrl: string): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();

  // Load import maps once on first call
  if (cachedImportMaps === null) {
    cachedImportMaps = parseImportMaps();
  }

  const tasks = Array.from(specifiers).map(async (specifier) => {
    // Check import maps first
    const mappedSpecifier = resolveFromImportMap(specifier, cachedImportMaps!, sourceUrl);
    if (mappedSpecifier) {
      resolved.set(specifier, mappedSpecifier);
      return;
    }

    if (isRelativeSpecifier(specifier)) {
      const targetUrl = new URL(specifier, sourceUrl);

      if (targetUrl.pathname.endsWith(".module.css")) {
        const cssCode = await fetchText(targetUrl);
        const blobUrl = await transformSourceModule("css-module", targetUrl.href, cssCode);
        resolved.set(specifier, blobUrl);
      } else if (targetUrl.pathname.endsWith(".css")) {
        const blobUrl = await transformSourceModule("css", targetUrl.href, "");
        resolved.set(specifier, blobUrl);
      } else if (targetUrl.pathname.endsWith(".wasm")) {
        // wasm will be handled natively by the browser
        // so we just return the original full URL
        resolved.set(specifier, targetUrl.href);
      } else {
        const childCode = await fetchESModule(targetUrl);
        const blobUrl = await transformSourceModule("esm", targetUrl.href, childCode);
        //! ^ Recursive call
        resolved.set(specifier, blobUrl);
      }
    } else if (specifier.startsWith("npm:")) {
      resolved.set(specifier, `https://esm.sh/${specifier.slice(4)}`);
    } else if (specifier.startsWith("node:")) {
      resolved.set(specifier, `https://raw.esm.sh/@jspm/core/nodelibs/browser/${specifier.slice(5)}.js`);
    } else if (isBareSpecifier(specifier)) {
      resolved.set(specifier, new URL(specifier, "https://esm.sh/").href);
    }
  });

  await Promise.all(tasks);
  return resolved;
}

function createRewriteImportTransformer(specifierMap: Map<string, string>): ts.TransformerFactory<ts.SourceFile> {
  const rewriteSpecifier = (specifier: string): string => {
    return specifierMap.get(specifier) ?? specifier;
  };

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visitNode = (node: ts.Node): ts.Node => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const next = rewriteSpecifier(node.moduleSpecifier.text);
        if (next !== node.moduleSpecifier.text) {
          return ts.factory.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            ts.factory.createStringLiteral(next),
            node.assertClause,
          );
        }
      }

      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          const next = rewriteSpecifier(arg.text);
          if (next !== arg.text) {
            return ts.factory.updateCallExpression(node, node.expression, node.typeArguments, [
              ts.factory.createStringLiteral(next),
              ...node.arguments.slice(1),
            ]);
          }
        }
      }

      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const next = rewriteSpecifier(node.moduleSpecifier.text);
        if (next !== node.moduleSpecifier.text) {
          return ts.factory.updateExportDeclaration(
            node,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            ts.factory.createStringLiteral(next),
            node.assertClause,
          );
        }
      }

      return ts.visitEachChild(node, visitNode, context);
    };

    return (sf: ts.SourceFile) => ts.visitNode(sf, visitNode) as ts.SourceFile;
  };

  return transformer;
}

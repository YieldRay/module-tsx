import ts from "typescript";
import { createSourceFile, printSourceFile, transform } from "./ts.ts";
import { needsReactImport, addReactImport } from "./react.ts";
import { fetchModule } from "./network.ts";

/**
 * track blob URLs to their original source URLs
 */
const blobMap = new Map<string, string>();

/**
 * track original source URLs to their transformed blob URLs
 */
const sourceMap = new Map<string, string>();

function track(sourceUrl: string, blobUrl: string) {
  sourceMap.set(sourceUrl, blobUrl);
  blobMap.set(blobUrl, sourceUrl);
}

/**
 * Given a source URL and source code, transform the module and return a blob URL,
 * where the blob URL's content is the transformed module code.
 */
export async function transformSourceModule(sourceUrl: string, sourceCode: string) {
  if (sourceMap.has(sourceUrl)) {
    return sourceMap.get(sourceUrl)!;
  }
  const code = `import.meta.url=${JSON.stringify(sourceUrl)};\n` + (await rewriteModuleImport(sourceUrl, sourceCode));
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

  const relativeSpecifiers = collectRelativeSpecifiers(sourceFile);
  // we only rewrite relative specifiers here
  // in the future we may add support for local .css or other assets
  // e.g. transform import './style.css' to import 'blob:xxx'
  // where the blob is a js module to inject the original css to the document
  // NOTE: esm.sh already supports css imports, so this is for local assets only
  const rewrittenSpecifiers = await resolveRelativeSpecifiers(relativeSpecifiers, sourceUrl);

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

function collectRelativeSpecifiers(sourceFile: ts.SourceFile): Set<string> {
  const set = new Set<string>();

  const visit = (node: ts.Node) => {
    const addIfRelative = (literal?: ts.StringLiteral) => {
      if (literal && isRelativeSpecifier(literal.text)) {
        set.add(literal.text);
      }
    };

    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      addIfRelative(node.moduleSpecifier);
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        addIfRelative(arg);
      }
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      addIfRelative(node.moduleSpecifier);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return set;
}

async function resolveRelativeSpecifiers(specifiers: Set<string>, sourceUrl: string) {
  const resolved = new Map<string, string>();

  const tasks = Array.from(specifiers).map(async (specifier) => {
    const targetUrl = new URL(specifier, sourceUrl).toString();
    const childCode = await fetchModule(targetUrl);
    const blobUrl = await transformSourceModule(targetUrl, childCode);
    resolved.set(specifier, blobUrl);
  });

  await Promise.all(tasks);
  return resolved;
}

function createRewriteImportTransformer(replacements: Map<string, string>): ts.TransformerFactory<ts.SourceFile> {
  const rewriteSpecifier = (specifier: string): string => {
    if (replacements.has(specifier)) {
      return replacements.get(specifier)!;
    }
    if (specifier.startsWith("npm:")) {
      return specifier.replace(/^npm:/, "https://esm.sh/");
    }
    if (specifier.startsWith("node:")) {
      return `https://raw.esm.sh/@jspm/core/nodelibs/browser/${specifier.slice(5)}.js`;
    }
    if (isBareSpecifier(specifier)) {
      return new URL(specifier, "https://esm.sh/").toString();
    }
    if (isRelativeSpecifier(specifier)) {
      throw new Error("Unreachable");
    }
    return specifier;
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

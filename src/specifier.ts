import ts from "typescript";

export function isBareSpecifier(specifier: string): boolean {
  if (specifier.match(/^\.*\//)) return false;

  try {
    new URL(specifier);
    return false;
  } catch {
    return true;
  }
}

/* Helper to check if a specifier is relative, note that it includes both relative paths and absolute paths */
export function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith(".") || specifier.startsWith("/");
}

export function collectSpecifiers(sourceFile: ts.SourceFile): Set<string> {
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

export function createRewriteImportTransformer(
  specifierMap: Map<string, string>,
): ts.TransformerFactory<ts.SourceFile> {
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

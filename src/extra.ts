import ts from "typescript";

/**
 * Remove export keywords and statements (currently unused)
 * Note: Valid to use exports in <script type="module">, so this transformer is not applied
 * @type ts.TransformerFactory<ts.SourceFile>
 */
export function removeExportsTransformer(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
  function visitNode(node: ts.Node): ts.Node | ts.Node[] | undefined {
    // Handle exported function declarations
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
      const isDefaultExport = node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.DefaultKeyword);

      if (isDefaultExport) {
        // Convert: export default function -> function default$random
        const randomName = `default$${Math.random().toString(36).slice(2)}`;
        return ts.factory.createFunctionDeclaration(
          node.modifiers?.filter(
            (mod) => mod.kind !== ts.SyntaxKind.ExportKeyword && mod.kind !== ts.SyntaxKind.DefaultKeyword,
          ),
          node.asteriskToken,
          ts.factory.createIdentifier(randomName),
          node.typeParameters,
          node.parameters,
          node.type,
          node.body,
        );
      } else {
        // Remove export keyword from function
        return ts.factory.createFunctionDeclaration(
          node.modifiers?.filter((mod) => mod.kind !== ts.SyntaxKind.ExportKeyword),
          node.asteriskToken,
          node.name,
          node.typeParameters,
          node.parameters,
          node.type,
          node.body,
        );
      }
    }

    // Handle exported variable declarations
    if (ts.isVariableStatement(node) && node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
      return ts.factory.createVariableStatement(
        node.modifiers?.filter((mod) => mod.kind !== ts.SyntaxKind.ExportKeyword),
        node.declarationList,
      );
    }

    // Handle exported class declarations
    if (ts.isClassDeclaration(node) && node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
      const isDefaultExport = node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.DefaultKeyword);

      if (isDefaultExport) {
        const randomName = `default$${Math.random().toString(36).slice(2)}`;
        return ts.factory.createClassDeclaration(
          node.modifiers?.filter(
            (mod) => mod.kind !== ts.SyntaxKind.ExportKeyword && mod.kind !== ts.SyntaxKind.DefaultKeyword,
          ),
          ts.factory.createIdentifier(randomName),
          node.typeParameters,
          node.heritageClauses,
          node.members,
        );
      } else {
        return ts.factory.createClassDeclaration(
          node.modifiers?.filter((mod) => mod.kind !== ts.SyntaxKind.ExportKeyword),
          node.name,
          node.typeParameters,
          node.heritageClauses,
          node.members,
        );
      }
    }

    // Remove export declarations without module specifier
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier) {
      return undefined;
    }

    // Remove export declarations with module specifier
    if (ts.isExportDeclaration(node)) {
      return undefined;
    }

    return ts.visitEachChild(node, visitNode, context);
  }

  return (sourceFile: ts.SourceFile) => {
    const visited = ts.visitNode(sourceFile, visitNode) as ts.SourceFile;
    // Filter out undefined nodes
    const statements = visited.statements.filter((stmt) => stmt !== undefined);
    return ts.factory.updateSourceFile(
      visited,
      statements,
      visited.isDeclarationFile,
      visited.referencedFiles,
      visited.typeReferenceDirectives,
      visited.hasNoDefaultLib,
      visited.libReferenceDirectives,
    );
  };
}

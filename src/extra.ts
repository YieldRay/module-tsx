import ts from "typescript";

/**
 * @type ts.TransformerFactory<ts.SourceFile>
 * Unused function that can remove export keywords and export statements.
 * Since it's valid to use export keyword in <script type="module">, this is not used.
 */
export function removeExportsTransformer(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
  function visitNode(node: ts.Node): ts.Node | ts.Node[] | undefined {
    // Handle export function declarations
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
      const isDefaultExport = node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.DefaultKeyword);

      if (isDefaultExport) {
        // export default function -> function default$Math.random
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
        // export function name(){} -> function name(){}
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

    // Handle export variable declarations
    if (ts.isVariableStatement(node) && node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
      return ts.factory.createVariableStatement(
        node.modifiers?.filter((mod) => mod.kind !== ts.SyntaxKind.ExportKeyword),
        node.declarationList,
      );
    }

    // Handle export class declarations
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

    // Handle export {} - remove entirely
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier) {
      return undefined;
    }

    // Handle export ... from "module" - remove entirely
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

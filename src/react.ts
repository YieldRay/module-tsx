import ts from "typescript";

/**
 * Check if code uses JSX but missing React import
 */
export function needsReactImport(sourceFile: ts.SourceFile): boolean {
  let hasJSX = false;
  let hasReactVariable = false;

  function visitNode(node: ts.Node): void {
    // Check JSX elements
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      hasJSX = true;
    }

    // Check if React variable exists at module top level
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.importClause) {
        // Default import: import React from 'xxx'
        if (node.importClause.name?.text === "React") {
          hasReactVariable = true;
        }
        // Namespace import: import * as React from 'xxx'
        if (node.importClause.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) {
          if (node.importClause.namedBindings.name.text === "React") {
            hasReactVariable = true;
          }
        }
      }
    }

    // Check React variable declarations: const React = ...
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      if (node.name.text === "React") {
        hasReactVariable = true;
      }
    }

    ts.forEachChild(node, visitNode);
  }

  visitNode(sourceFile);
  return hasJSX && !hasReactVariable;
}

/**
 * Add React import statement at the top if missing
 */
export function addReactImport(sourceFile: ts.SourceFile): ts.SourceFile {
  // Find existing react import to use same specifier
  let reactSpecifier = "react";

  function findReactSpecifier(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      // Match: "react", "react@xxx", "*/react", "*/react@xxx"
      if (
        specifier === "react" ||
        /^react@/.test(specifier) ||
        specifier.endsWith("/react") ||
        /\/react@/.test(specifier)
      ) {
        reactSpecifier = specifier;
        return;
      }
    }
    ts.forEachChild(node, findReactSpecifier);
  }

  findReactSpecifier(sourceFile);

  // Create: import React from "react" (or found specifier);
  const reactImport = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(false, ts.factory.createIdentifier("React"), undefined),
    ts.factory.createStringLiteral(reactSpecifier),
    undefined,
  );

  const statements = [reactImport, ...sourceFile.statements];

  return ts.factory.updateSourceFile(
    sourceFile,
    statements,
    sourceFile.isDeclarationFile,
    sourceFile.referencedFiles,
    sourceFile.typeReferenceDirectives,
    sourceFile.hasNoDefaultLib,
    sourceFile.libReferenceDirectives,
  );
}

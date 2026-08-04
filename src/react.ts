import ts from "typescript";

/** Check if code uses JSX without React import */
export function needsReactImport(sourceFile: ts.SourceFile): boolean {
  let hasJSX = false;
  let hasReactVariable = false;

  function visitNode(node: ts.Node): void {
    // Check for JSX elements
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    ) {
      hasJSX = true;
    }

    // Check for React variable at module level
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (node.importClause) {
        // Check default import: import React from 'xxx'
        if (node.importClause.name?.text === "React") {
          hasReactVariable = true;
        }
        // Check namespace import: import * as React from 'xxx'
        if (
          node.importClause.namedBindings &&
          ts.isNamespaceImport(node.importClause.namedBindings)
        ) {
          if (node.importClause.namedBindings.name.text === "React") {
            hasReactVariable = true;
          }
        }
      }
    }

    // Check variable declarations: const React = ...
    if (
      ts.isVariableDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
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
 * Whether an import specifier refers to the React package itself, so an
 * auto-injected `import React` can reuse it.
 *
 * Matches the bare package (`react`, `react@18`) and CDN URLs whose path is
 * exactly react (`https://esm.sh/react`, `https://esm.sh/react@18`).
 *
 * Deliberately does NOT match a `react` subpath of some other package such as
 * `@pierre/trees/react` or `some-lib/react` — those export their own bindings,
 * not React's, and reusing them would import the wrong module.
 */
export function isReactSpecifier(specifier: string): boolean {
  // Bare package: "react" or "react@<version>"
  if (specifier === "react" || /^react@/.test(specifier)) {
    return true;
  }

  // Absolute URL whose last path segment is exactly react (a CDN build).
  try {
    const url = new URL(specifier);
    const lastSegment = url.pathname.split("/").filter(Boolean).pop() ?? "";
    return lastSegment === "react" || /^react@/.test(lastSegment);
  } catch {
    // Not a URL: a bare "<pkg>/react" subpath, which is not React.
    return false;
  }
}

/** Add React import statement to the top */
export function addReactImport(sourceFile: ts.SourceFile): ts.SourceFile {
  // Find existing React import to reuse specifier
  let reactSpecifier = "react";

  let found = false;
  function findReactSpecifier(node: ts.Node): void {
    if (found) return;
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      if (isReactSpecifier(specifier)) {
        reactSpecifier = specifier;
        found = true;
        return;
      }
    }
    ts.forEachChild(node, findReactSpecifier);
  }

  findReactSpecifier(sourceFile);

  // Create: import React from "react" (or found specifier);
  const reactImport = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false,
      ts.factory.createIdentifier("React"),
      undefined,
    ),
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

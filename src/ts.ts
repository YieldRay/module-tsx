import ts from "typescript";
import { ModuleTSXError } from "./error.ts";

const FILE_NAME = "temp.tsx";

export function createSourceFile(code: string, fileName = FILE_NAME) {
  try {
    const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    return sourceFile;
  } catch (cause) {
    throw new ModuleTSXError(`Failed to create typescript source file ${fileName}`, { cause });
  }
}

export function printSourceFile(sourceFile: ts.SourceFile): string {
  try {
    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
      removeComments: false,
    });
    const code: string = printer.printFile(sourceFile);
    // Transpile to JavaScript
    return ts.transpile(code, {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      noCheck: true,
      declaration: false,
      jsx: ts.JsxEmit.React,
    });
    // .replaceAll(
    //   `import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";`,
    //   `import { jsx as _jsx, jsxs as _jsxs } from "https://esm.sh/react/jsx-runtime";`
    // )
    // .replaceAll(
    //   `import { jsxDEV as _jsxDEV } from "react/jsx-dev-runtime";`,
    //   `import { jsxDEV as _jsxDEV } from "https://esm.sh/react/jsx-dev-runtime";`
    // );
  } catch (cause) {
    throw new ModuleTSXError(`Failed to print typescript source file ${sourceFile.fileName}`, { cause });
  }
}

export function transform(
  sourceFile: ts.SourceFile,
  transformers: ts.TransformerFactory<ts.SourceFile>[],
): ts.SourceFile {
  try {
    const result = ts.transform(sourceFile, transformers);
    const transformedFile = result.transformed[0];
    result.dispose();
    return transformedFile;
  } catch (cause) {
    throw new ModuleTSXError(`Failed to transform typescript source file ${sourceFile.fileName}`, { cause });
  }
}

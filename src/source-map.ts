import typescript from "typescript";
import { needsReactImport } from "./react.ts";

/**
 * Given original source code, re-transpile with source maps to map
 * a compiled line/col back to the original position.
 *
 * The actual compilation pipeline is:
 *   1. createSourceFile (parse as TSX)
 *   2. AST transforms (import rewriting, React import injection)
 *   3. printer.printFile → printed code
 *   4. ts.transpile(printed) → final compiled JS
 *   5. Prepend `import.meta.url=...;\n`
 *
 * To produce accurate mappings, we re-transpile the original source with the
 * same compiler options and account for injected lines:
 *   - 1 line for the prepended `import.meta.url` assignment
 *   - 1 line for the injected `import React` (if JSX is used without React in scope)
 */
export async function mapToOriginalPosition(
  originalSource: string,
  compiledLine: number,
  compiledCol?: number,
): Promise<{ line: number; col: number } | undefined> {
  const result = typescript.transpileModule(originalSource, {
    compilerOptions: {
      target: typescript.ScriptTarget.Latest,
      module: typescript.ModuleKind.ESNext,
      jsx: typescript.JsxEmit.React,
      sourceMap: true,
    },
    fileName: "source.tsx",
  });

  if (!result.sourceMapText) return undefined;

  try {
    const sourceMapJson = JSON.parse(result.sourceMapText);
    const mappings: string = sourceMapJson.mappings;

    // Account for lines prepended in the actual compilation pipeline:
    // - 1 line for `import.meta.url=...;\n` (always present)
    // - 1 line for injected `import React from "react";\n` (if needed)
    let prependedLines = 1; // import.meta.url
    const sourceFile = typescript.createSourceFile(
      "source.tsx",
      originalSource,
      typescript.ScriptTarget.Latest,
      true,
      typescript.ScriptKind.TSX,
    );
    if (needsReactImport(sourceFile)) {
      prependedLines += 1;
    }

    const adjustedLine = Math.max(1, compiledLine - prependedLines);
    return originalPositionFromSourceMap(mappings, adjustedLine, compiledCol ?? 0);
  } catch {
    return undefined;
  }
}

/**
 * Decode a VLQ-encoded source map mappings string and find the original
 * position for a given generated line/col.
 */
function originalPositionFromSourceMap(
  mappings: string,
  generatedLine: number,
  generatedCol: number,
): { line: number; col: number } | undefined {
  const lines = mappings.split(";");
  if (generatedLine < 1 || generatedLine > lines.length) return undefined;

  const segments = lines[generatedLine - 1];
  if (!segments) return undefined;

  let genCol = 0;
  let origLine = 0;
  let origCol = 0;
  let sourceIdx = 0;

  // Decode all prior lines to get cumulative state
  for (let i = 0; i < generatedLine - 1; i++) {
    const segs = lines[i];
    if (!segs) continue;
    for (const seg of decodeSegments(segs)) {
      genCol = seg[0]; // resets per line in relative sense but we track state
      if (seg.length >= 4) {
        sourceIdx += seg[1];
        origLine += seg[2];
        origCol += seg[3];
      }
    }
    genCol = 0; // genCol resets per line
  }

  // Now decode the target line
  genCol = 0;
  let bestOrigLine = origLine;
  let bestOrigCol = origCol;
  let found = false;

  for (const seg of decodeSegments(segments)) {
    genCol += seg[0];
    if (seg.length >= 4) {
      sourceIdx += seg[1];
      origLine += seg[2];
      origCol += seg[3];
    }
    if (genCol <= generatedCol) {
      bestOrigLine = origLine;
      bestOrigCol = origCol;
      found = true;
    } else {
      break;
    }
  }

  if (!found) return undefined;
  return { line: bestOrigLine + 1, col: bestOrigCol + 1 }; // 1-indexed
}

function decodeSegments(line: string): number[][] {
  const segments: number[][] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === ",") {
      i++;
      continue;
    }
    const segment: number[] = [];
    while (i < line.length && line[i] !== ",") {
      const [value, consumed] = decodeVLQ(line, i);
      segment.push(value);
      i += consumed;
    }
    if (segment.length > 0) segments.push(segment);
  }
  return segments;
}

const VLQ_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeVLQ(str: string, start: number): [number, number] {
  let value = 0;
  let shift = 0;
  let i = start;
  let continuation: boolean;
  do {
    const char = str[i];
    const digit = VLQ_CHARS.indexOf(char);
    if (digit === -1) break;
    continuation = (digit & 32) !== 0;
    value += (digit & 31) << shift;
    shift += 5;
    i++;
  } while (continuation);

  // Convert from VLQ sign representation
  const isNegative = (value & 1) !== 0;
  value >>= 1;
  if (isNegative) value = -value;

  return [value, i - start];
}

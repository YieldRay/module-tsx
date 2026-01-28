import { warn } from "./error.ts";

export interface ImportMapData {
  imports?: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
}

export function parseImportMaps(): ImportMapData {
  const result: ImportMapData = {
    imports: {},
    scopes: {},
  };

  // Track mapped specifiers to prevent remapping per HTML import maps spec
  const mappedSpecifiers = new Set<string>();

  const scripts = document.querySelectorAll('script[type="importmap"]');

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "{}") as ImportMapData;

      // Merge imports: only add unmapped specifiers
      if (data.imports) {
        for (const [specifier, url] of Object.entries(data.imports)) {
          if (!mappedSpecifiers.has(specifier)) {
            result.imports![specifier] = url;
            mappedSpecifiers.add(specifier);
          }
        }
      }

      // Merge scopes and their imports
      if (data.scopes) {
        for (const [scope, imports] of Object.entries(data.scopes)) {
          if (!result.scopes![scope]) {
            result.scopes![scope] = {};
          }

          // Apply no-remap rule within scopes
          for (const [specifier, url] of Object.entries(imports)) {
            const scopedKey = `${scope}::${specifier}`;
            if (!mappedSpecifiers.has(scopedKey)) {
              result.scopes![scope]![specifier] = url;
              mappedSpecifiers.add(scopedKey);
            }
          }
        }
      }
    } catch (error) {
      warn(`Failed to parse importmap script:`, error);
    }
  }

  return result;
}

/**
 * Resolve specifier from import maps, checking scopes by specificity then global imports
 */
export function resolveFromImportMap(
  specifier: string,
  importMaps: ImportMapData,
  sourceUrl?: string,
): string | undefined {
  // Try scopes by specificity, then fall back to global imports
  if (sourceUrl && importMaps.scopes) {
    // Find matching scopes, sorted by specificity
    const matchingScopes = Object.keys(importMaps.scopes)
      .filter((scope) => sourceUrl.startsWith(scope))
      .sort((a, b) => b.length - a.length);

    // Check scopes in order
    for (const scope of matchingScopes) {
      const scopedImports = importMaps.scopes[scope];
      if (scopedImports && scopedImports[specifier]) {
        return scopedImports[specifier];
      }
    }
  }

  // Fall back to global imports
  if (importMaps.imports && importMaps.imports[specifier]) {
    return importMaps.imports[specifier];
  }

  return undefined;
}

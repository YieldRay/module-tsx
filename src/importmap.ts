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

  // Track which specifiers have already been mapped
  // to prevent remapping (per HTML import maps spec)
  const mappedSpecifiers = new Set<string>();

  const scripts = document.querySelectorAll('script[type="importmap"]');

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "{}") as ImportMapData;

      // Merge imports: only add if specifier hasn't been mapped before
      if (data.imports) {
        for (const [specifier, url] of Object.entries(data.imports)) {
          if (!mappedSpecifiers.has(specifier)) {
            result.imports![specifier] = url;
            mappedSpecifiers.add(specifier);
          }
        }
      }

      // Merge scopes: create new scopes and merge within scopes
      if (data.scopes) {
        for (const [scope, imports] of Object.entries(data.scopes)) {
          if (!result.scopes![scope]) {
            result.scopes![scope] = {};
          }

          // Within each scope, also apply the "don't remap" rule
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
 * Get the mapped specifier from import maps, or undefined if not found
 *
 * Scopes resolution follows the HTML spec:
 * 1. Find all matching scopes for the sourceUrl
 * 2. Try scopes in order of specificity (longest scope key first)
 * 3. Fall back to global imports if no scope match
 */
export function resolveFromImportMap(
  specifier: string,
  importMaps: ImportMapData,
  sourceUrl?: string,
): string | undefined {
  // Try scopes first (scope-specific mappings) with proper fallback chain
  if (sourceUrl && importMaps.scopes) {
    // Find all matching scopes
    const matchingScopes = Object.keys(importMaps.scopes)
      .filter((scope) => sourceUrl.startsWith(scope))
      // Sort by length descending (most specific first)
      .sort((a, b) => b.length - a.length);

    // Check each scope in order of specificity
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

import { warn } from "./error.ts";

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

// Ordered map: normalized specifier key → resolved URL (or null for blocked entries)
export type ModuleSpecifierMap = Map<string, URL | null>;

// Spec § "specifier resolution record"
export interface SpecifierResolutionRecord {
  serializedBaseURL: string;
  specifier: string;
  specifierAsURL: URL | null;
}

export class ImportMap {
  imports: ModuleSpecifierMap;
  scopes: Map<string, ModuleSpecifierMap>;
  integrity: Map<string, string>;

  constructor(
    imports: ModuleSpecifierMap = new Map(),
    scopes: Map<string, ModuleSpecifierMap> = new Map(),
    integrity: Map<string, string> = new Map(),
  ) {
    this.imports = imports;
    this.scopes = scopes;
    this.integrity = integrity;
  }

  /** Parse a JSON import map string against a base URL. */
  static parse(input: string, baseURL: URL | string): ImportMap {
    return parseImportMapString(
      input,
      typeof baseURL === "string" ? new URL(baseURL) : baseURL,
    );
  }

  /** Build an ImportMap from a plain object (same shape as the JSON format). */
  static of(json: object, baseURL: URL | string): ImportMap {
    return parseImportMapString(
      JSON.stringify(json),
      typeof baseURL === "string" ? new URL(baseURL) : baseURL,
    );
  }

  /** Merge newImportMap into oldImportMap in place (spec § "merge existing and new import maps"). */
  static merge(
    oldImportMap: ImportMap,
    newImportMap: ImportMap,
    resolvedModuleSet: ReadonlyArray<SpecifierResolutionRecord> = [],
  ): void {
    mergeExistingAndNewImportMaps(
      oldImportMap,
      newImportMap,
      resolvedModuleSet,
    );
  }

  /** Resolve a specifier against an import map (spec § "resolve a module specifier"). */
  static resolve(
    specifier: string,
    importMap: ImportMap,
    baseURL: string | URL,
  ): { url: string; record: SpecifierResolutionRecord } | undefined {
    return resolveFromImportMap(specifier, importMap, baseURL);
  }

  /** Parse all <script type="importmap"> elements from the DOM. */
  static fromDOM(): ImportMap {
    return parseImportMaps();
  }
}

// ---------------------------------------------------------------------------
// Spec § "resolve a URL-like module specifier"
// ---------------------------------------------------------------------------
function resolveURLLikeModuleSpecifier(
  specifier: string,
  baseURL: URL,
): URL | null {
  if (
    specifier.startsWith("/") ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    try {
      return new URL(specifier, baseURL);
    } catch {
      return null;
    }
  }
  try {
    return new URL(specifier);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Spec § "normalize a specifier key"
// ---------------------------------------------------------------------------
function normalizeSpecifierKey(
  specifierKey: string,
  baseURL: URL,
): string | null {
  if (specifierKey === "") {
    warn("Specifier keys may not be the empty string.");
    return null;
  }
  const url = resolveURLLikeModuleSpecifier(specifierKey, baseURL);
  if (url !== null) {
    return url.href;
  }
  return specifierKey;
}

// ---------------------------------------------------------------------------
// Spec § "sort and normalize a module specifier map"
// ---------------------------------------------------------------------------
function sortAndNormalizeSpecifierMap(
  originalMap: Record<string, unknown>,
  baseURL: URL,
): ModuleSpecifierMap {
  const normalized = new Map<string, URL | null>();

  for (const [specifierKey, value] of Object.entries(originalMap)) {
    const normalizedKey = normalizeSpecifierKey(specifierKey, baseURL);
    if (normalizedKey === null) continue;

    if (typeof value !== "string") {
      warn(
        `Import map addresses must be strings; ignoring key "${specifierKey}".`,
      );
      normalized.set(normalizedKey, null);
      continue;
    }

    const addressURL = resolveURLLikeModuleSpecifier(value, baseURL);
    if (addressURL === null) {
      warn(`Invalid address "${value}" for key "${specifierKey}".`);
      normalized.set(normalizedKey, null);
      continue;
    }

    if (specifierKey.endsWith("/") && !addressURL.href.endsWith("/")) {
      warn(
        `Invalid address "${value}" for specifier key "${specifierKey}": ` +
          `since the specifier key ends with "/", the address must as well.`,
      );
      normalized.set(normalizedKey, null);
      continue;
    }

    normalized.set(normalizedKey, addressURL);
  }

  return sortedDescending(normalized);
}

// ---------------------------------------------------------------------------
// Spec § "sort and normalize scopes"
// ---------------------------------------------------------------------------
function sortAndNormalizeScopes(
  originalMap: Record<string, unknown>,
  baseURL: URL,
): Map<string, ModuleSpecifierMap> {
  const normalized = new Map<string, ModuleSpecifierMap>();

  for (const [scopePrefix, potentialSpecifierMap] of Object.entries(
    originalMap,
  )) {
    if (
      typeof potentialSpecifierMap !== "object" ||
      potentialSpecifierMap === null ||
      Array.isArray(potentialSpecifierMap)
    ) {
      throw new TypeError(
        `The value of the scope with prefix "${scopePrefix}" must be a JSON object.`,
      );
    }

    let scopePrefixURL: URL;
    try {
      scopePrefixURL = new URL(scopePrefix, baseURL);
    } catch {
      warn(`Scope prefix URL "${scopePrefix}" is not parseable.`);
      continue;
    }

    normalized.set(
      scopePrefixURL.href,
      sortAndNormalizeSpecifierMap(
        potentialSpecifierMap as Record<string, unknown>,
        baseURL,
      ),
    );
  }

  return sortedDescending(normalized);
}

// ---------------------------------------------------------------------------
// Spec § "normalize a module integrity map"
// ---------------------------------------------------------------------------
function normalizeModuleIntegrityMap(
  originalMap: Record<string, unknown>,
  baseURL: URL,
): Map<string, string> {
  const normalized = new Map<string, string>();

  for (const [key, value] of Object.entries(originalMap)) {
    const url = resolveURLLikeModuleSpecifier(key, baseURL);
    if (url === null) {
      warn(`Invalid URL key "${key}" in integrity map.`);
      continue;
    }
    if (typeof value !== "string") {
      warn(`Integrity values must be strings; ignoring key "${key}".`);
      continue;
    }
    normalized.set(url.href, value);
  }

  return normalized;
}

function sortedDescending<V>(map: Map<string, V>): Map<string, V> {
  return new Map(
    [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0)),
  );
}

// ---------------------------------------------------------------------------
// Spec § "parse an import map string"
// ---------------------------------------------------------------------------
function parseImportMapString(input: string, baseURL: URL): ImportMap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new TypeError("Failed to parse import map: not valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("Import map: top-level value must be a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  let imports: ModuleSpecifierMap = new Map();
  if ("imports" in obj) {
    if (
      typeof obj.imports !== "object" ||
      obj.imports === null ||
      Array.isArray(obj.imports)
    ) {
      throw new TypeError('Import map: "imports" must be a JSON object.');
    }
    imports = sortAndNormalizeSpecifierMap(
      obj.imports as Record<string, unknown>,
      baseURL,
    );
  }

  let scopes: Map<string, ModuleSpecifierMap> = new Map();
  if ("scopes" in obj) {
    if (
      typeof obj.scopes !== "object" ||
      obj.scopes === null ||
      Array.isArray(obj.scopes)
    ) {
      throw new TypeError('Import map: "scopes" must be a JSON object.');
    }
    scopes = sortAndNormalizeScopes(
      obj.scopes as Record<string, unknown>,
      baseURL,
    );
  }

  let integrity: Map<string, string> = new Map();
  if ("integrity" in obj) {
    if (
      typeof obj.integrity !== "object" ||
      obj.integrity === null ||
      Array.isArray(obj.integrity)
    ) {
      throw new TypeError('Import map: "integrity" must be a JSON object.');
    }
    integrity = normalizeModuleIntegrityMap(
      obj.integrity as Record<string, unknown>,
      baseURL,
    );
  }

  for (const key of Object.keys(obj)) {
    if (key !== "imports" && key !== "scopes" && key !== "integrity") {
      warn(`Invalid top-level key "${key}" in import map.`);
    }
  }

  return new ImportMap(imports, scopes, integrity);
}

// ---------------------------------------------------------------------------
// Spec § "merge module specifier maps"
// ---------------------------------------------------------------------------
function mergeSpecifierMaps(
  newMap: ModuleSpecifierMap,
  oldMap: ModuleSpecifierMap,
): ModuleSpecifierMap {
  const merged = new Map(oldMap);
  for (const [specifier, url] of newMap) {
    if (merged.has(specifier)) {
      warn(
        `Import map merge: ignoring duplicate specifier key "${specifier}".`,
      );
      continue;
    }
    merged.set(specifier, url);
  }
  return sortedDescending(merged);
}

// ---------------------------------------------------------------------------
// Spec § "merge existing and new import maps"
//
// Deviation from spec: the spec takes a global object and reads both the import
// map and resolved module set from it. We accept them as explicit parameters so
// the algorithm is not coupled to a browser global — ModuleTSX acts as the
// "global" and passes its own importMap and resolvedModuleSet.
// ---------------------------------------------------------------------------
function mergeExistingAndNewImportMaps(
  oldImportMap: ImportMap,
  newImportMap: ImportMap,
  resolvedModuleSet: ReadonlyArray<SpecifierResolutionRecord>,
): void {
  // Work on deep copies of the new map's data so we can safely delete from them
  const newImportMapScopes = new Map(
    [...newImportMap.scopes.entries()].map(([k, v]) => [k, new Map(v)]),
  );
  const newImportMapImports: ModuleSpecifierMap = new Map(newImportMap.imports);

  // Step: for each scope in the new map, drop any specifier keys that would
  // affect an already-resolved module
  for (const [scopePrefix, scopeImports] of newImportMapScopes) {
    for (const record of resolvedModuleSet) {
      const scopeMatchesRecord =
        scopePrefix === record.serializedBaseURL ||
        (scopePrefix.endsWith("/") &&
          record.serializedBaseURL.startsWith(scopePrefix));

      if (!scopeMatchesRecord) continue;

      for (const specifierKey of [...scopeImports.keys()]) {
        const specifierMatchesRecord =
          specifierKey === record.specifier ||
          (specifierKey.endsWith("/") &&
            record.specifier.startsWith(specifierKey) &&
            (record.specifierAsURL === null ||
              isSpecialURL(record.specifierAsURL)));

        if (specifierMatchesRecord) {
          warn(
            `Import map merge: ignoring scope rule "${specifierKey}" under "${scopePrefix}" — already resolved.`,
          );
          scopeImports.delete(specifierKey);
        }
      }
    }

    if (oldImportMap.scopes.has(scopePrefix)) {
      oldImportMap.scopes.set(
        scopePrefix,
        mergeSpecifierMaps(scopeImports, oldImportMap.scopes.get(scopePrefix)!),
      );
    } else {
      oldImportMap.scopes.set(scopePrefix, scopeImports);
    }
  }

  // Re-sort scopes after mutation
  const resortedScopes = sortedDescending(oldImportMap.scopes);
  oldImportMap.scopes.clear();
  for (const [k, v] of resortedScopes) oldImportMap.scopes.set(k, v);

  // Step: merge integrity (first-wins for conflicts)
  for (const [url, integrity] of newImportMap.integrity) {
    if (oldImportMap.integrity.has(url)) {
      warn(
        `Import map merge: ignoring duplicate integrity entry for "${url}".`,
      );
      continue;
    }
    oldImportMap.integrity.set(url, integrity);
  }

  // Step: drop new global import rules that would affect an already-resolved
  // module. A rule affects a resolved module when its key either matches the
  // resolved specifier exactly, or is a "/"-terminated prefix of it (the same
  // matching used for scope rules above). A bare `startsWith` would be wrong:
  // a resolved "react" would incorrectly drop an unrelated "react-dom" rule.
  for (const record of resolvedModuleSet) {
    for (const specifierKey of [...newImportMapImports.keys()]) {
      const affectsRecord =
        specifierKey === record.specifier ||
        (specifierKey.endsWith("/") &&
          record.specifier.startsWith(specifierKey) &&
          (record.specifierAsURL === null || isSpecialURL(record.specifierAsURL)));

      if (affectsRecord) {
        warn(
          `Import map merge: ignoring global rule "${specifierKey}" — already resolved.`,
        );
        newImportMapImports.delete(specifierKey);
      }
    }
  }

  // Step: merge global imports (first-wins for conflicts)
  const merged = mergeSpecifierMaps(newImportMapImports, oldImportMap.imports);
  oldImportMap.imports.clear();
  for (const [k, v] of merged) oldImportMap.imports.set(k, v);
}

// ---------------------------------------------------------------------------
// Parse all <script type="importmap"> elements from the DOM.
//
// Deviation from spec: the spec merges each new import map against the global's
// live resolved module set at the time of processing. We pass [] because this
// function is called at construction time (before any modules are resolved), so
// no modules can have been resolved yet and the filtering step is a no-op.
// ---------------------------------------------------------------------------
function parseImportMaps(): ImportMap {
  const base = new URL(document.baseURI || location.href);
  const result = new ImportMap();

  for (const script of document.querySelectorAll('script[type="importmap"]')) {
    try {
      const parsed = parseImportMapString(script.textContent || "{}", base);
      mergeExistingAndNewImportMaps(result, parsed, []);
    } catch (error) {
      warn("Failed to parse importmap script:", error);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Spec § "resolve an imports match"
// ---------------------------------------------------------------------------
function resolveImportsMatch(
  normalizedSpecifier: string,
  asURL: URL | null,
  specifierMap: ModuleSpecifierMap,
): URL | null {
  for (const [specifierKey, resolutionResult] of specifierMap) {
    if (specifierKey === normalizedSpecifier) {
      if (resolutionResult === null) {
        throw new TypeError(
          `Resolution of "${specifierKey}" was blocked by a null entry in the import map.`,
        );
      }
      return resolutionResult;
    }

    if (
      specifierKey.endsWith("/") &&
      normalizedSpecifier.startsWith(specifierKey) &&
      (asURL === null || isSpecialURL(asURL))
    ) {
      if (resolutionResult === null) {
        throw new TypeError(
          `Resolution of "${specifierKey}" was blocked by a null entry in the import map.`,
        );
      }
      const afterPrefix = normalizedSpecifier.slice(specifierKey.length);
      let url: URL;
      try {
        url = new URL(afterPrefix, resolutionResult);
      } catch {
        throw new TypeError(
          `Resolution of "${normalizedSpecifier}" was blocked: "${afterPrefix}" could not be URL-parsed relative to "${resolutionResult.href}".`,
        );
      }
      if (!url.href.startsWith(resolutionResult.href)) {
        throw new TypeError(
          `Resolution of "${normalizedSpecifier}" was blocked due to backtracking above its prefix "${specifierKey}".`,
        );
      }
      return url;
    }
  }

  return null;
}

function isSpecialURL(url: URL): boolean {
  return ["ftp:", "file:", "http:", "https:", "ws:", "wss:"].includes(
    url.protocol,
  );
}

// ---------------------------------------------------------------------------
// Spec § "resolve a module specifier" (import-map portion only)
//
// Deviation from spec: returns undefined when the specifier is not remapped by
// the import map rather than throwing a TypeError. The caller (ModuleTSX) falls
// back to its CDN resolver for bare specifiers not covered by the import map.
//
// The caller is responsible for appending the returned SpecifierResolutionRecord
// to the resolved module set (spec § "add module to resolved module set").
// ---------------------------------------------------------------------------
function resolveFromImportMap(
  specifier: string,
  importMap: ImportMap,
  baseURL: string | URL,
): { url: string; record: SpecifierResolutionRecord } | undefined {
  const base = typeof baseURL === "string" ? new URL(baseURL) : baseURL;
  const asURL = resolveURLLikeModuleSpecifier(specifier, base);
  const normalizedSpecifier = asURL !== null ? asURL.href : specifier;
  const serializedBaseURL = base.href;

  for (const [scopePrefix, scopeImports] of importMap.scopes) {
    if (
      scopePrefix === serializedBaseURL ||
      (scopePrefix.endsWith("/") && serializedBaseURL.startsWith(scopePrefix))
    ) {
      const match = resolveImportsMatch(
        normalizedSpecifier,
        asURL,
        scopeImports,
      );
      if (match !== null) {
        return {
          url: match.href,
          record: {
            serializedBaseURL,
            specifier: normalizedSpecifier,
            specifierAsURL: asURL,
          },
        };
      }
    }
  }

  const match = resolveImportsMatch(
    normalizedSpecifier,
    asURL,
    importMap.imports,
  );
  if (match !== null) {
    return {
      url: match.href,
      record: {
        serializedBaseURL,
        specifier: normalizedSpecifier,
        specifierAsURL: asURL,
      },
    };
  }

  return undefined;
}

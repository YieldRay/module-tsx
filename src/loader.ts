type Awaitable<T> = T | Promise<T>;

/**
 * @param sourceUrl full URL of the source file
 * @param sourceCode raw source code
 * @returns raw esm code
 */
export type Loader = (sourceUrl: string, sourceCode: string) => Awaitable<string>;

export const cssLoader: Loader = (sourceUrl, _sourceCode) => {
  // _sourceCode is empty string
  const code = `\
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = ${JSON.stringify(sourceUrl)};
document.head.appendChild(link);
`;
  return code;
};

export const cssModuleLoader: Loader = (sourceUrl, sourceCode) => {
  const pathname = new URL(sourceUrl).pathname;
  const filename = pathname.substring(pathname.lastIndexOf("/") + 1) || "index.css";
  const withoutExt = filename.slice(0, filename.indexOf("."));
  // remove all non-alphanumeric characters
  const prefix = withoutExt.replace(/[^a-zA-Z0-9]/g, "_");

  const { map, css } = cssToModule(sourceCode, prefix);

  const code = `\
const style = document.createElement("style");
style.textContent = ${JSON.stringify(css)};
document.head.appendChild(style);

export default ${JSON.stringify(map)};
`;
  return code;
};

function cssToModule(cssString: string, prefix?: string) {
  const sheet = new CSSStyleSheet();
  // Note: Throws if CSS contains @import
  sheet.replaceSync(cssString);
  const jsonMap: Record<string, string> = {};

  const getHash = (name: string): string => {
    const p = prefix ? `${prefix}_` : "";
    if (!jsonMap[name]) jsonMap[name] = `${p}${name}_${Math.random().toString(36).slice(2, 7)}`;
    return jsonMap[name];
  };

  const processRules = (ruleList: CSSRuleList): void => {
    for (const rule of ruleList) {
      if (rule instanceof CSSStyleRule) {
        const newSelector = rule.selectorText.replace(/\.([a-zA-Z_][\w-]*)/g, (_match, className) => {
          return `.${getHash(className)}`;
        });
        rule.selectorText = newSelector;
      } else if (rule instanceof CSSGroupingRule) {
        processRules(rule.cssRules);
      }
    }
  };

  processRules(sheet.cssRules);

  const css = Array.from(sheet.cssRules)
    .map((rule) => rule.cssText)
    .join("\n");

  return {
    css,
    map: jsonMap,
  };
}

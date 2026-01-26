type Awaitable<T> = T | Promise<T>;

/**
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

function cssToModule(cssString: string, prefix: string = "style") {
  const sheet = new CSSStyleSheet();
  // Note: Throws if CSS contains @import
  sheet.replaceSync(cssString);
  const jsonMap: Record<string, string> = {};

  const getHash = (name: string): string => {
    if (!jsonMap[name]) jsonMap[name] = `${prefix}_${name}_${Math.random().toString(36).slice(2, 7)}`;
    return jsonMap[name];
  };

  // recursively modify rules
  const processRules = (ruleList: CSSRuleList): void => {
    Array.from(ruleList).forEach((rule: CSSRule) => {
      // TYPE 1: CSSStyleRule (e.g., .class { ... })
      if (rule.type === 1) {
        // 1 is CSSRule.STYLE_RULE
        const styleRule = rule as CSSStyleRule;
        // Regex: Find dots followed by valid class identifier chars
        const newSelector = styleRule.selectorText.replace(/\.([a-zA-Z_][\w-]*)/g, (_match, className) => {
          return `.${getHash(className)}`;
        });
        styleRule.selectorText = newSelector;
      }

      // TYPE 4: Media Rule / TYPE 12: Supports Rule
      // These rules "group" other rules inside them
      else if (
        (rule.type === 4 || rule.type === 12) && // 4=MEDIA, 12=SUPPORTS
        (rule as CSSGroupingRule).cssRules
      ) {
        const groupingRule = rule as CSSGroupingRule;
        processRules(groupingRule.cssRules);
      }
    });
  };

  processRules(sheet.cssRules);

  const transformedCss = Array.from(sheet.cssRules)
    .map((rule) => rule.cssText)
    .join("\n");

  return {
    css: transformedCss,
    map: jsonMap,
  };
}

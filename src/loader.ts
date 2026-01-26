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

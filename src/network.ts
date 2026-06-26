import { ModuleTSXError } from "./error.ts";

export async function fetchResponse(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (cause) {
    throw new ModuleTSXError(
      `Failed to fetch module ${url}: Network error`,
      { cause },
    );
  }
  if (!res.ok) {
    throw new ModuleTSXError(
      `Failed to fetch module ${url}: ${res.status} ${res.statusText}`,
    );
  }
  return res;
}

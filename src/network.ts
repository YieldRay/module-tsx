import { ModuleTSXError } from "./error.ts";

export async function fetchResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // default fetch behavior, the next step we may support cache
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new ModuleTSXError(`Failed to fetch resource ${res.url}: ${res.status}`);
  }
  return res;
}

import { ModuleTSXError } from "./error.ts";

export async function fetchResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new ModuleTSXError(`Failed to fetch resource ${res.url}: ${res.status}`);
  }
  return res;
}

export async function fetchText(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  const res = await fetchResponse(input, init);
  return res.text();
}

export async function fetchESModule(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  const res = await fetchResponse(input, init);
  // Skip content-type check for .ts/.tsx files
  return res.text();
}

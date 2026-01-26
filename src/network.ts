export async function fetchResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new Error(`Failed to fetch resource ${res.url}: ${res.status}`);
  }
  return res;
}

export async function fetchText(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  const res = await fetchResponse(input, init);
  return res.text();
}

export async function fetchESModule(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  const res = await fetchResponse(input, init);
  // the HTML spec will check content-type
  // but since the extension is .ts or .tsx, we can only skip that check here
  return res.text();
}

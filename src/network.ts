export async function fetchModule(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new Error(`Failed to fetch module ${res.url}: ${res.status}`);
  }
  return res.text();
}

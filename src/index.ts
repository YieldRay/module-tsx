import { fetchESModule } from "./network.ts";
import { transformSourceModule } from "./op.ts";

const transformESModule = (sourceUrl: string, sourceCode: string) =>
  transformSourceModule("esm", sourceUrl, sourceCode);

export async function import$(sourceUrl: string) {
  const code = await fetchESModule(sourceUrl);
  const blobUrl = await transformESModule(sourceUrl, code);
  return import(blobUrl);
}

const TYPE_ATTRIBUTE_VALUE = "module-tsx";

async function runScript(script: HTMLScriptElement): Promise<void> {
  const blobUrl = script.src
    ? await transformESModule(
        script.src,
        await fetchESModule(script.src, {
          priority: script.fetchPriority,
        }),
      )
    : await transformESModule(location.href, script.innerHTML);

  return import(blobUrl);
}

async function sideEffect() {
  for (const s of Array.from(document.querySelectorAll(`script[type="${TYPE_ATTRIBUTE_VALUE}"]`))) {
    const script = s as HTMLScriptElement;

    if (!script.async && script.defer) {
      console.warn(
        `script with type="${TYPE_ATTRIBUTE_VALUE}" does not support defer attribute. Use async or no attribute instead.`,
      );
    }
    for (const key in ["integrity", "crossorigin"] as (keyof HTMLScriptElement)[]) {
      if (script[key]) {
        console.warn(`script with type="${TYPE_ATTRIBUTE_VALUE}" does not support ${key} attribute.`);
      }
    }

    if (script.async) {
      runScript(script);
    } else {
      await runScript(script);
    }
  }
}

document.addEventListener("DOMContentLoaded", sideEffect);

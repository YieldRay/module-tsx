import { fetchModule } from "./network.ts";
import { transformSourceModule } from "./op.ts";

export { transformSourceModule };

const TYPE_ATTRIBUTE_VALUE = "module-tsx";

async function runScript(script: HTMLScriptElement): Promise<void> {
  const blobUrl = script.src
    ? await transformSourceModule(
        script.src,
        await fetchModule(script.src, {
          priority: script.fetchPriority,
        }),
      )
    : await transformSourceModule(location.href, script.innerHTML);

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

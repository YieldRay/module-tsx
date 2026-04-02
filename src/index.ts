import { ModuleTSX } from "./module-tsx.ts";
import { ModuleTSXError, warn } from "./error.ts";

export { ModuleTSX, ModuleTSXError };

/**
 * The singleton global instance of ModuleTSX.
 */
export const instance = new ModuleTSX();

const TYPE_ATTRIBUTE_VALUE = "module-tsx";
async function sideEffect() {
  const importScript = async (script: HTMLScriptElement) => {
    const src = script.src;
    if (src) {
      return instance.import(src);
    } else {
      const code = script.innerHTML || "";
      return instance.importCode(document.location.href, code);
    }
  };

  for (const s of Array.from(document.querySelectorAll(`script[type="${TYPE_ATTRIBUTE_VALUE}"]`))) {
    const script = s as HTMLScriptElement;

    if (!script.async && script.defer) {
      warn(
        `script with type="${TYPE_ATTRIBUTE_VALUE}" does not support defer attribute. Use async or no attribute instead.`,
      );
    }
    for (const key in ["integrity", "crossorigin"] as (keyof HTMLScriptElement)[]) {
      if (script[key as keyof HTMLScriptElement]) {
        warn(`script with type="${TYPE_ATTRIBUTE_VALUE}" does not support ${key} attribute.`);
      }
    }

    if (script.async) {
      importScript(script);
    } else {
      await importScript(script);
    }
  }
}

/**
 * Since this module can be loaded as both ESM and UMD, we listen for DOMContentLoaded to ensure all type="module-tsx" tags are present.
 * ESM scripts are always deferred, so the document is already fully parsed when this module executes and the listener fires immediately.
 * Classic scripts run inline as the parser encounters them, so they must wait for DOMContentLoaded.
 */
document.addEventListener("DOMContentLoaded", sideEffect);

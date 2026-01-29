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
      if (script[key]) {
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

document.addEventListener("DOMContentLoaded", sideEffect);

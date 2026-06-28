export * from "./index.ts";
import { instance } from "./index.ts";
import { setupErrorOverlay } from "./error-overlay.ts";

setupErrorOverlay(instance);

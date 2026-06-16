import fs from "node:fs";
import type { ContextCanvasDocument } from "../../shared/domain.ts";
import { CANVAS_SIDECAR, canvasSidecarPath } from "./paths.ts";

export function readBundleDocument(bundleRoot: string): ContextCanvasDocument | undefined {
  const sidecarPath = canvasSidecarPath(bundleRoot);
  if (!fs.existsSync(sidecarPath)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(sidecarPath, "utf8")) as ContextCanvasDocument;
}

export function writeBundleDocument(bundleRoot: string, document: ContextCanvasDocument): void {
  fs.writeFileSync(canvasSidecarPath(bundleRoot), `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

export { CANVAS_SIDECAR };

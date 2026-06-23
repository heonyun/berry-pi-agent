import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadEnvFile } from "./load-env.mjs";

test("loadEnvFile reads KEY=VALUE without overriding existing env", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-env-"));
  const filePath = path.join(dir, ".env.local");
  fs.writeFileSync(filePath, "DEEPSEEK_API_KEY=from-file\n# comment\nEMPTY=\n", "utf8");
  process.env.DEEPSEEK_API_KEY = "from-shell";
  try {
    loadEnvFile(filePath);
    assert.equal(process.env.DEEPSEEK_API_KEY, "from-shell");
    delete process.env.DEEPSEEK_API_KEY;
    loadEnvFile(filePath);
    assert.equal(process.env.DEEPSEEK_API_KEY, "from-file");
    assert.equal(process.env.EMPTY, "");
  } finally {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.EMPTY;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

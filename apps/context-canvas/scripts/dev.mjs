import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(root, "..");
const contextCanvasToken = process.env.CONTEXT_CANVAS_TOKEN || crypto.randomBytes(32).toString("hex");

function run(command, args, name) {
  const child = spawn(command, args, {
    cwd: appRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      CONTEXT_CANVAS_TOKEN: contextCanvasToken,
      VITE_CONTEXT_CANVAS_TOKEN: contextCanvasToken,
    },
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[${name}] exited via ${signal}`);
    } else if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  return child;
}

const server = run("npx", ["tsx", "src/server/index.ts"], "server");
const vite = run("npx", ["vite"], "vite");

function shutdown() {
  server.kill();
  vite.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

import { build } from "esbuild";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../adapters/", import.meta.url).pathname;
const forbiddenParser = /\b(fetch|setEphemeralCookie|credentials|eval|Function|globalThis|process)\b/;
const importPattern = /(?:import\s+(?:[\s\S]*?\s+from\s+)?|import\s*\()(['"])(.*?)\1/g;

for (const adapterId of readdirSync(root)) {
  const dir = join(root, adapterId);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const source = readFileSync(join(dir, manifest.runtime?.entry ?? "index.js"), "utf8");

  for (const match of source.matchAll(importPattern)) {
    if (match[2] !== "elecon:html") {
      throw new Error(`${adapterId}: import '${match[2]}' 不在允许白名单（仅 elecon:html）`);
    }
  }
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
  if (manifest.mode === "parser" && forbiddenParser.test(code)) {
    throw new Error(`${adapterId}: parser 包含网络、凭证或动态执行 API（AST/源码越权闸门）`);
  }

  await build({
    stdin: { contents: source, sourcefile: `${adapterId}/${manifest.runtime?.entry ?? "index.js"}` },
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    external: ["elecon:html"],
    logLevel: "silent",
  });
  console.log(`✓ ${adapterId}: compile/import/policy`);
}

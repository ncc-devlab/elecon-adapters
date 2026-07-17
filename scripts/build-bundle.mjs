import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const adapterArg = process.argv.find((arg) => arg.startsWith("--adapter="))?.split("=")[1];
if (!adapterArg) throw new Error("用法：npm run bundle -- --adapter=school-xidian");
const dir = resolve("adapters", adapterArg);
const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
const files = [];
for (const name of ["manifest.json", manifest.runtime?.entry ?? "index.js"]) {
  const bytes = await readFile(join(dir, name));
  const content = bytes.toString("utf8").replace(/\r\n/g, "\n").normalize("NFC");
  files.push({ path: name, encoding: "utf-8", content });
}
files.sort((a, b) => a.path.localeCompare(b.path));
const envelope = { bundleFormat: "elecon-bundle/1", files };
const payload = Buffer.from(JSON.stringify(envelope));
const digest = createHash("sha256")
  .update(Buffer.concat(files.map((file) => createHash("sha256").update(file.content).digest())))
  .digest("hex");
const outDir = resolve("dist/bundles");
await mkdir(outDir, { recursive: true });
const stem = `${manifest.adapterId}-${manifest.adapterVersion}`;
await writeFile(join(outDir, `${stem}.json`), `${JSON.stringify(envelope, null, 2)}\n`);
await writeFile(join(outDir, `${stem}.json.gz`), gzipSync(payload, { mtime: 0 }));
await writeFile(join(outDir, `${stem}.sha256`), `${digest}  ${stem}.json\n`);
console.log(`✓ ${stem}: ${digest}`);

import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const catalogPath = "dist/catalog.json";
if (process.argv.includes("--write")) {
  const baseUrl = process.env.CATALOG_BASE_URL;
  if (!baseUrl) throw new Error("生成 catalog 需要 CATALOG_BASE_URL，例如 https://cdn.example/adapters");
  const entries = [];
  for (const adapterId of readdirSync("adapters")) {
    const manifest = JSON.parse(readFileSync(join("adapters", adapterId, "manifest.json"), "utf8"));
    const stem = `${manifest.adapterId}-${manifest.adapterVersion}`;
    const digestPath = join("dist", "bundles", `${stem}.sha256`);
    if (!existsSync(digestPath)) throw new Error(`缺少 ${digestPath}，请先 npm run bundle -- --adapter=${adapterId}`);
    const digest = readFileSync(digestPath, "utf8").split(/\s+/)[0];
    entries.push({
      adapterId: manifest.adapterId,
      adapterVersion: manifest.adapterVersion,
      digest,
      url: `${baseUrl.replace(/\/$/, "")}/${stem}.json.gz`,
      capabilities: manifest.capabilities.map((capability) => capability.id),
      ...(manifest.runtime?.stdlibMin ? { stdlibMin: manifest.runtime.stdlibMin } : {}),
    });
  }
  const catalog = {
    catalogVersion: "1.0",
    sequence: Number(process.env.CATALOG_SEQUENCE ?? 0),
    issuedAt: new Date().toISOString(),
    ttlSeconds: Number(process.env.CATALOG_TTL_SECONDS ?? 3600),
    entries,
  };
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`✓ wrote ${catalogPath}`);
  process.exit(0);
}
if (!existsSync(catalogPath)) {
  console.log("ℹ 未发现 dist/catalog.json；签名发布前由核心流水线生成，跳过本地 catalog 校验");
  process.exit(0);
}
const ajv = new Ajv({ strict: false });
addFormats(ajv);
const schema = JSON.parse(readFileSync("vendor/contract/catalog.schema.json", "utf8"));
const validate = ajv.compile(schema);
const valid = validate(JSON.parse(readFileSync(catalogPath, "utf8")));
if (!valid) {
  console.error(ajv.errorsText(validate.errors));
  process.exit(1);
}
const registry = JSON.parse(readFileSync("vendor/contract/capability/registry.json", "utf8")).capabilities;
for (const entry of JSON.parse(readFileSync(catalogPath, "utf8")).entries) {
  for (const capability of entry.capabilities) {
    if (!registry[capability]) throw new Error(`catalog: 未注册 capability '${capability}'`);
  }
}
console.log(`✓ catalog: ${JSON.parse(readFileSync(catalogPath, "utf8")).entries.length} entries`);

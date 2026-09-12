import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 本地 catalog 生成 / 校验。
 *
 * `digest` 取自 `npm run bundle` 的 `.sha256`，为 **elecon-bundle/2** digest
 * （`SHA-256(envelopeBytes)`，ADR-018 §2.9.1），与核心 signer 一致。
 *
 * **catalog 只描述文件、不描述端点（ADR-018 §2.5.1，2026-09-11）**：entry 不再写 `url`。
 * 签名后的传输封套由客户端按 `<base>/bundles/<digest>.json.gz` 内容寻址拉取，分发 base URL
 * 由客户端自持，与 catalog 无关——因此本脚本不再需要 `CATALOG_BASE_URL`。
 *
 * 本地 catalog 未签名，仅供离线自查；发布用的 signed catalog 由核心流水线生成（ADR-018 §2.8）。
 * `--check` 见到历史 catalog 里残留的 `url` 只告警（对齐核心 validator K3_deprecated_url），
 * 下一次签名仪式后 schema 删字段，届时转为拒绝。
 */
const catalogPath = "dist/catalog.json";
if (process.argv.includes("--write")) {
  if (process.env.CATALOG_BASE_URL) {
    console.warn("⚠ CATALOG_BASE_URL 已无作用：catalog 不再描述端点（ADR-018 §2.5.1），已忽略");
  }
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
  if ("url" in entry) {
    console.warn(
      `⚠ K3_deprecated_url: ${entry.adapterId}@${entry.adapterVersion} 带已弃用的 url（catalog 只描述文件，ADR-018 §2.5.1）；请重跑 npm run catalog`,
    );
  }
  for (const capability of entry.capabilities) {
    if (!registry[capability]) throw new Error(`catalog: 未注册 capability '${capability}'`);
  }
}
console.log(`✓ catalog: ${JSON.parse(readFileSync(catalogPath, "utf8")).entries.length} entries`);

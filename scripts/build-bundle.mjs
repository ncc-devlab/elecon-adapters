/**
 * 本地 unsigned bundle 构建（ADR-018 §2.9 / §2.9.1 digest v2）—— 产出 **bundle 信封**与其 digest。
 *
 * 术语（ADR-000 §2.3.1）：本文件所称 envelope / 信封一律指 **bundle 信封**——adapter 包的
 * 清单 + 签名对象。它与运行期包裹归一化数据的 **数据信封**（`elecon.envelope`，ADR-001 §3.3）
 * 无关，只是撞名。本仓不产出数据信封。
 *
 * **本脚本不签名**：私钥与 signer 属私有核心（ADR-002 §2.3 / ADR-018 §2.8），公开仓永不持有。
 *
 * ## digest v2（`elecon-bundle/2`）
 *
 * envelope 从「容器」降为「清单」：只放 descriptor（`path` / `size` / `sha256` + 顶层身份），
 * 文件字节改由**按内容哈希寻址**的 blob 表承载。
 *
 *     digest = SHA-256( envelopeBytes )        // envelopeBytes = UTF-8(JSON(envelope))
 *
 * v1 的缺陷是 digest 只哈希「按路径排序后的**内容**」，**路径自身不进哈希** → 保序重命名不改
 * digest，而加载器按路径取入口与 `masker.json`，于是 official 签名可背书「受审时无害的资产文件被执行」。
 * v2 把路径、长度与内容一起钉进被签字节，从根上关掉这条路。
 *
 * ## 与核心 signer 的一致性
 *
 * 核心侧 digest v2 已落地（`tools/src/bundle/envelope.ts`、`tools/src/signer/index.ts`、
 * `client/lib/core/loader/bundle.dart` 均为 `elecon-bundle/2`），**两侧 digest 一致**，
 * ADR-018 §2.10 门 1 第 5 项的「digest 预检」自此成立——本脚本的输出可直接与离线签发的实物比对。
 *
 * 这条一致性是**本脚本存在的全部理由**，因此以下规则必须与核心逐字保持同步；核心侧改动后须复核：
 *
 *   本文件                | 核心
 *   ---------------------|------------------------------------------
 *   BUNDLE_INCLUDE       | signer/index.ts BUNDLE_INCLUDE
 *   BUNDLE_EXCLUDE       | signer/index.ts BUNDLE_EXCLUDE（含 i 标志）
 *   RE_SEGMENT           | bundle/envelope.ts RE_SEGMENT
 *   assertCanonical      | signer/index.ts assertCanonical
 *   assertPathHygiene    | bundle/envelope.ts assertPathHygiene
 *   serializeEnvelope    | bundle/envelope.ts serializeEnvelope
 *   walkAdapter          | signer/index.ts collectBundleFiles(assertFullCommitment)
 *
 * **签发侧不得比验端宽**：任何一条本侧放行、核心拒签的输入，都会表现为「贡献者本地绿、
 * 进核心流水线才红」，是最难查的一类不一致。宁可本侧更严。
 *
 * 用法：npm run bundle -- --adapter=school-xidian
 */

import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const BUNDLE_FORMAT = "elecon-bundle/2";

/** 参与签名的文件扩展名（核心 signer BUNDLE_INCLUDE）。 */
const BUNDLE_INCLUDE = /\.(json|js|mjs|ts|html?|css|txt|svg|png)$/i;

/**
 * **显式**排除名单——v2 下这是唯一合法的「不进 envelope」理由。
 *
 * §2.9.1 签发侧硬约束：`buildEnvelope` 对目录做**全量文件承诺**，目录内存在未进 envelope 的文件
 * 即**拒签**，取代 BUNDLE_INCLUDE 的静默剔除。故文档（`*.md`）必须在此显式列出，而不是靠
 * 「扩展名不在 INCLUDE 里」被悄悄丢掉。排除名单本身进版本控制，即为其审计记录。
 *
 * `i` 标志与 BUNDLE_INCLUDE 一致：没有它，`README.MD` 既不匹配 INCLUDE、也不匹配 EXCLUDE，
 * 会撞上「全量文件承诺失败」而非被排除。
 */
const BUNDLE_EXCLUDE = /(^|\/)(signature\.json|node_modules|\.git|fixtures)(\/|$)|\.md$/i;

/**
 * 合法路径段：`[A-Za-z0-9._-]`，至少一字符（核心 `envelope.ts` 的 `RE_SEGMENT`）。
 *
 * **为何是白名单而非逐类黑名单**：本侧靠 `String.normalize("NFC")` 拒非 NFC 路径，而 🔒 Dart
 * 加载器**无内建 Unicode NFC**。若两端对同一份 bundle 给出不同判定，就是跨语言实现漂移
 * （ADR-002 §3 风险 5），且方向是 fail-open。该字符集内不存在非 NFC 形式，也不存在同形异码与
 * RTL override 之类的显示欺骗，于是「要不要做 NFC」在两端都不再是问题。
 *
 * 对本仓的意义：**签发侧必须与验端一样严**。少了这条，本仓能构建出核心拒签的 envelope——
 * 贡献者本地绿、进核心流水线才红，是最难查的一类不一致。
 */
const RE_SEGMENT = /^[A-Za-z0-9._-]+$/;

const adapterArg = process.argv.find((arg) => arg.startsWith("--adapter="))?.split("=")[1];
if (!adapterArg) throw new Error("用法：npm run bundle -- --adapter=school-xidian");
const dir = resolve("adapters", adapterArg);

const sha256hex = (buf) => createHash("sha256").update(buf).digest("hex");

/**
 * 递归遍历 adapter 目录，返回 { committed, excluded }。
 *
 * 硬约束：**禁符号链接**、**禁路径越界**、字典序用**码位序**（`Array#sort` 默认比较，
 * 不是 `localeCompare`——后者随 locale 漂移，而顺序直接进 envelopeBytes）。
 */
function walkAdapter(root) {
  const committed = [];
  const excluded = [];
  const realRoot = realpathSync(root);
  const walk = (d) => {
    if (lstatSync(d).isSymbolicLink()) throw new Error(`bundle 禁止符号链接：${d}`);
    for (const entry of readdirSync(d).sort()) {
      const p = join(d, entry);
      // 不做反斜杠→斜杠归一：POSIX 下文件名可以含字面反斜杠，归一会把它变成路径分隔符，
      // 于是本侧放行、核心的卫生闸门（禁反斜杠）拒签——又一处「签发侧比验端宽」。
      // 原样保留，交给 assertPathHygiene 按与核心相同的规则裁决。
      const rel = relative(root, p);
      const stat = lstatSync(p);
      if (stat.isSymbolicLink()) throw new Error(`bundle 禁止符号链接：${p}`);
      if (BUNDLE_EXCLUDE.test(rel)) {
        excluded.push(rel);
        continue;
      }
      if (relative(realRoot, realpathSync(p)).startsWith("..")) throw new Error(`bundle 路径越界：${p}`);
      if (stat.isDirectory()) walk(p);
      else if (stat.isFile()) committed.push(rel);
    }
  };
  walk(root);
  return { committed: committed.sort(), excluded: excluded.sort() };
}

/**
 * 路径卫生闸门（§2.9.1 验证顺序第 8 步的签发侧对偶）。
 *
 * 签名只证明发布者确实想要这些路径，**不证明路径安全**。签发侧先过一遍同样的闸门，
 * 才不会签出一个注定在加载期被拒（或更糟：在某个平台上被接受）的 bundle。
 */
function assertPathHygiene(paths) {
  const seen = new Set();
  for (const p of paths) {
    const bad = (why) => {
      throw new Error(`路径卫生闸门拒绝 '${p}'：${why}（§2.9.1 第 8 步）`);
    };
    if (p === "") bad("空路径");
    if (p.includes("\0")) bad("含 NUL");
    if (p.includes("\\")) bad("含反斜杠");
    if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) bad("绝对路径");
    if (p.endsWith("/")) bad("尾随分隔符");
    for (const seg of p.split("/")) {
      if (seg === "" || seg === "." || seg === "..") bad(`非法路径段 ${JSON.stringify(seg)}`);
      // 字符集白名单（而非逐类黑名单）：反斜杠、NUL、非 ASCII 全落在这一条里。
      if (!RE_SEGMENT.test(seg)) bad(`路径段 ${JSON.stringify(seg)} 含 [A-Za-z0-9._-] 之外的字符`);
    }
    if (p.normalize("NFC") !== p) bad("路径非 NFC");
    if (seen.has(p)) bad("重复路径");
    seen.add(p);
  }
}

/**
 * 内容规范化闸门：UTF-8 NFC + LF 换行。
 *
 * v2 起由「静默改写」改为 **不符即拒签**（§2.9.1）——改写会让「审的字节」与「盘上字节」分叉，
 * 贡献者审的是自己文件里的 CRLF 版本，签的却是脚本改写后的版本。拒绝把这个差异推回贡献者解决。
 */
function assertCanonical(rel, raw) {
  const text = raw.toString("utf-8");
  if (!Buffer.from(text, "utf-8").equals(raw)) return raw; // 真二进制资产，不做文本规范化
  if (/\r/.test(text)) {
    throw new Error(`'${rel}' 含 CR（CRLF 或裸 CR）→ 拒签。请转成 LF 换行后重试（§2.9.1）。`);
  }
  if (text.normalize("NFC") !== text) {
    throw new Error(`'${rel}' 内容非 NFC → 拒签。请以 Unicode NFC 保存后重试（§2.9.1）。`);
  }
  return raw;
}

/**
 * 确定性序列化器：**固定键序、无多余空白**（§2.9.1 落地清单 item 1）。
 *
 * 不用 `JSON.stringify(obj)` 直接序列化对象字面量——那依赖属性插入顺序这一隐式契约，
 * 重构时会静默漂移，而 envelopeBytes 的每一个字节都进 digest。这里把键序写死。
 */
function serializeEnvelope(env) {
  const files = env.files.map((f) => ({ path: f.path, size: f.size, sha256: f.sha256 }));
  return Buffer.from(
    JSON.stringify({
      bundleFormat: env.bundleFormat,
      adapterId: env.adapterId,
      adapterVersion: env.adapterVersion,
      files,
    }),
    "utf-8",
  );
}

/** 从 adapter 目录构建 v2 envelope + blob 表。 */
function buildEnvelope(root) {
  const { committed, excluded } = walkAdapter(root);
  assertPathHygiene(committed);

  const uncovered = committed.filter((rel) => !BUNDLE_INCLUDE.test(rel));
  if (uncovered.length > 0) {
    throw new Error(
      `全量文件承诺失败：以下文件既未进 envelope、也不在 BUNDLE_EXCLUDE 显式排除名单里 → 拒签（§2.9.1）：\n` +
        uncovered.map((r) => `    ${r}`).join("\n") +
        `\n  要么把它做成运行时文件，要么在 scripts/build-bundle.mjs 的 BUNDLE_EXCLUDE 里显式排除。`,
    );
  }

  const blobs = {};
  const files = committed.map((rel) => {
    const raw = assertCanonical(rel, readFileSync(join(root, rel)));
    const hash = sha256hex(raw);
    blobs[hash] = raw.toString("base64");
    return { path: rel, size: raw.length, sha256: hash };
  });

  // 身份取自 manifest.json 内容，**不接受调用方传入**（§2.9 身份绑定）：manifest.json 在 digest
  // 覆盖范围内，故身份与内容结构性绑定，不设二源。
  const manifestEntry = files.find((f) => f.path === "manifest.json");
  if (!manifestEntry) throw new Error("bundle 缺 manifest.json → 无法确定权威身份（fail-closed）。");
  const manifest = JSON.parse(Buffer.from(blobs[manifestEntry.sha256], "base64").toString("utf-8"));
  if (!manifest.adapterId || !manifest.adapterVersion) {
    throw new Error("manifest.json 缺 adapterId/adapterVersion（fail-closed）。");
  }

  return {
    envelope: {
      bundleFormat: BUNDLE_FORMAT,
      adapterId: manifest.adapterId,
      adapterVersion: manifest.adapterVersion,
      files,
    },
    blobs,
    excluded,
  };
}

/** blob 集合精确相等（§2.9.1 第 9 步）：descriptor 的 sha256 集合 ↔ blob 键集合一一对应。 */
function assertBlobSetExact(envelope, blobs) {
  const want = new Set(envelope.files.map((f) => f.sha256));
  const have = new Set(Object.keys(blobs));
  for (const h of want) if (!have.has(h)) throw new Error(`blob 缺失：${h}（§2.9.1 第 9 步）`);
  for (const h of have) if (!want.has(h)) throw new Error(`blob 夹带：${h} 未被任何 descriptor 引用（§2.9.1 第 9 步）`);
}

/** 逐文件回验：按 size 界定 → 解码 → 长度精确相等 → SHA-256 命中（§2.9.1 第 10 步）。 */
function assertFilesResolve(envelope, blobs) {
  for (const f of envelope.files) {
    const bytes = Buffer.from(blobs[f.sha256], "base64");
    if (bytes.length !== f.size) throw new Error(`'${f.path}' 长度 ${bytes.length} ≠ descriptor 声明的 ${f.size}`);
    if (sha256hex(bytes) !== f.sha256) throw new Error(`'${f.path}' 内容哈希与 descriptor 不符`);
  }
}

const { envelope, blobs, excluded } = buildEnvelope(dir);
assertBlobSetExact(envelope, blobs);
assertFilesResolve(envelope, blobs);

const envelopeBytes = serializeEnvelope(envelope);
const digest = sha256hex(envelopeBytes);

// 传输封套（wire wrapper）：`{ envelopeB64, signature, blobs }` 三字段、严格封闭。
// 本仓无签名能力，故只产出前两项 —— 这是**未签名交接物**，不是可加载的传输封套；
// `signature` 由私有核心离线补齐后才成为完整封套。
const handoff = { envelopeB64: envelopeBytes.toString("base64"), blobs };

const outDir = resolve("dist/bundles");
await mkdir(outDir, { recursive: true });
const stem = `${envelope.adapterId}-${envelope.adapterVersion}`;

// **只写 envelopeBytes 本身**，不另写一份 pretty-print 版本：v2 下 digest 覆盖的就是这串字节，
// 同时存在「好看的一份」和「被签的一份」正是 §3 风险 (e)「所见非所签」的温床。
await writeFile(join(outDir, `${stem}.envelope.json`), envelopeBytes);
await writeFile(join(outDir, `${stem}.unsigned.json.gz`), gzipSync(Buffer.from(JSON.stringify(handoff)), { mtime: 0 }));
await writeFile(join(outDir, `${stem}.sha256`), `${digest}  ${stem}.envelope.json\n`);

console.log(`✓ ${stem}  ${BUNDLE_FORMAT}`);
console.log(`  digest ${digest}  (= SHA-256 of ${stem}.envelope.json, ${envelopeBytes.length} B)`);
console.log(`  签名覆盖 ${envelope.files.length} 个文件：`);
for (const f of envelope.files) console.log(`    ${f.path}  ${f.size} B  ${f.sha256.slice(0, 16)}…`);
if (excluded.length > 0) console.log(`  显式排除（BUNDLE_EXCLUDE）：${excluded.join(", ")}`);
console.log("  ⚠ 未签名：发布签名由私有核心离线完成（ADR-018 §2.8）。");

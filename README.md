# elecon-adapters

elecon 的社区 adapter 仓库。学校 adapter 在此创作和静态校验；发布前由维护流程完成复核、签名与分发。

- 贡献指南：[CONTRIBUTING.md](./CONTRIBUTING.md)
- `adapters/`：各校 adapter
- `vendor/`：只读的契约、标准库和静态校验器副本，见 [`vendor/MIRROR.md`](./vendor/MIRROR.md)

## 本地校验

```bash
npm install
npm run check   # validate（manifest/schema）+ scan（PII/凭证等价物脱敏）
```

> 本仓库不保存签名密钥。提交内容在发布前必须通过维护者复核并完成签名。

## 发布链路

```text
社区 PR → 静态检查 → 维护者复核 → bundle/digest
         → 签名 → catalog/CDN 分发 → 客户端验签加载
```

本仓库只负责源代码、脱敏 fixture 和 unsigned bundle。`npm run bundle -- --adapter=...` 按
ADR-018 §2.9.1 的 **digest v2**（`elecon-bundle/2`）生成 **bundle 信封**（签名对象）与其 digest，
不能替代发布签名。产物：

| 文件 | 是什么 |
|---|---|
| `<stem>.envelope.json` | **被签的那串字节本身**（确定性序列化，固定键序、无多余空白）。`sha256sum` 它即得 digest |
| `<stem>.unsigned.json.gz` | 未签名交接物 `{ envelopeB64, blobs }`。补上 `signature` 后才是完整的**传输封套** |
| `<stem>.sha256` | `digest = SHA-256(envelopeBytes)` |

envelope 只放 descriptor（`path` / `size` / `sha256` + 顶层身份），文件字节由**按内容哈希寻址**的
blob 表承载；路径、长度与内容因此一起进签名范围。脚本在本地即执行签发侧闸门：**全量文件承诺**
（目录内未进 envelope 又不在显式排除名单里的文件 → 拒签）、**路径卫生**、**NFC + LF 不符即拒签**
（不再静默改写）、blob 集合精确相等与逐文件回验。

该 digest 与核心 signer 算出的**逐字节一致**，故 ADR-018 §2.10 门 1 第 5 项的「digest 预检」
（**防「审的和签的不是同一字节」**）成立：本地输出可直接与离线签发的实物比对。文件收集、排除名单、
路径段字符集、NFC/LF 断言与序列化器逐条对应核心的哪个函数，写在 `scripts/build-bundle.mjs` 头部。

> 路径段限 `[A-Za-z0-9._-]`：adapter 内文件名不得使用非 ASCII。这不是风格偏好——🔒 Dart 加载器
> 无内建 Unicode NFC，字符集若放宽，两端卫生闸门会对同一份 bundle 给出不同判定（fail-open 方向）。

`npm run check` 还会执行 JS 编译、`elecon:html` import 白名单、纯解析（declarative）越权规则和存在时的
`dist/catalog.json` schema/registry 校验。

校验工具依赖 `typescript`（Apache-2.0）解析 JavaScript AST、`esbuild`（MIT）执行编译检查；
二者仅用于开发/CI，不进入 adapter bundle 或客户端发布产物（红线 #9）。

> 术语（`requestGraph` / `bind`·`compute`·`inject`）已按核心仓 ADR-022 / ADR-023 更新，见
> [CONTRIBUTING.md](./CONTRIBUTING.md)；对应校验器随 `vendor/` 下次镜像生效。

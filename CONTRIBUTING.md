# 贡献 adapter

本仓库是 elecon 的**社区 adapter 创作/校验仓库**。你在这里提交学校 adapter，CI 做静态校验，维护者复核后进入发布流程。

> 本仓库提交的是**未签名素材**。进入正式分发前必须完成维护者复核和签名。

> **术语对齐（ADR-022 / ADR-023）**：本指南已按核心仓 `adr_022_request_graph`（`mode → per-capability requestGraph`）与 `adr_023_declarative_dataflow`（`bind`/`compute`/`inject` 声明式跨请求数据流）更新。这些能力随核心仓合并（`NanCunChild/elecon#93`）后的**下次 `vendor/` 镜像**在本仓生效——在镜像落地前，`vendor/` 副本与本地 `npm run check` 校验器仍是旧版（仍按 `mode`/`parser` 判定），一切以核心仓 ADR 为准。校验脚本本身的适配另行跟进。

## 目录结构

```
adapters/
  school-<id>/          你的 adapter
    manifest.json       契约声明（能力 / 白名单 / requestGraph / stdlibMin …）
    index.js            QuickJS ES module；仅归一化逻辑（末端纯解析）
    fixtures/           脱敏抓包样本（golden 输入/输出）
    README.md           该校信息 / 已知坑
vendor/                 契约、stdlib 和校验器副本（只读，勿手改）
```

`vendor/` 由发布流程**单向镜像**生成（见 `vendor/MIRROR.md`），**请勿编辑**。

## 快速开始

```bash
# 声明式（首选，绝大多数 adapter）
cp -r vendor/adapters/_template/declarative adapters/school-<你的学校id>
# 修改 manifest.json：声明 capability、域名白名单、per-capability requestGraph
# 在 index.js 实现末端纯解析（只读 responses，不联网、不见凭证）
# 在 fixtures/ 放脱敏抓包样本
npm install
npm run check
npm run bundle -- --adapter=school-<你的学校id>
```

## requestGraph：每能力二选一

ADR-022 起，**模式是能力级的**（不再是全 adapter 一个 `mode`）。每个 capability 声明 `requestGraph`：

- **`declarative`（首选）**：请求图静态可枚举。adapter 只**声明**要发哪些请求，broker 执行、脱敏，adapter 末端只做一次纯解析（只读 `responses`），不联网、不见凭证。**跨请求数据依赖**（上一响应派生值 → 下一请求）也走声明式，见下节。
- **`imperative`（罕见，慢车道）**：仅当请求图无法静态声明时（动态拓扑 + 不可枚举计算，如反爬内联 JS 求解、指纹伪造）。需人工审查，且 **release 下第三方 / sideload 不得使用**——release 侧载的每个 capability 必须是 declarative requestGraph（红线 #5）。

## 声明式跨请求数据流（bind / compute / inject，ADR-023）

需要「借用上一响应里的值拼下一请求」（如挑战页给出 `client_id` → 下一跳带上）时，**不要退回 imperative**——用声明式数据流三段：

```jsonc
"requestGraph": "declarative",
"requests": [
  { "key": "A", "method": "GET",  "url": "...", "credential": "session" },
  { "key": "B", "method": "POST", "url": ".../submit" }
],
"bind":    [ { "var": "cid", "from": "A", "source": "regex",
              "extract": { "pattern": "client_id=([0-9a-f]+)", "group": 1 } } ],
"compute": [ /* 可选：封闭 op，concat/substring/base64/hex/urlencode/hmac-sha256/hkdf/now */ ],
"inject":  [ { "var": "cid", "into": "B", "at": "url", "name": "client_id" } ]
```

铁律（validator 声明期静态强制，违背即拒）：

- **adapter 永不见句柄值**：`bind` 产出的是不透明句柄（引用名），字节只在 broker 内。你操作的是变量名，`index.js` 拿不到值、也不能据其值分支。
- **抽取源恒为响应**（`header` / `body`-jsonpath / `regex`），标量单值，无数组句柄；`css-select` 暂不支持。
- **compute 是封闭词表**，broker 原生执行；禁 `random` / `uuid`（破双跑一致）；`hmac-sha256` / `hkdf` 的密钥**必须是句柄引用**，不得写字面量（manifest 已签名分发 = 字面量密钥即公开）。
- **汇聚点静态**：`inject.into/at/name` 声明死，不得依句柄值选择注入目标。
- **缺失即失败**：抽取 / 匹配 / 注入缺句柄 → 整条 capability fail-closed，绝不发出未认证请求。
- **限额**：单句柄 64 KB、全 DAG 4 MB、compute 嵌套 ≤16 / 节点 ≤64 / 每 op 参数 ≤8、请求数 ≤ `maxRequests`。

完整逐 op 语义见核心仓 `docs/reference/declarative_dataflow_ops.md` 与 ADR-023；参考模板：`vendor/adapters/_template/declarative`。

## 硬性要求

- **schema 合规**：manifest 通过 schema；capability 须在 registry；release 下 **sideload 的每个 capability 必须是 declarative requestGraph**（红线 #5）。
- **越薄越好（约束的是能力 / 信任面）**：declarative adapter 不联网、不持凭证、无副作用；但**功能上越重越好**——归一化 / 校本派生尽量压进这层。「薄」约束的是能力面，不是功能复杂度。
- **夹具脱敏**：绝不提交真实学生数据或凭证等价物。抓包后务必用占位替换真实值。
- **stdlibMin**：若使用较新的 `elecon:html` API，声明不高于当前副本的版本。
- **编译与越权**：`npm run check` 会编译每个 entry，拒绝非 `elecon:html` import，并拒绝纯解析能力的网络、凭证和动态执行 API。
- **catalog**：catalog 必须通过 schema 和 capability registry 校验。
- **bundle/digest**：本仓库只生成 unsigned 交接物，发布前重新计算 digest 并完成签名。

## 合并之后

维护者做行为复核 → 离线签名 → release catalog → CDN 分发。签名前须确认 bundle 身份来自 envelope 内 manifest，且重算 digest 与 unsigned 交接物一致。**签名 / 分发不在本仓库，本仓库 CI 无签名能力**。

## imperative（命令式）慢车道

`official + imperative` 需要人工审查 `network.allow`、passthrough 与凭证域隔离，以及执行期临时状态不会进入凭证库。生产 adapter 不得硬编码账号、密码、Token 或真实学生数据。**第三方 / sideload 在 release 下不得使用 imperative**（红线 #5）。

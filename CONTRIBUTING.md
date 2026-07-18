# 贡献 adapter

本仓库是 elecon 的**社区 adapter 创作/校验仓库**。你在这里提交学校 adapter，CI 做静态校验，维护者复核后进入发布流程。

> 本仓库提交的是**未签名素材**。进入正式分发前必须完成维护者复核和签名。

## 目录结构

```
adapters/
  school-<id>/          你的 adapter
    manifest.json       契约声明（能力 / 白名单 / 模式 / stdlibMin …）
    index.js            QuickJS ES module；仅归一化逻辑
    fixtures/           脱敏抓包样本（golden 输入/输出）
    README.md           该校信息 / 已知坑
vendor/                 契约、stdlib 和校验器副本（只读，勿手改）
```

`vendor/` 由发布流程同步生成（见 `vendor/MIRROR.md`），**请勿编辑**。

## 快速开始

```bash
cp -r vendor/adapters/_template/parser adapters/school-<你的学校id>
# 修改 manifest.json，声明 capability、域名白名单和模式
# 在 index.js 实现归一化
# 在 fixtures/ 放脱敏抓包样本
npm install
npm run check
npm run bundle -- --adapter=school-<你的学校id>
```

## 硬性要求

- **schema 合规**：manifest 通过 schema；capability 须在 registry；`sideload` 必须是 `parser`。
- **越薄越好**：parser adapter 只解析，不联网、不持凭证、无副作用。
- **夹具脱敏**：绝不提交真实学生数据或凭证等价物。抓包后务必用占位替换真实值。
- **stdlibMin**：若使用较新的 `elecon:html` API，声明不高于当前副本的版本。
- **编译与越权**：`npm run check` 会编译每个 entry，拒绝非 `elecon:html` import，并拒绝 parser 的网络、凭证和动态执行 API。
- **catalog**：catalog 必须通过 schema 和 capability registry 校验。
- **bundle/digest**：本仓库只生成 unsigned 交接物，发布前重新计算 digest 并完成签名。

## 合并之后

维护者做行为复核→离线签名→release catalog→CDN 分发。签名前须确认 bundle 身份来自 envelope 内 manifest，且重算 digest 与 unsigned 交接物一致。**签名/分发不在本仓库，本仓库 CI 无签名能力**。

## Fetch 慢车道

`official + fetch` 需要人工审查 `network.allow`、passthrough 与凭证域隔离，以及执行期临时状态不会进入凭证库。生产 adapter 不得硬编码账号、密码、Token 或真实学生数据。

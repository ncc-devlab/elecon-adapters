# elecon-adapters

elecon 的社区 adapter 仓库。学校 adapter 在此创作、静态校验;签名与分发在私有核心侧（[ADR-018](https://github.com/NanCunChild/elecon)）。

- 贡献指南：[CONTRIBUTING.md](./CONTRIBUTING.md)
- `adapters/`：各校 adapter（社区源真相）
- `vendor/`：核心单向镜像（只读——contract / `elecon:html` stdlib / 静态校验器），见 [`vendor/MIRROR.md`](./vendor/MIRROR.md)

## 本地校验

```bash
npm install
npm run check   # validate（manifest/schema）+ scan（PII/凭证等价物脱敏）
```

> 本仓库**无签名能力**：这里的提交是未签名 sideload 素材;成为随 app 分发的 official adapter 须经维护者审查后在核心侧签名（ADR-002 / ADR-018）。

## 发布链路

```text
社区 PR → 公开仓静态检查 → 核心沙箱复审 → bundle/digest
         → YubiKey 签名 → catalog/CDN 分发 → 客户端验签加载
```

公开仓只负责源代码、脱敏 fixture 和 unsigned bundle。`npm run bundle -- --adapter=...` 会生成确定性
envelope、gzip 与 digest，不能替代核心签名；核心流水线必须重新构建并核对签名前后 bundle 身份和 digest
一致，再写入 release ledger/catalog。

`npm run check` 还会执行 JS 编译、`elecon:html` import 白名单、parser 越权规则和存在时的
`dist/catalog.json` schema/registry 校验。parser fixture 的 QuickJS-wasm golden 与 fetch 回放仍需在核心
沙箱执行：`server npm run smoke:sandbox` / `server npm run smoke:xjt`。

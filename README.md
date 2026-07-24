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

本仓库只负责源代码、脱敏 fixture 和 unsigned bundle。`npm run bundle -- --adapter=...` 会生成确定性
envelope、gzip 与 digest，不能替代发布签名。

`npm run check` 还会执行 JS 编译、`elecon:html` import 白名单、纯解析（declarative）越权规则和存在时的
`dist/catalog.json` schema/registry 校验。

> 术语（`requestGraph` / `bind`·`compute`·`inject`）已按核心仓 ADR-022 / ADR-023 更新，见
> [CONTRIBUTING.md](./CONTRIBUTING.md)；对应校验器随 `vendor/` 下次镜像生效。

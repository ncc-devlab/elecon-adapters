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

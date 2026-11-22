# vendor/ — 核心镜像（只读，勿手改）

本目录由 `scripts/mirror-to-adapters-repo.mjs` 从私有核心仓 **单向** 生成（ADR-018 §2.8）。
**请勿手工编辑**——任何改动会在下次镜像时被覆盖；contract / stdlib / 校验器的源真相在核心仓。

| 项 | 来源 | 用途 |
|---|---|---|
| `contract/` | core `contract/` | source-package / capability / schema 契约（供打包与签名工具校验） |
| `adapters/_stdlib/` | core `adapters/_stdlib/` | `elecon:html` stdlib（宿主 HTML 解析器），版本 = 1.0.0 |
| `adapters/_template/` | core `adapters/_template/` | 贡献脚手架 |
| `tools/src/{script,scanner,codegen,schema}/` | core `tools/src/` | 源码打包/签名、数据扫描和契约生成；不含私钥 |

- 源版本（core）：`4c6315e61e91a97c89655ec65c87bf0199d29a02`
- stdlib 版本：1.0.0

> 若核心 tool 依赖（ajv / ajv-formats / tsx）版本变化，需同步更新公开仓根 `package.json`。

# vendor/ — 核心镜像（只读，勿手改）

本目录由 `scripts/mirror-to-adapters-repo.mjs` 从私有核心仓 **单向** 生成（ADR-018 §2.8）。
**请勿手工编辑**——任何改动会在下次镜像时被覆盖；contract / stdlib / 校验器的源真相在核心仓。

| 项 | 来源 | 用途 |
|---|---|---|
| `contract/` | core `contract/` | manifest / capability / schema 契约（validator 据此校验） |
| `adapters/_stdlib/` | core `adapters/_stdlib/` | `elecon:html` stdlib（bundle + 版本，供 stdlibMin 校验）;版本 = 1.0.0 |
| `adapters/_template/` | core `adapters/_template/` | 贡献脚手架 |
| `tools/src/{validator,scanner}/` | core `tools/src/` | CI 静态闸门（§2.10）;**不含 signer** |
| `packages/broker-primitives/` | core `packages/broker-primitives/dist` | validator 依赖的 url-match 原语 |

- 源提交（core）：`92942de982833fea13ab8108d962096202fc9b89`
- stdlib 版本：1.0.0

> 若核心 tool 依赖（ajv / ajv-formats / tsx）版本变化，需同步更新公开仓根 `package.json`。

# vendor/ 只读依赖

本目录由发布流程同步生成，供本仓库校验使用。请勿手工编辑。

| 项 | 用途 |
|---|---|
| `contract/` | manifest、capability 和 schema 契约 |
| `adapters/_stdlib/` | `elecon:html` 标准库及版本，目前为 1.0.0 |
| `adapters/_template/` | adapter 贡献脚手架 |
| `tools/src/{validator,scanner}/` | CI 静态校验 |
| `packages/broker-primitives/` | 校验器使用的 URL 匹配原语 |

<<<<<<< HEAD
- 源提交（core）：`92942de982833fea13ab8108d962096202fc9b89`
- stdlib 版本：1.0.0

> 若核心 tool 依赖（ajv / ajv-formats / tsx）版本变化，需同步更新公开仓根 `package.json`。
=======
依赖版本变更时，应同步更新本仓库根目录的 `package.json`。
>>>>>>> 9126064 (feat: THU adapters added; private references deleted)

# contract/ — 跨端共享契约

> **这是整个项目最重要的目录。** adapter 与 UI 之间唯一的耦合面就在这里。
> 改动必须走 ADR；现阶段允许有明确版本与迁移方案的破坏性更新，禁止静默改义。当前基线见 [ADR-041](../docs/adr/adr_041_current_architecture.md)。

## 目录

```
schema/          JSON Schema 定义（Draft 2020-12），所有数据域的唯一事实来源
capability/      capability id 注册表（registry.json）
script-package.schema.json   作者构建输入（manifest 与 source）
script-sdk/      新受信脚本 SDK：真实凭据、宿主 HTTP 与可见浏览器 API
signed-script-package.schema.json   /4 的 package.json、发布公钥、逻辑文件表与入口
```

## 使用

- adapter 产出数据由宿主（Dart / TypeScript）按 `schema/` 校验后才被接受。
- 新增 capability id 或新域 schema → 走慢车道（先开 ADR）。

## 顶层原则

| 约定 | 说明 |
|---|---|
| 时间 | 时刻用 RFC3339/UTC；日历日用 YYYY-MM-DD，按具体 schema 定义 |
| 金额 | 整数 + 最小货币单位，禁止浮点 |
| 缺失 | 字段缺失 ≠ `null`，语义不同 |
| ID | 按具体领域/来源解释；不同 provider 的相同字符串不自动表示同一实体 |
| 枚举 | 只有 schema 明确提供 `unknown` 才可映射；否则按该能力错误/兼容约定处理 |
| 兼容 | 新增可选字段 = 兼容；删除/改义/改类型 = 破坏性 |

## 源码执行路线

新功能以 [ADR-034](../docs/adr/adr_034_trusted_school_scripts.md) 的源码路径为准：宿主按 [ADR-130](../docs/adr/adr_130_script_package_assets.md) 验证 `elecon-script/4` 清单签名及每个文件，再由用户审查并批准具体摘要，统一 async handler 可读写当前学校身份凭据；客户端是唯一生产执行面。tools 检查与打包，不运行学校代码。源码包不声明 V1 requestGraph、credentials 配方或 masker.json。

V1 manifest/adapter-sdk/Broker/Masker 及专属 golden 已按 ADR-118 退役。现有领域 schema、源码 SDK 与签名 golden 保留；不将 V1 的 official-only 或凭据不可见要求套给当前受信源码。

`format`（elecon-script/4）、`sdkVersion`（宿主 API）、`manifest.version`（单脚本更新）、capability 的 `schemaVersion`（业务输出）及应用版本相互独立。不要为脚本接口修复改动业务 schema 版本，也不要把 V2 分支名当作格式或应用版本号。安装版本与 digest 行为见 [使用文档](../docs/reference/trusted_scripts.md)。

SDK 2 的凭据地址与写入语义见 [ADR-035](../docs/adr/adr_035_script_credential_identity.md)：namespace 默认脚本 id，记录 id/namespace/key 可往返；同校显式共享仍在同一授权身份内。SDK 1 为已有预览包保留原有寻址，不静默升级或猜测旧记录归属。

页面、provider 与增强包的接口演进见 [ADR-042 提案](../docs/adr/adr_042_providers_pages_enhancements.md)。拟议字段尚不可写入现有 manifest；页面可复用多个现有能力，不必为了独立路由新增 schema。

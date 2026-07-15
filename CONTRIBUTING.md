# 贡献 adapter

本仓库是 elecon 的**社区 adapter 创作/校验之家**。你在这里提交学校 adapter,CI 做静态校验,维护者审查后由**私有核心侧**签名并分发。详见 [ADR-018](https://github.com/NanCunChild/elecon)（adapter 分离/分发）。

> **信任模型（ADR-002）**：本仓库的提交是**未签名 sideload 素材**。要成为随 app 分发的 **official** adapter,须经维护者审查后在核心侧签名——**签名 = 采纳**。没有"已签名但社区维护"的中间态。

## 目录结构

```
adapters/
  school-<id>/          你的 adapter
    manifest.json       契约声明（能力 / 白名单 / 模式 / stdlibMin …）
    index.js            QuickJS ES module;仅归一化逻辑,import 仅 `elecon:html`
    fixtures/           脱敏抓包样本（golden 输入/输出）
    README.md           该校信息 / 已知坑
vendor/                 ← 核心镜像（只读，勿手改；contract / stdlib / 校验器）
```

`vendor/` 由核心单向镜像生成（见 `vendor/MIRROR.md`），**请勿编辑**——契约与 stdlib 的源真相在核心仓。

## 快速开始

```bash
# 1. 从脚手架复制（parser 最常见:纯解析、无网络、无凭证）
cp -r vendor/adapters/_template/parser adapters/school-<你的学校id>

# 2. 改 manifest.json：声明 capability + 域名白名单（+ 可选 runtime.stdlibMin）
# 3. 在 index.js 实现归一化（import { ... } from 'elecon:html'）
# 4. 在 fixtures/ 放脱敏抓包样本

# 5. 本地校验
npm install          # 首次:装 vendored 校验器依赖
npm run check        # = validate（manifest/schema…）+ scan（脱敏）
```

## 硬性要求（CI 会拦）

- **schema 合规**：manifest 过 `contract/manifest.schema.json`;capability 须在 registry;`sideload` 必须是 `parser`。
- **越薄越好**：parser adapter 只解析,不联网、不持凭证、无副作用。
- **🔒 夹具脱敏（红线 #1 / #8）**：**绝不提交真实学生数据**（身份证/手机号/学号/银行卡）**或凭证等价物**（session cookie / `ticket=` / `openid` / `SAMLResponse` / CAS 票据 `ST-`/`TGT-` …）。scanner 会拦截。抓包后务必用占位替换真实值（`example` / `test` / 全 0 等会被识别为占位）。
- **`stdlibMin`**（可选）：若用到较新的 `elecon:html` API,声明 `runtime.stdlibMin`;不得高于 `vendor/adapters/_stdlib` 的版本。

## 合并之后

维护者在核心侧做二次审查（沙箱行为验证）→ 离线签名（YubiKey）→ 分发。**签名/分发不在本仓库,本仓库 CI 无任何签名能力**（ADR-018 §2.8 四信任域）。

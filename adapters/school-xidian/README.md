# school-xidian（西安电子科技大学）— fetch 模式 adapter

**状态：公开通知、课表和本科成绩已有脱敏 fixture 与核心凭据注入 smoke，尚未签名发布。**

- **数据**：教务处公开通知 `notice.list`（emits `elecon.notice.list@1.1`）。
- **登录数据**：IDS 登录后的 E-Hall `schedule.week`、本科 `grades.list`。
- **成绩边界**：研究生成绩平台跨域 SSO 暂不接入。
- **登录边界**：核心 WebView 托管 IDS 登录；adapter 只声明 `ehall-session` cookie scope，不接触用户名、密码或 cookie 值。
- **域名白名单**：教务处、IDS、E-Hall（见 `manifest.json` `network.allow`）。

## 已知坑

- **两种日期结构并存**（见 `index.js:extractDateStr`）：
  1. `<li>…<span>2026-06-10</span></li>` —— span 即完整日期；
  2. `<li>…<div class="time"><p>30</p><span>2026.06</span></div>` —— 年月在 span、日在 p，需拼合。
  两者最终都经 `normalizeDate` 归一为 UTC RFC3339；识别失败则省略 `publishedAt`（schema 可选）。
- **URL 归一**：沙箱内无 `URL` 全局，手工拼接——绝对 URL 原样保留，相对路径拼 `ORIGIN`。
- **日期时区**：`normalizeDate` 统一产出 `...T00:00:00Z`（UTC）。注意 `adapters_tests/XIDIAN/jwc/std/` 下的逆向 spike 用的是本地 `+08:00`，二者 golden 不同——**正式 adapter 以本目录 UTC 产出为准**。
- **课表周次 `SKZC`**：`parseWeeks` 支持单段/多段、逗号列表、单双周标记（如 `1-16周(单)`）。无法识别的形态 fail-soft 为空周列表，避免误排进指定周。

## 运行与验证

```bash
# 在 elecon-adapters 根
npm install
npm run check
npm run bundle -- --adapter=school-xidian

# 核心仓（兄弟目录）凭据注入 smoke
cd ../elecon/server && npm run smoke:xidian-schedule && npm run smoke:xidian-grades
```

核心 smoke 使用脱敏 fake transport，至少应断言 E-Hall 请求带有凭证 Cookie、adapter 收不到
`Set-Cookie`，课表输出通过 `elecon.schedule.week` schema。真实账号测试必须人工执行，不能放进 CI。

## 夹具

`fixtures/` 放脱敏后的 notice / schedule / grades 期望输出。脱敏要求见 `adapters/README.md` 与 tools PII scanner。

## 待办

- 下一刀可接 `exam.list`（核心 registry 已有；逆向见 `adapters_tests/XIDIAN/ehall/exams.py`）。
- 滑块求解、用户名密码和真实登录仍由核心/人工流程负责，不得复制进 adapter。

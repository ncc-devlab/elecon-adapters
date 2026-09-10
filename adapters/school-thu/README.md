# school-thu（清华大学）

**状态：通知 / 成绩 / 课表 / 校园卡已有代码与 manifest；公开通知已 declarative，其余仍为 imperative；尚未签名发布。**

- **`notice.list`（declarative）**：WebVPN 门户通知列表；`requests.page` + `credential: webvpn-session`；固定 `lydw=` 空（全源），单位过滤未建模。
- **`grades.list` / `schedule.week` / `card.*`（imperative）**：统一认证后 WebVPN / 校园卡接口；依赖核心 WebView 收割会话后 Broker 注入。
  - `grades.list` 的 emits 已对齐 `elecon.grades.list@1.1`（绩点归属改判，ADR-001 §3.5）。
    `parseGrades()` 目前只取成绩单表格的成绩列，**不产出 `gradePoint`**，故 `gradePointScale` /
    `gradePointSource` 一并不声明——本体 GPA 按契约 fail-closed。清华成绩单是否含绩点列、
    以及校本制式为何，**待人工用真实成绩单确认**后再决定是否补齐（与西电同类，见
    `../school-xidian/COVERAGE.md` §1b）。
- 实现只做受限域名请求与 schema 归一化；不保存账号、密码、Cookie、Token 或真实用户数据。
- 测试脚本：`adapters_tests/THU/`。

```bash
npm run check
```

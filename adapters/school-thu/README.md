# school-thu（清华大学）

**状态：通知 / 成绩 / 课表 / 校园卡已有代码与 manifest；公开通知已 declarative，其余仍为 imperative；尚未签名发布。**

- **`notice.list`（declarative）**：WebVPN 门户通知列表；`requests.page` + `credential: webvpn-session`；固定 `lydw=` 空（全源），单位过滤未建模。
- **`grades.list` / `schedule.week` / `card.*`（imperative）**：统一认证后 WebVPN / 校园卡接口；依赖核心 WebView 收割会话后 Broker 注入。
- 实现只做受限域名请求与 schema 归一化；不保存账号、密码、Cookie、Token 或真实用户数据。
- 测试脚本：`adapters_tests/THU/`。

```bash
npm run check
```

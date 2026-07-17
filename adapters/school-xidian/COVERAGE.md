# XIDIAN 能力覆盖矩阵

本文件根据核心仓 `adapters_tests/XIDIAN` 的逆向脚本整理。脚本能在本地使用真实账号验证，
不等于已经满足 adapter contract、QuickJS 沙箱和正式发布要求。

| 来源测试 | 当前状态 | 原因 |
|---|---|---|
| `jwc/` 教务处通知 | 已接入 `notice.list` | 公开数据、脱敏 fixture；保留核心旧 golden 兼容入口 |
| `ehall/schedule.py` | 已接入 `schedule.week` | 使用 IDS WebView 登录后的 E-Hall cookie；核心 fake transport 已验证注入和 schema |
| `ehall/scores.py` | 已接入 `grades.list`（本科） | E-Hall cookie 注入和 schema 已有核心 fake transport smoke；研究生成绩仍待单独 SSO 审查 |
| `ehall/exams.py` | 跳过 | 当前 registry 没有考试 capability，需先确定公共 schema 和 ADR 变更 |
| `ehall/session.py` | 不作为 capability | 共享登录/应用跳转流程由核心登录与凭证层托管 |
| `card/balance.py` | 跳过 | OAuth `openid` 是敏感会话产物，接口返回字段不稳定 |
| `library/borrow.py` | 跳过 | CAS 响应 body 产生 `userId/token`，需要明确 ephemeral/凭证边界和借阅日期映射 |
| `energy/meter.py` | 跳过 | 尚无 registry/schema/脱敏 fixture |

## 接入顺序

1. 核心侧完成 IDS WebView 登录、人工验证码交互和 origin cookie 收割 smoke。
2. 为一个 capability 固定参数、响应 schema、凭证 scope 和脱敏 fixture。
3. 在本仓实现 capability，并通过 `npm run check`。
4. 在核心沙箱验证凭证注入、会话隔离、失败语义和 QuickJS 运行。
5. 通过人工安全审查后，才加入正式 bundle、digest、签名和 catalog。

不要把 `ids/login.py` 的密码加密、验证码求解或真实账号流程复制进 adapter。登录凭证由核心
WebView/凭证层处理；adapter 只消费受限 `ctx.fetch` 和已声明的 capability 输入。

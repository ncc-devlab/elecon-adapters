# XIDIAN 能力覆盖矩阵

本文件根据核心仓 `adapters_tests/XIDIAN` 的逆向脚本整理。脚本能在本地使用真实账号验证，
不等于已经满足 adapter contract、QuickJS 沙箱和正式发布要求。

| 来源测试 | 当前状态 | 原因 |
|---|---|---|
| `jwc/` 教务处通知 | 已接入 `notice.list` | 公开数据、parser、脱敏 fixture、schema/golden 已具备 |
| `ehall/scores.py` | 跳过 | 依赖 IDS/CAS 登录和验证码；需要成绩字段映射、fixture 及凭证收割 smoke |
| `ehall/schedule.py` | 跳过 | `schedule.week` 入参契约仍是草案；学期、周次和调停课字段尚未形成稳定映射 |
| `ehall/exams.py` | 跳过 | 当前 registry 没有考试 capability，需先确定公共 schema 和 ADR 变更 |
| `ehall/session.py` | 不作为 capability | 这是共享登录/应用跳转流程，应由核心登录与凭证层托管，不直接暴露为 adapter 能力 |
| `card/balance.py` | 跳过 | OAuth `openid` 是敏感会话产物，接口返回字段不稳定，不能按当前脚本的宽松解析发布 |
| `library/borrow.py` | 跳过 | 脚本自身标注待完成；CAS 响应 body 产生 `userId/token`，需要明确 ephemeral/凭证边界和借阅日期映射 |
| `energy/meter.py` | 跳过 | 脚本自身标注待完成，尚无 registry/schema/脱敏 fixture |

## 接入顺序

1. 核心侧先完成 IDS WebView 登录、滑块验证码人工交互和 origin cookie 收割 smoke。
2. 为一个 capability 固定参数、响应 schema、凭证 scope 和脱敏 fixture。
3. 在本仓实现单个 capability，并通过 `npm run check`。
4. 在核心沙箱验证凭证注入、会话隔离、失败语义和 QuickJS golden。
5. 通过人工安全审查后，才加入正式 bundle、digest、签名和 catalog。

不要把 `ids/login.py` 的密码加密、验证码求解或真实账号流程复制进 adapter。登录凭证由核心
WebView/凭证层处理；adapter 只消费受限 `ctx.fetch` 和已声明的 capability 输入。

# XIDIAN 能力覆盖矩阵

本文件根据核心仓 `adapters_tests/XIDIAN` 的逆向脚本与 `elecon/contract/schema` 整理。
脚本能在本地用真实账号验证，**不等于**已满足 adapter contract、QuickJS 沙箱和正式发布要求。

相关核心文档（只读对照，勿在 adapter 内复制登录/加密逻辑）：

- `elecon/docs/reference/webview_login_fetch_feasibility.md`
- `elecon/docs/reference/xidian_mint_closed_loop_plan.md`

---

## 已接入

| 来源测试 | Capability | 状态 | 备注 |
|---|---|---|---|
| `jwc/` | `notice.list` | 已接入 | 公开；脱敏 fixture |
| `ehall/schedule.py` | `schedule.week` | 已接入 | `ehall-session` + smoke |
| `ehall/scores.py` | `grades.list` | 已接入（本科） | 研究生成绩跨域 SSO 不接 |
| `ehall/exams.py` | `exam.list` | 已接入（本科） | `smoke:xidian-exams` |
| `ehall/session.py` | — | 非 capability | 登录 / useApp 由核心托管 |

---

## 候选扩展（未接入）

| 来源测试 | Capability | 优先级 | 一句话结论 |
|---|---|---|---|
| `card/balance.py` | `card.balance` / `card.transactions` | P1（核心裁定后） | 流水 JSON 可用；余额 HTML 脆；**openid 阻塞** |
| `ehall/empty_classroom.py` | `classroom.available` | P2（先扩 schema） | E-Hall 同 exam 路径；**params/语义不对齐** |
| `library/borrow.py` | `library.loans` | P2–P3 | 字段映射干净；CAS/`openId`/双域待真机校准 |
| `energy/meter.py` | `energy.usage` | 冻结 | 校园网 + AES/sign；不进当前 milestone |

### 相对 `exam.list` 的增量成本（粗估）

| 能力 | 倍数 | 主成本在 |
|---|---|---|
| `classroom.available` | ~0.5–1× | contract params / 空闲语义 |
| `library.loans` | ~2–3× | 新域 mint + 真机校准 |
| `card.*` | ~3–5× | openid 凭证模型 + 余额 HTML |
| `energy.usage` | ~5–10× | 校园网 + 每请求签名 |

---

## 1. `card.balance` / `card.transactions`

**探针：** `adapters_tests/XIDIAN/card/balance.py`  
**域：** `v8scan.xidian.edu.cn`  
**CAS service（校准源）：** `https://v8scan.xidian.edu.cn/home/openXDOAuth2Page`

| 接口 | 形态 | 稳定度 |
|---|---|---|
| `GET /myaccount/openMyAccount?openid=` | HTML | 低（正则捞金额） |
| `POST /selftrade/queryCardSelfTradeList?openid=` | JSON `resultData.rows` | 中高 |

### 1.1 期望 emits 字段映射

**`elecon.card.balance`（必填：`cardNumber`, `balance.{amountMinor,currency}`）**

| 目标字段 | 期望来源 | 缺口 |
|---|---|---|
| `cardNumber` | 账户页 HTML/JSON（待逆向确认字段名） | 探针未稳定提取；**禁止用学号瞎填当卡号** |
| `balance.amountMinor` | 页面金额 ×100 取整 | 选择器需 fixture 校准 |
| `balance.currency` | 固定 `CNY` | 无 |
| `cardNumberMasked` / `status` / `lastTransaction` / `balanceUpdatedAt` | 可选 | 当前探针基本拿不到 |

**`elecon.card.transactions`（必填：`cardNumber`, `items[]` 的 `time,amountMinor,currency,direction`）**

| 目标字段 | 期望来源 | 备注 |
|---|---|---|
| `cardNumber` | 同 balance | 同源缺口 |
| `items[].time` | 流水时间字段 → RFC3339 UTC | 字段名待夹具确认 |
| `items[].amountMinor` | 金额绝对值 ×100 | 非负 |
| `items[].direction` | 收支符号/类型 → `debit`/`credit`/… | 枚举以 schema 为准 |
| `items[].merchant` / `location` / `type` | 可选 | 有则映射 |
| `page` / `size` / `hasNext` / `total` | 分页响应 | XIDIAN 用 `pageNo`/`pageSize` |

### 1.2 期望 params（已有草案）

`elecon.params.card.transactions`：

| 字段 | XIDIAN 行为 |
|---|---|
| `page` / `size` | 映射 `pageNo` / `pageSize`（推荐实现） |
| `from` / `to` | **忽略**（接口不支持；schema 已注明可选） |

`card.balance` 无独立 params schema（空对象即可）。

### 1.3 Manifest / 凭证（期望声明，未实现）

```text
network.allow += https://v8scan.xidian.edu.cn/*
credentials.card-session = { scope: ["https://v8scan.xidian.edu.cn/*"], type: cookie 或 URL 凭证（待裁定） }
```

### 1.4 人工审阅清单（card）

- [ ] **openid 建模**：是否作为 `CredentialEntry` 收割进 store；adapter **永不见** openid 明文（红线 #1）
- [ ] openid 落在 URL query 时：cookie 收割是否不够；是否要 URL 参数注入或核心侧合成下游 session
- [ ] mint `service` / `success` URL 与 `navigationAllow` 是否覆盖整条 OAuth 链
- [ ] 余额 HTML 选择器稳定性；失败语义（`errorStatus` vs 抛错）
- [ ] `cardNumber` 真实字段来源与脱敏 fixture 规则
- [ ] 流水字段名真机对照表 + PII 扫描通过后再进 `fixtures/`
- [ ] 真实账号仅人工；**禁止 CI 打真实 IDS/v8scan**

---

## 2. `classroom.available`

**探针：** `adapters_tests/XIDIAN/ehall/empty_classroom.py`  
**AppId：** `4768402106681759`  
**凭证：** 复用 `ehall-session`（与 grades/schedule/exam 相同）

| 接口 | 作用 |
|---|---|
| `.../kxjas/modules/kxjas/jxlcx.do` | 教学楼列表 → `JXLDM` / `JXLJC` |
| `.../rqzhzcjc.do` | 日期 → 周次 `ZC` + 星期 `XQJ` |
| `.../cxjsqk.do` | 教室占用；`JC1`–`JC11` 含 `"1_"` 表示占用 |

### 2.1 期望 params 扩展（**contract 未满足，需 ADR**）

现有 `elecon.params.classroom.available`：`date`, `start`, `end`, `campus`

| 字段 | 现状 | 期望 |
|---|---|---|
| `date` | 有 | **必填**；`yyyy-MM-dd` |
| `building` | **无** | **必填或强推荐**；教学楼 code（`JXLDM`）或可解析名称 |
| `term` / `semester` | **无** | 学年学期，如 `2024-2025-2` 或拆 `XN`+`XQ`；缺省时由 adapter 调「当前学期」接口（需声明） |
| `start` / `end` | 有（墙钟或未定义） | 明确语义：节次（1–11）**或** HH:mm + **校历节次时刻表**；无表则文档写死「仅按日、忽略时刻」 |
| `campus` | 有 | 可选过滤；XIDIAN 首版可忽略 |

### 2.2 期望 emits 映射

现有 `elecon.classroom.available`：`items[]` 必填 `building`, `room`

| 目标字段 | 探针来源 | 备注 |
|---|---|---|
| `date` | 入参回显 | |
| `building` | 教学楼名 `JXLJC` 或 code | 与 params 一致 |
| `room` | `JASMC` | |
| `occupied` / `status` | 由 `JC1`–`JC11` 与 start/end 推导 | `available` / `occupied` / `unknown` |
| `capacity` / `equipment` / `campus` | 可选 | 探针无则省略 |
| 全日占用明细 | **schema 无节次数组** | 若产品要「每节空闲」，需扩 schema（如 `sections: boolean[11]`）或只做聚合状态 |

**产品语义待拍板（三选一或组合）：**

1. 返回指定楼指定日**全部教室** + 每间 `occupied`（至少一节有课 vs 全天空）  
2. 仅返回在 `start`–`end` 内**空闲**的教室  
3. 扩展 emits 携带 `sections[11]`，客户端自己算  

### 2.3 Manifest

`network.allow` / `ehall-session` **基本已够**；仅增 capability 声明 + fixture/smoke。

### 2.4 人工审阅清单（classroom）

- [ ] **params ADR**：是否增加 `building`、`term`；`start`/`end` 语义
- [ ] 无 `building` 时是否禁止「扫全校」默认（性能/滥用）
- [ ] 学期缺省策略与 `get_current_semester` 类接口是否允许
- [ ] 研究生是否同 App（首版建议仅本科 E-Hall，与 exam 一致）
- [ ] 脱敏 fixture + 仿 `smoke:xidian-exams` 的核心 smoke
- [ ] 正式发布前 schemaVersion 与 catalog 对齐

---

## 3. `library.loans`

**探针：** `adapters_tests/XIDIAN/library/borrow.py`  
**链：** CAS → `hyytsgxzs.xidian.edu.cn`（`userId`+`token`）→ API `shuwo.xidian.edu.cn`

| 接口 | 作用 |
|---|---|
| CAS target `.../casLoginDo.html?libraryId=5&openId=...&source=xdbb` | 登录；页内 `postMessage` JSON |
| `POST .../borrow/getBorrowList.html` | 当前借阅 |
| `renewBook` / `search` | **无对应 capability**；v1 不做写操作/检索 |

### 3.1 期望 emits 映射

**`elecon.library.loans`（必填：`items[]` 的 `bookId,title,borrowedAt,dueAt`）**

| 目标字段 | 探针字段 | 备注 |
|---|---|---|
| `bookId` | `barcode` | |
| `title` | `book_name` | |
| `borrowedAt` | `borrow_date` | 归一 RFC3339；格式待真机确认 |
| `dueAt` | `return_date` | 同上 |
| `renewCount` | `renew_count` | 可选 |
| `location` | `location` | 可选 |
| `author` / `callNumber` / `branch` | — | 列表接口可能无 |
| `overdue` | 可由 `dueAt` vs now 推导 | 可选 |
| `renewable` / `renewalMax` | — | 探针无则省略 |

### 3.2 Manifest / 凭证（期望）

```text
network.allow +=
  https://hyytsgxzs.xidian.edu.cn/*
  https://shuwo.xidian.edu.cn/*
credentials.library-session = { scope: 上述域或拆分, type: cookie 或 token 注入方式（待裁定） }
```

`userId` + `token` 为会话密钥：**不得**作为 adapter 可见长期字段写入 emits。

### 3.3 人工审阅清单（library）

- [ ] 真机验收 CAS target 中固定 `openId=` 是否仍必需（探针已脱敏；**禁止臆造真实 openId 提交**）
- [ ] 校准 `library-session` 的 CAS `service` / success URL（mint plan 现为占位）
- [ ] `userId`/`token`：cookie 注入 vs 核心表单字段注入 vs 每请求核心附加
- [ ] 双域 allow 与 credential scope 是否重叠、收割判据是否清晰
- [ ] 日期格式、空借阅列表、续借失败是否影响只读 loans
- [ ] ORIGIN 仍标「待完成」——**先探针绿灯再写 adapter**
- [ ] 脱敏 fixture + PII（姓名以外的读者号等）

---

## 4. `energy.usage`（冻结）

**探针：** `adapters_tests/XIDIAN/energy/meter.py`  
**域：** `xxcapp.xidian.edu.cn` OAuth → `ignypt.xidian.edu.cn`  
**约束：** **必须校园网**；请求 AES-CBC（固定 key/iv）+ 每请求 `GetSignature`（timestamp/signature）

### 4.1 Schema

`elecon.energy.usage` / params `from`/`to` 较松，映射余量/历史不难：

| 目标 | 探针 |
|---|---|
| `type: electricity\|water` | `MediumCode` 2=电 1=水 |
| `reading` / `usage` | `LastNum` / 历史 `use_num` 等 |
| `from` / `to` | 查询窗口 |

### 4.2 为何不进当前 milestone

| 因素 | 说明 |
|---|---|
| 网络 | 非校园网不可达；客户端无统一 WebVPN 策略 |
| 签名 | mint 计划明确 energy **默认不静默 mint**（ADR-017 §2.8） |
| 会话 | `NodeID` + 签名头需核心模型，非单纯 cookie |
| 安全 | 固定 AES 密钥属校方实现；仍需审查日志与表号脱敏 |

### 4.3 人工审阅清单（energy，远期）

- [ ] 产品是否支持「仅校园网/VPN」能力开关
- [ ] 可见 WebView vs 签名钩子（PR-6）路径选择
- [ ] allow：`ignypt` + `xxcapp` 整链
- [ ] 校内脱敏 fixture 流程
- [ ] **在未通过前：不在 `manifest.json` capabilities 中声明**

---

## 横切纪律（所有候选能力）

1. **红线 #1**：不在 adapter / fixture / 日志中出现真实 cookie、ticket、openid、token、密码。  
2. **红线 #5**：adapter 不登录、不 mint、不读 cookie jar；只 `ctx.fetch` + 归一化。  
3. **脱敏 fixture** 必过 PII scanner；真实账号测试仅人工，不进 CI。  
4. **发布门禁**：`npm run check` → 核心 smoke（fake transport）→ 人工安全审查 → 签名 bundle / catalog。  
5. **不要**把 `ids/login.py`、AES 密钥用途说明以外的「自登录」或验证码求解复制进 `index.js`。

---

## 建议落地顺序

| 序 | 工作 | 主导 | 阻塞 |
|---|---|---|---|
| 0 | card `openid` / `card-session` 专项裁定 | **人工** | 红线 #1 |
| 1 | `classroom.available` params / 语义 ADR | contract | 红线 #6 |
| 2 | `classroom.available` fetch + fixture + smoke | adapter | 步骤 1 |
| 3 | `card.transactions` + `card.balance` | 核心 + adapter | 步骤 0 |
| 4 | `library.loans` 真机校准 → mint → adapter | 核心 + adapter | 探针验收 |
| 5 | `energy.usage` 保持文档/探针 only | — | 校园网产品决策 |

---

## 接入通用步骤（沿用）

1. 核心完成对应 ref 的登录/mint/注入 smoke。  
2. 固定 params、emits schema、credential scope、脱敏 fixture。  
3. 本仓实现 capability，`npm run check`。  
4. 核心沙箱：注入、隔离、失败语义、QuickJS。  
5. 人工安全审查后，才进正式 bundle / digest / 签名 / catalog。

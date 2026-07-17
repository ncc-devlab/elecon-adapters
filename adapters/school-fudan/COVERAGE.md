# FDU 能力覆盖矩阵

| `adapters_tests/FDU` 来源 | 当前状态 | 说明 |
|---|---|---|
| `notice/fetch.py` 本科生院 | 已接入 `notice.list` | 公开 fetch、脱敏 fixture、已有 schema |
| `notice/fetch.py` 研究生院 | 暂未接入 | 需要来源选择参数或独立 capability，并确认当前 DOM |
| `edu/fetch.py` | 暂未接入 | 教务统一认证、课表/成绩专用映射和凭证 smoke 待完成 |
| `graduate/fetch.py` | 暂未接入 | 研究生认证域和成绩/课表 schema 待审查 |
| `auth/requests.py` | 不作为 capability | 登录流程由核心 WebView/凭证层托管 |
| `data/`、`ecard/`、`life/`、`local/` | 暂未接入 | 涉及个人数据、下游 token、校内网络或缺少专用 schema |

禁止将账号、密码、Cookie、CAS ticket、Token 或真实校园数据放入 adapter 和 fixture。

# 清华大学 adapter

本 adapter 使用统一认证后的 WebVPN、校园卡服务和公开应用接口，提供通知、成绩、课表、一卡通余额与交易流水能力。

实现只负责请求受限域名并将响应归一化为标准 capability 输出；不保存账号、密码、Cookie、Token 或真实用户数据。测试脚本位于 `adapters_tests/THU/`，其中的表单和响应由调用方提供。

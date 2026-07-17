# school-fudan（复旦大学）— fetch 模式 adapter

**状态：本科生院公开通知已接入，尚未签名发布。**

- capability：`notice.list`
- 来源：`https://jwc.fudan.edu.cn/9397/list.htm`
- 当前不涉及登录、凭证或学生数据。
- `params.page` 支持分页；默认第 1 页。

FDU 测试目录中的教务课表/成绩、研究生系统、校园卡、生活服务和校内空教室属于后续能力，
需要分别完成统一认证、凭证作用域、专用 schema 或人工安全审查，不能从公开通知 capability
直接复用会话。

## 待确认事项

以下内容已在辅助项目 `/home/nancunchild/projects/DanXi` 中看到请求方向，但没有可直接提交的真实
响应 fixture，因此暂不宣称已完成：

- `fdjwgl.fudan.edu.cn` 课表 JSON 的完整课程、周次和节次字段映射。
- 本科成绩接口是否返回稳定学分字段；当前 DanXi 解析没有使用学分。
- `gaGrade` 的数字、字母和 P/F 全部取值，以及成绩是否可确定为 final。
- `id.fudan.edu.cn` Neo/Neo2FA 登录后的 Cookie 是否能由核心 WebView 安全收割并注入教务域。
- 研究生院通知 DOM 是否仍匹配 DanXi 的 selector；接入时需决定是增加来源参数还是单独 capability。
- 研究生课表中的 `yjsxktest.fudan.sh.cn` 是否为生产地址及是否支持 HTTPS。
- 一卡通卡号、币种、金额单位，以及消费流水金额的收支方向。
- Data Center 数组列定义、电费单位和 Neo2FA 会话边界。
- 考试、拥挤度、宿舍电费和场馆预约目前没有专用 Elecon capability/schema。

```bash
npm run check
```

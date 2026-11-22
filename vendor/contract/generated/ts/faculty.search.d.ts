// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

export interface FacultySearch {
  /** 当前查询页的教师；空数组表示本页无匹配结果，不能用于表示查询失败。 */
  items: FacultySearchItems[];
  /** 本页对应的请求页码，从 1 开始。 */
  page: number;
  /** 本次请求每页教师数量上限，单位为条；实际 items 可少于此值。 */
  pageSize: number;
  /** 来源是否确认当前查询还有下一页；false 表示没有下一页。 */
  hasMore: boolean;
  /** 校内来源系统的稳定标识，与学校共同限定教师 id。 */
  sourceSystem: string;
  /** 查询来源的公开 HTTPS 页面，供核对数据来源。 */
  sourceUrl: string;
  /** 来源报告的本次筛选结果总条数；缺失表示来源未提供，不从当前页推测。 */
  total?: number;
}

export interface FacultySearchItems {
  /** 学校和 sourceSystem 作用域内稳定的教师标识；同名教师不得合并。 */
  id: string;
  /** 教师公开显示姓名，纯文本。 */
  name: string;
  /** 公开所属学院或单位，纯文本；缺失表示来源未提供。 */
  department?: string;
  /** 公开职称，纯文本；缺失表示来源未提供。 */
  title?: string;
  /** 公开学科名称，纯文本；缺失表示来源未提供。 */
  disciplines?: string[];
  /** 公开研究方向，纯文本；缺失表示来源未提供。 */
  researchAreas?: string[];
  /** 公开简介摘录，纯文本，可能有截断；缺失表示来源未提供。 */
  summary?: string;
  /** 教师公开主页的绝对 HTTPS URL；缺失表示来源未提供，不作为教师身份。 */
  profileUrl?: string;
  /** 教师公开头像，PNG/JPEG/WebP base64 data URI，原始字节最多512KiB；缺失或解码失败显示占位，不由UI发起远端请求。 */
  photo?: string;
  /** 来源明确公开的联系邮箱文本；缺失表示未提供，不自动发送邮件。 */
  email?: string;
  /** 来源明确公开的联系电话文本，可包含分机或地区前缀；缺失表示未提供，不自动拨号。 */
  phone?: string;
  /** 公开办公地点，纯文本；缺失表示来源未提供。 */
  officeLocation?: string;
}

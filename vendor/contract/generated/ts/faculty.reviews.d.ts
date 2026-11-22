// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

export interface FacultyReviews {
  /** 与请求相同的教师ID，属于搜索来源。 */
  teacherId: string;
  /** 当前页评价；空表示本次查询无记录。 */
  items: FacultyReviewsItems[];
  /** 评价服务的展示名称。 */
  sourceLabel: string;
  /** 评价服务HTTPS来源。 */
  sourceUrl: string;
  /** 下一页不透明游标；缺失表示无后续。 */
  nextCursor?: string;
  /** 本教师在来源指定查询范围内全部公开评价统计，不受分页影响；缺失表示未提供，不等于零。 */
  statistics?: FacultyReviewsStatistics;
}

export interface FacultyReviewsItems {
  /** 来源内稳定评价ID。 */
  id: string;
  /** 来源课程名；未注明时由来源明确标注。 */
  subject: string;
  /** 评价纯文本，不作为HTML执行。 */
  content: string;
  /** 来源明确给出的推荐判断。 */
  isGood: boolean;
  /** 评价发布时间，RFC3339；不是抓取时间。 */
  createdAt: string;
  /** 评价来源名称。 */
  source: string;
}

export interface FacultyReviewsStatistics {
  /** 当前范围全部公开评价数量，单位条，等于good与bad之和。 */
  total: number;
  /** 当前范围全部公开好评数量，单位条。 */
  good: number;
  /** 当前范围全部公开差评数量，单位条。 */
  bad: number;
}

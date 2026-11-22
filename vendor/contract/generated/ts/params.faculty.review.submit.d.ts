// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

export interface ParamsFacultyReviewSubmit {
  /** 同来源教师ID。 */
  teacherId: string;
  /** 课程名称，去除首尾空白。 */
  subject: string;
  /** 用户主动输入的评价纯文本。 */
  content: string;
  /** 用户明确选择是否推荐。 */
  isGood: boolean;
  /** 本次显式投稿的幂等标识；同内容重试必须沿用。 */
  requestId: string;
}

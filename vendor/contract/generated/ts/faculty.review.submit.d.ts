// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

export interface FacultyReviewSubmit {
  /** 与请求相同的教师ID。 */
  teacherId: string;
  /** 本次显式投稿的幂等标识；同内容重试必须沿用。 */
  requestId: string;
  /** 服务确认的投稿状态；unknown表示请求可能已生效，不自动重发。 */
  status: "pending" | "published" | "rejected" | "hidden" | "deleted" | "unknown";
  /** 服务确认的评价ID；未知结果时缺失。 */
  reviewId?: string;
}

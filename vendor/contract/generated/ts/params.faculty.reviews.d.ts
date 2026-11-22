// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

export interface ParamsFacultyReviews {
  /** 同来源教师ID。 */
  teacherId: string;
  /** 同来源搜索结果教师显示名，供学校脚本查询；宿主不按姓名判断实体归属。 */
  teacherName: string;
  /** 同一查询上一页返回的游标。 */
  cursor?: string;
}

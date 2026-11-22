// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

export interface QueryPrefetch {
  /** 用户已启用的同包学期只读能力；本版本不扩展空教室1.0的三日授权。 */
  target: "schedule.week" | "grades.list" | "exam.list";
  /** 学校给出的稳定业务范围标识；宿主另绑定来源、身份及完整计划摘要。 */
  planId: string;
  /** 至多maxQueries项；id和规范化完整参数不得重复；禁止configure命令。 */
  queries: QueryPrefetchQueries[];
  /** 尚有后续候选时返回的学校游标；省略仅表示当前学校计划没有后续，不证明源站学期完整。 */
  nextCursor?: string;
}

export interface QueryPrefetchQueries {
  /** 计划内稳定分片标识，用于恢复进度，不充当全局实体ID。 */
  id: string;
  /** 目标能力的完整JSON参数；由学校解释自定义filters语义，宿主不补写字段。 */
  params: Record<string, unknown>;
  /** 学校声明的预期标准结果身份；提交前核对。schedule.week必须含week，其他目标不得含week。 */
  identity: QueryPrefetchQueriesIdentity;
}

export interface QueryPrefetchQueriesIdentity {
  /** 预期标准结果的学期ID，须与结果term完全相等。 */
  term: string;
  /** 仅课表目标必填，预期标准结果的教学周号。 */
  week?: number;
}

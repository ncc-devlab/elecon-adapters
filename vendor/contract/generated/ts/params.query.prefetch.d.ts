// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

export interface ParamsQueryPrefetch {
  /** 用户已启用的同包学期只读能力；本版本不扩展空教室1.0的三日授权。 */
  target: "schedule.week" | "grades.list" | "exam.list";
  /** 同来源已验证的种子查询；不会混入其他包或身份的数据。 */
  seed: ParamsQueryPrefetchSeed;
  /** 宿主允许的最大候选分片数；不等于执行额度，实际执行仍受20调用/80 HTTP滚动预算约束。 */
  maxQueries: number;
  /** 学校上次返回的续片游标；首次省略。宿主不解析或发明其含义。 */
  cursor?: string;
}

export interface ParamsQueryPrefetchSeed {
  /** 目标能力的完整JSON参数；由学校解释自定义filters语义，宿主不补写字段。 */
  params: Record<string, unknown>;
  /** 可选的同来源标准结果快照；缺失时脚本使用完整参数和自己的有界取数。 */
  data?: Record<string, unknown>;
}

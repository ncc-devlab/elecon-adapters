// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

export interface ParamsMessagesOpen {
  /** 本次核验的远端服务账号 ID；须与请求账号一致。 */
  accountId: string;
  /** 源站会话 ID；由 serviceId/accountId/conversationKind 共同限定。 */
  conversationId: string;
  /** group 群聊，direct 私聊；相同 ID 的不同类型不合并。 */
  conversationKind: "group" | "direct";
  /** 源站稳定消息 ID；十进制大整数保留字符串。 */
  messageId: string;
  /** 来源生成的网页引用，限 command。用户点击时原样交回同来源 messages.open；禁止包含凭据。省略表示仅展示。 */
  webRef: string;
}

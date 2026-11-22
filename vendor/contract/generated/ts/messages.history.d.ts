// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

export interface MessagesHistory {
  /** 稳定服务标识；不按显示名合并。 */
  serviceId: string;
  /** 本次核验的远端服务账号 ID；须与请求账号一致。 */
  accountId: string;
  /** 账号显示名；空表示未提供。 */
  accountLabel: string;
  /** 本次源站读取或发送核验完成的时刻，RFC3339；本地读取不更新。 */
  fetchedAt: string;
  /** 源站会话 ID；由 serviceId/accountId/conversationKind 共同限定。 */
  conversationId: string;
  /** group 群聊，direct 私聊；相同 ID 的不同类型不合并。 */
  conversationKind: "group" | "direct";
  /** 源站明确存在下一页时为 true；false 表示本次游标到源站历史末尾，非本地库完整性。 */
  hasMore: boolean;
  /** 下一页不透明游标，仅 hasMore=true 时提供；不得转浮点或跨账号/会话使用。 */
  nextCursor?: string;
  /** 本页规范消息，按发送时间升序；跨页可重复，按会话和 id 去重。 */
  items: MessagesHistoryItems[];
  /** 同会话已撤回消息的稳定 ID，允许与 items 重合。保留已获内容，附加撤回标签。 */
  recalledIds: string[];
  /** ADR-066：当前账号发送权限；allowed须来自当前源站核验，muted表示确认禁言/停用，unknown表示缺少证据。历史缓存不能授权发送。 */
  sendPermission?: "allowed" | "muted" | "unknown";
  /** 固定原因；不含源站异常或敏感信息。缺失时仅按sendPermission展示。 */
  sendPermissionReason?: "member_muted" | "group_muted" | "group_disabled" | "verification_failed";
}

export interface MessagesHistoryItems {
  /** 源站稳定消息 ID；十进制大整数保留字符串。 */
  id: string;
  /** 消息正文或附件的纯文本摘要，包括已经取得的撤回消息内容。 */
  text: string;
  /** command 使用统一指令气泡，其他类型显示文本或附件摘要。 */
  kind: "text" | "image" | "video" | "voice" | "file" | "location" | "activity" | "command" | "course" | "homework" | "task" | "unknown";
  /** 相对于本次核验账号的发送方向。 */
  direction: "incoming" | "outgoing";
  /** 源站发送者 ID，未知省略。 */
  senderId?: string;
  /** 发送者显示名，未知省略。 */
  senderLabel?: string;
  /** 源站明确给出的发送时刻，RFC3339；未知省略。 */
  sentAt?: string;
  /** 来源生成的网页引用，限 command。用户点击时原样交回同来源 messages.open；禁止包含凭据。省略表示仅展示。 */
  webRef?: string;
}

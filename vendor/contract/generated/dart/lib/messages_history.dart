// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

library;

class MessagesHistory {
  const MessagesHistory({
    required this.serviceId,
    required this.accountId,
    required this.accountLabel,
    required this.fetchedAt,
    required this.conversationId,
    required this.conversationKind,
    required this.hasMore,
    this.nextCursor,
    required this.items,
    required this.recalledIds,
    this.sendPermission,
    this.sendPermissionReason,
  });

  /// 稳定服务标识；不按显示名合并。
  final String serviceId;
  /// 本次核验的远端服务账号 ID；须与请求账号一致。
  final String accountId;
  /// 账号显示名；空表示未提供。
  final String accountLabel;
  /// 本次源站读取或发送核验完成的时刻，RFC3339；本地读取不更新。
  final String fetchedAt;
  /// 源站会话 ID；由 serviceId/accountId/conversationKind 共同限定。
  final String conversationId;
  /// group 群聊，direct 私聊；相同 ID 的不同类型不合并。
  final String conversationKind;
  /// 源站明确存在下一页时为 true；false 表示本次游标到源站历史末尾，非本地库完整性。
  final bool hasMore;
  /// 下一页不透明游标，仅 hasMore=true 时提供；不得转浮点或跨账号/会话使用。
  final String? nextCursor;
  /// 本页规范消息，按发送时间升序；跨页可重复，按会话和 id 去重。
  final List<MessagesHistoryItems> items;
  /// 同会话已撤回消息的稳定 ID，允许与 items 重合。保留已获内容，附加撤回标签。
  final List<String> recalledIds;
  /// ADR-066：当前账号发送权限；allowed须来自当前源站核验，muted表示确认禁言/停用，unknown表示缺少证据。历史缓存不能授权发送。
  final String? sendPermission;
  /// 固定原因；不含源站异常或敏感信息。缺失时仅按sendPermission展示。
  final String? sendPermissionReason;
}

class MessagesHistoryItems {
  const MessagesHistoryItems({
    required this.id,
    required this.text,
    required this.kind,
    required this.direction,
    this.senderId,
    this.senderLabel,
    this.sentAt,
    this.webRef,
  });

  /// 源站稳定消息 ID；十进制大整数保留字符串。
  final String id;
  /// 消息正文或附件的纯文本摘要，包括已经取得的撤回消息内容。
  final String text;
  /// command 使用统一指令气泡，其他类型显示文本或附件摘要。
  final String kind;
  /// 相对于本次核验账号的发送方向。
  final String direction;
  /// 源站发送者 ID，未知省略。
  final String? senderId;
  /// 发送者显示名，未知省略。
  final String? senderLabel;
  /// 源站明确给出的发送时刻，RFC3339；未知省略。
  final String? sentAt;
  /// 来源生成的网页引用，限 command。用户点击时原样交回同来源 messages.open；禁止包含凭据。省略表示仅展示。
  final String? webRef;
}

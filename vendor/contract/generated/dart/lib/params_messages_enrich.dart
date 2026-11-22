// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

library;

class ParamsMessagesEnrich {
  const ParamsMessagesEnrich({
    required this.accountId,
    required this.items,
    this.fields,
  });

  /// 本次核验的远端服务账号 ID；须与请求账号一致。
  final String accountId;
  /// 同一账号已展示的1–8个会话身份；kind与id共同标识实体，不允许重复。
  final List<ParamsMessagesEnrichItems> items;
  /// 1.1：本次需要的可选资料字段；省略请求全部。只返回所请求字段，缺失仍表示未知；请求 lastMessageAt 时须同时请求 hasContent。
  final List<String>? fields;
}

class ParamsMessagesEnrichItems {
  const ParamsMessagesEnrichItems({
    required this.conversationId,
    required this.conversationKind,
  });

  /// 源站会话 ID；由 serviceId/accountId/conversationKind 共同限定。
  final String conversationId;
  /// group 群聊，direct 私聊；相同 ID 的不同类型不合并。
  final String conversationKind;
}

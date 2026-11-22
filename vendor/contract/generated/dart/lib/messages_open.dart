// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

library;

class MessagesOpen {
  const MessagesOpen({
    required this.status,
  });

  /// 网页关闭、交互超时或页面返回；仅描述浏览生命周期。
  final String status;
}

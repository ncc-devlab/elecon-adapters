// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

library;

class FacultyReviews {
  const FacultyReviews({
    required this.teacherId,
    required this.items,
    required this.sourceLabel,
    required this.sourceUrl,
    this.nextCursor,
    this.statistics,
  });

  /// 与请求相同的教师ID，属于搜索来源。
  final String teacherId;
  /// 当前页评价；空表示本次查询无记录。
  final List<FacultyReviewsItems> items;
  /// 评价服务的展示名称。
  final String sourceLabel;
  /// 评价服务HTTPS来源。
  final String sourceUrl;
  /// 下一页不透明游标；缺失表示无后续。
  final String? nextCursor;
  /// 本教师在来源指定查询范围内全部公开评价统计，不受分页影响；缺失表示未提供，不等于零。
  final FacultyReviewsStatistics? statistics;
}

class FacultyReviewsItems {
  const FacultyReviewsItems({
    required this.id,
    required this.subject,
    required this.content,
    required this.isGood,
    required this.createdAt,
    required this.source,
  });

  /// 来源内稳定评价ID。
  final String id;
  /// 来源课程名；未注明时由来源明确标注。
  final String subject;
  /// 评价纯文本，不作为HTML执行。
  final String content;
  /// 来源明确给出的推荐判断。
  final bool isGood;
  /// 评价发布时间，RFC3339；不是抓取时间。
  final String createdAt;
  /// 评价来源名称。
  final String source;
}

class FacultyReviewsStatistics {
  const FacultyReviewsStatistics({
    required this.total,
    required this.good,
    required this.bad,
  });

  /// 当前范围全部公开评价数量，单位条，等于good与bad之和。
  final int total;
  /// 当前范围全部公开好评数量，单位条。
  final int good;
  /// 当前范围全部公开差评数量，单位条。
  final int bad;
}

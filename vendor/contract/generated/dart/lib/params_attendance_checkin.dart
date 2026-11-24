// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

library;

class ParamsAttendanceCheckin {
  const ParamsAttendanceCheckin({
    this.pageInput,
  });

  /// 同包页面编码的本次输入，最多 8192 个 Unicode 码点，缺省为空；由包解释。
  final String? pageInput;
}

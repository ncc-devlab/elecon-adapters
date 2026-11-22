// DO NOT EDIT —— 由 tools/src/codegen 从 contract/schema/ 生成。
// 改动请改 schema 并重跑 `npm run codegen`（红线 #6：契约即承重墙）。

export interface MessagesImage {
  /** 原图编码格式，必须与字节匹配。 */
  mimeType: "image/jpeg" | "image/png";
  /** 原图文件的标准 base64，解码后最多 1 MiB。 */
  base64: string;
}

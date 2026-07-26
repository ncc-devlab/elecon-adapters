/**
 * school-fudan（复旦大学）公开通知 declarative adapter。
 *
 * 当前只接入本科生院公开通知首页；教务系统、研究生系统和生活服务需要另行完成
 * IDS/统一认证、凭证作用域与 contract 审查，不在此 capability 中隐式访问。
 *
 * notice.list：无凭证、单次 GET → declarative（红线 #5）。
 * 分页 URL 形态为 list.htm / list2.htm…，非单一 {page} 模板；首版固定首页。
 */
import {
  getAttributeValue,
  getText,
  makeUrlAbsolute,
  normalizeDate,
  parseDocument,
  selectAll,
} from "elecon:html";

const ORIGIN = "https://jwc.fudan.edu.cn";

export const capabilities = {
  // 核心按 manifest.requests 代取 `page` 并脱敏后传入；须同步（无 I/O / 无 Promise）。
  "notice.list": (_ctx, _params, responses) =>
    parseNotices(responses.page.body, ORIGIN, "本科生院"),
};

function parseNotices(html, origin, source) {
  const doc = parseDocument(html);
  const items = [];
  for (const anchor of selectAll("a", doc)) {
    const href = getAttributeValue(anchor, "href") || "";
    const title = getText(anchor).replace(/\s+/g, " ").trim();
    if (!href || !title || !isNoticeLink(href)) continue;
    const item = {
      id: (href.match(/([^/?#]+)(?:[?#].*)?$/i)?.[1] || href).replace(/\.html?$/i, ""),
      title,
      url: makeUrlAbsolute(href, origin),
      category: "academic",
      source,
    };
    const date = getAttributeValue(anchor, "data-date") || "";
    const publishedAt = normalizeDate(date);
    if (publishedAt !== null) item.publishedAt = publishedAt;
    items.push(item);
  }
  return { items };
}

function isNoticeLink(href) {
  return /\.(?:htm|html)(?:[?#].*)?$/i.test(href) && !/^javascript:/i.test(href);
}

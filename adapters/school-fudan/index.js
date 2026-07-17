/**
 * school-fudan（复旦大学）公开通知 fetch adapter。
 *
 * 当前只接入本科生院公开通知；教务系统、研究生系统和生活服务需要另行完成
 * IDS/统一认证、凭证作用域与 contract 审查，不在此 capability 中隐式访问。
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
  "notice.list": async (ctx, params) => {
    const page = Number.isInteger(params?.page) && params.page > 0 ? params.page : 1;
    const suffix = page === 1 ? "" : String(page);
    const undergraduateResponse = await ctx.fetch(`${ORIGIN}/9397/list${suffix}.htm`);
    return parseNotices(await undergraduateResponse.text(), ORIGIN, "本科生院");
  },
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

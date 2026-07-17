/**
 * school-xidian（西安电子科技大学）fetch adapter。
 *
 * IDS 登录由核心托管 WebView 完成。adapter 不接触用户名/密码，只通过 manifest 中的
 * credentials 引用让 Broker 注入 E-Hall cookie；真实账号、cookie 和登录响应不得入库。
 */
import {
  getAttributeValue,
  getText,
  makeUrlAbsolute,
  normalizeDate,
  nextElementSibling,
  parseDocument,
  selectAll,
} from "elecon:html";

const ORIGIN = "https://jwc.xidian.edu.cn";
const SCHEDULE_APP = "https://ehall.xidian.edu.cn";
const SCHEDULE_APP_ID = "4770397878132218";

export const capabilities = {
  "notice.list": async (ctx, _params, responses) => {
    // 保留核心旧 golden 的离线 responses 入口；正式 fetch 运行走 ctx.fetch。
    if (responses?.page?.body) return parseNoticeHtml(responses.page.body);
    const response = await ctx.fetch(`${ORIGIN}/index.htm`);
    return parseNoticeHtml(await response.text());
  },

  "schedule.week": async (ctx, params) => {
    const week = params?.week;
    if (!Number.isInteger(week) || week < 1) {
      throw new Error("schedule.week: params.week 必须是正整数");
    }
    const term = params.term || (await getCurrentTerm(ctx));
    await openScheduleApp(ctx);
    const response = await postForm(ctx, `${SCHEDULE_APP}/jwapp/sys/wdkb/modules/xskcb/xskcb.do`, {
      XNXQDM: term,
    });
    const payload = await response.json();
    const result = payload?.datas?.xskcb;
    if (!result || result.extParams?.code !== 1) {
      throw new Error(`schedule query failed: ${result?.extParams?.msg || "invalid response"}`);
    }
    return { term, week, days: groupCourses(result.rows || [], week) };
  },
};

function parseNoticeHtml(html) {
  try {
    const doc = parseDocument(html);
    const tits = selectAll("div.tit", doc);
    const noticeTit = tits.find((el) => getText(el).includes("通知公告"));
    if (!noticeTit) return { items: [] };
    const ul = nextElementSibling(noticeTit);
    if (!ul) return { items: [] };

    const items = [];
    for (const li of selectAll("li", ul)) {
      const a = selectAll("a", li)[0];
      if (!a) continue;
      const href = getAttributeValue(a, "href") || "";
      const item = {
        id: (href.match(/\/?(\d+)\.htm$/) || [null, href])[1],
        title: getText(a).trim(),
        url: makeUrlAbsolute(href, ORIGIN),
        category: "academic",
        source: "教务处",
      };
      const publishedAt = normalizeDate(extractDateStr(li));
      if (publishedAt !== null) item.publishedAt = publishedAt;
      items.push(item);
    }
    return { items };
  } catch (e) {
    throw new Error(`notice parse failed: ${e.message || e}`);
  }
}

function extractDateStr(li) {
  const time = selectAll("div.time", li)[0];
  if (time) {
    const span = selectAll("span", time)[0];
    const p = selectAll("p", time)[0];
    const yearMonth = span ? getText(span).trim() : "";
    const day = p ? getText(p).trim() : "";
    if (yearMonth && day) return `${yearMonth}.${day}`;
    return yearMonth || day;
  }
  const span = selectAll("span", li)[0];
  return span ? getText(span).trim() : "";
}

async function openScheduleApp(ctx) {
  const response = await ctx.fetch(`${SCHEDULE_APP}/appShow?appId=${SCHEDULE_APP_ID}`);
  if (!response.ok && response.status !== 302) {
    throw new Error(`schedule app open failed: HTTP ${response.status}`);
  }
}

async function getCurrentTerm(ctx) {
  await openScheduleApp(ctx);
  const response = await postForm(ctx, `${SCHEDULE_APP}/jwapp/sys/wdkb/modules/jshkcb/dqxnxq.do`, {});
  const payload = await response.json();
  const term = payload?.datas?.dqxnxq?.rows?.[0]?.DM;
  if (!term) throw new Error("schedule: current term missing");
  return term;
}

async function postForm(ctx, url, fields) {
  const body = Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const response = await ctx.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });
  if (!response.ok) throw new Error(`request failed: HTTP ${response.status}`);
  return response;
}

function groupCourses(rows, week) {
  const days = [];
  for (const row of rows) {
    const weeks = parseWeeks(row.SKZC);
    if (!weeks.includes(week)) continue;
    const dayOfWeek = Number(row.SKXQ);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) continue;
    let day = days.find((item) => item.dayOfWeek === dayOfWeek);
    if (!day) {
      day = { dayOfWeek, slots: [] };
      days.push(day);
    }
    day.slots.push({
      start: String(row.KSJC ?? ""),
      end: String(row.JSJC ?? ""),
      courseName: String(row.KCM ?? ""),
      courseId: String(row.KCH ?? ""),
      teacher: String(row.SKJS ?? ""),
      location: String(row.JASMC ?? ""),
      weeks,
    });
  }
  days.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  for (const day of days) day.slots.sort((a, b) => Number(a.start) - Number(b.start));
  return days;
}

function parseWeeks(value) {
  const numbers = String(value || "").match(/\d+/g) || [];
  if (numbers.length < 2) return numbers.map(Number);
  const start = Number(numbers[0]);
  const end = Number(numbers[1]);
  const weeks = [];
  for (let week = start; week <= end; week += 1) weeks.push(week);
  return weeks;
}

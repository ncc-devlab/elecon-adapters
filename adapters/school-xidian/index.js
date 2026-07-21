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
const GRADES_APP_ID = "4768574631264620";
const EXAM_APP_ID = "4768687067472349";

// 本科 KSSJMS：`2025-06-20 09:00-11:00`（偶见 `::`）；研究生：`2025-06-20 周四(09:00-11:00)`
const EXAM_TIME_UG = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2})::?(\d{2})-(\d{2})::?(\d{2})/;
const EXAM_TIME_PG =
  /^(\d{4})-(\d{2})-(\d{2})\s+.{1,4}\((\d{2})::?(\d{2})-(\d{2})::?(\d{2})\)/;

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

  "grades.list": async (ctx, params) => {
    await openApp(ctx, GRADES_APP_ID);
    const response = await postForm(ctx, `${SCHEDULE_APP}/jwapp/sys/cjcx/modules/cjcx/xscjcx.do`, {
      "*json": "1",
      querySetting: JSON.stringify({
        name: "SFYX",
        value: "1",
        linkOpt: "and",
        builder: "m_value_equal",
      }),
      "*order": "+XNXQDM,KCH,KXH",
      pageSize: "1000",
      pageNumber: "1",
    });
    const payload = await response.json();
    const result = payload?.datas?.xscjcx;
    if (!result || result.extParams?.code !== 1) {
      throw new Error(`grades query failed: ${result?.extParams?.msg || "invalid response"}`);
    }
    const rows = result.rows || [];
    const term = params?.term || String(rows[0]?.XNXQDM || "");
    return { term, items: rows.filter((row) => !term || row.XNXQDM === term).map(mapGrade) };
  },

  "exam.list": async (ctx, params) => {
    const term = params?.term || (await getCurrentTerm(ctx));
    await openApp(ctx, EXAM_APP_ID);
    const response = await postForm(
      ctx,
      `${SCHEDULE_APP}/jwapp/sys/studentWdksapApp/modules/wdksap/wdksap.do`,
      {
        XNXQDM: term,
        pageSize: "100",
        pageNumber: "1",
        "*order": "-KSRQ,-KSSJMS",
      },
    );
    const payload = await response.json();
    const result = payload?.datas?.wdksap;
    if (!result || result.extParams?.code !== 1) {
      throw new Error(`exam query failed: ${result?.extParams?.msg || "invalid response"}`);
    }
    return { term, items: (result.rows || []).map(mapExam) };
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
  await openApp(ctx, SCHEDULE_APP_ID);
}

async function openApp(ctx, appId) {
  const response = await ctx.fetch(`${SCHEDULE_APP}/appShow?appId=${appId}`);
  if (!response.ok && response.status !== 302) {
    throw new Error(`app open failed: HTTP ${response.status}`);
  }
}

function mapGrade(row) {
  const rawScore = row.ZCJ;
  const numericScore = Number(rawScore);
  const score = Number.isFinite(numericScore) && String(rawScore).trim() !== ""
    ? { kind: "numeric", value: numericScore, max: 100 }
    : { kind: isPassFail(rawScore) ? "passfail" : "letter", value: String(rawScore ?? "") };
  const classStatus = String(row.XGXKLBDM_DISPLAY || row.KCXZDM_DISPLAY || "");
  return {
    courseId: String(row.JXBID || row.KCH || ""),
    courseName: String(row.XSKCM || ""),
    credit: toNumber(row.XF),
    score,
    category: classStatus.includes("必修") ? "required" : classStatus.includes("选修") ? "elective" : "unknown",
    status: row.CXCKDM_DISPLAY ? "provisional" : "final",
  };
}

function mapExam(row) {
  const examAt = parseExamAt(row.KSSJMS);
  const item = {
    courseName: String(row.KCM ?? ""),
    status: examAt ? "scheduled" : "unknown",
  };
  const courseId = String(row.KCH || row.JXBID || "").trim();
  if (courseId) item.courseId = courseId;
  if (examAt) item.examAt = examAt;
  const campus = String(row.XXXQMC ?? "").trim();
  if (campus) item.campus = campus;
  const building = String(row.JXLMC ?? "").trim();
  if (building) item.building = building;
  const room = String(row.JASMC ?? "").trim();
  if (room) item.room = room;
  const seat = String(row.ZWH ?? "").trim();
  if (seat) item.seat = seat;
  const examType = String(row.KSMC ?? "").trim();
  if (examType) item.examType = examType;
  return item;
}

/** KSSJMS → RFC3339 UTC（与 notice 一致：本地墙钟按 Z 产出，不转 +08:00）。 */
function parseExamAt(value) {
  const text = String(value || "").trim();
  if (!text || /cancel|取消|未知/.test(text)) return null;
  const match = text.match(EXAM_TIME_UG) || text.match(EXAM_TIME_PG);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  return `${y}-${mo}-${d}T${h}:${mi}:00Z`;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function isPassFail(value) {
  return /合格|通过|不合格|未通过/.test(String(value || ""));
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
  const text = String(value || "").trim();
  if (!text) return [];

  const globalOdd = /单周|[（(]单[)）]|奇数周/.test(text);
  const globalEven = /双周|[（(]双[)）]|偶数周/.test(text);
  // 单双互斥时以「单」优先，避免脏字符串两边都命中。
  const forceOdd = globalOdd && !globalEven ? true : globalOdd && globalEven ? true : false;
  const forceEven = globalEven && !globalOdd;

  const weeks = new Set();
  const segments = text.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean);

  for (const segment of segments) {
    const segOdd = forceOdd || /单周|[（(]单[)）]/.test(segment);
    const segEven = forceEven || /双周|[（(]双[)）]/.test(segment);
    const parity = segOdd && !segEven ? "odd" : segEven && !segOdd ? "even" : "all";

    let matchedRange = false;
    const rangeRe = /(\d+)\s*[-~～至到]\s*(\d+)/g;
    let match;
    while ((match = rangeRe.exec(segment)) !== null) {
      matchedRange = true;
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) continue;
      const last = Math.min(end, 32);
      for (let week = start; week <= last; week += 1) {
        if (parity === "odd" && week % 2 === 0) continue;
        if (parity === "even" && week % 2 === 1) continue;
        weeks.add(week);
      }
    }

    if (!matchedRange) {
      for (const raw of segment.match(/\d+/g) || []) {
        const week = Number(raw);
        if (!Number.isInteger(week) || week < 1 || week > 32) continue;
        if (parity === "odd" && week % 2 === 0) continue;
        if (parity === "even" && week % 2 === 1) continue;
        weeks.add(week);
      }
    }
  }

  return [...weeks].sort((a, b) => a - b);
}

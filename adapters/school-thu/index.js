const INFO = "https://webvpn.tsinghua.edu.cn/https/77726476706e69737468656265737421f9f9479369247b59700f81b9991b2631506205de";
const CJ = "https://webvpn.tsinghua.edu.cn/http/77726476706e69737468656265737421eaff4b8b69336153301c9aa596522b20e6e559a9b290";
const CARD = "https://card.tsinghua.edu.cn";
const APP = "https://app.cs.tsinghua.edu.cn";

export const capabilities = {
  "notice.list": async (ctx, params, responses) => {
    const html = responses?.page?.body || await text(ctx, `${INFO}/b/info/xxfb_fg/xnzx/template/more?oType=xs&lydw=${encodeURIComponent(params?.source || "")}`);
    return parseNotices(html);
  },

  "grades.list": async (ctx, params, responses) => {
    const html = responses?.page?.body || await text(ctx, `${CJ}/cj.cjCjbAll.do?m=bks_cjdcx&cjdlx=zw&flag=di${params?.flag || 1}`);
    return parseGrades(html, params?.term || "");
  },

  "schedule.week": async (ctx, params, responses) => {
    const week = params?.week;
    if (!Number.isInteger(week) || week < 1) throw new Error("schedule.week: params.week 必须是正整数");
    const firstDay = params?.firstDay || mondayOfCurrentWeek();
    const windows = responses?.windows || await scheduleWindows(ctx, firstDay, params?.graduate === true);
    const rows = windows.flatMap((body) => parseJsonp(body));
    return { term: String(params?.term || ""), week, days: groupCourses(rows, week) };
  },

  "card.balance": async (ctx, _params, responses) => {
    const payload = responses?.userInfo || await json(ctx, `${CARD}/business/getCardUserinfo`);
    return mapBalance(payload);
  },

  "card.transactions": async (ctx, params, responses) => {
    const body = responses?.transactions?.body || await (await ctx.fetch(`${CARD}/business/querySelfTradeList`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: formBody(params?.form || params || {}),
    })).text();
    return parseTransactions(body, params?.cardNumber || "");
  },
};

async function text(ctx, url, init) {
  const response = await ctx.fetch(url, init);
  if (!response.ok) throw new Error(`request failed: HTTP ${response.status}`);
  return response.text();
}

async function json(ctx, url, init) {
  const response = await ctx.fetch(url, init);
  if (!response.ok) throw new Error(`request failed: HTTP ${response.status}`);
  return response.json();
}

async function scheduleWindows(ctx, firstDay, graduate) {
  const start = new Date(`${firstDay}T00:00:00Z`);
  const result = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const from = addDays(start, offset * 21);
    const to = addDays(start, offset * 21 + 20);
    const prefix = graduate ? "yjs_jxrl_all" : "bks_jxrl_all";
    const url = `${CJ}/jxmh_out.do?m=${prefix}&p_start_date=${dateString(from)}&p_end_date=${dateString(to)}&jsoncallback=m`;
    result.push(await text(ctx, url));
  }
  return result;
}

function parseNotices(html) {
  const items = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = clean(match[2]);
    if (!title || title.length < 2) continue;
    const href = match[1];
    items.push({ id: (href.match(/(\d+)(?:\.htm)?$/) || [null, href])[1], title, url: absolute(href, INFO), category: "campus", source: "清华大学" });
  }
  return { items: uniqueById(items) };
}

function parseGrades(html, term) {
  const items = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => clean(cell[1]));
    if (cells.length < 12 || cells[3] === "") continue;
    const raw = cells[7] || "";
    const numeric = Number(raw);
    const score = Number.isFinite(numeric) && raw !== "" ? { kind: "numeric", value: numeric, max: 100 } : { kind: passFail(raw) ? "passfail" : "letter", value: raw };
    items.push({ courseId: cells[2] || cells[3], courseName: cells[3], credit: nonnegative(cells[5]), score, category: /必修/.test(cells.join(" ")) ? "required" : /选修/.test(cells.join(" ")) ? "elective" : "unknown", status: "final" });
  }
  return { term: String(term), items };
}

function groupCourses(rows, week) {
  const byDay = {};
  for (const row of rows) {
    const weeks = parseWeeks(row.SKZC);
    const day = Number(row.SKXQ);
    if (!weeks.includes(week) || day < 1 || day > 7) continue;
    (byDay[day] ||= []).push({ start: String(row.KSJC || ""), end: String(row.JSJC || ""), courseName: String(row.KCM || row.KCM_DISPLAY || ""), courseId: String(row.KCH || ""), teacher: String(row.SKJS || ""), location: String(row.JASMC || ""), weeks });
  }
  return Object.keys(byDay).sort((a, b) => a - b).map((day) => ({ dayOfWeek: Number(day), slots: byDay[day] }));
}

function mapBalance(payload) {
  const data = payload?.data || payload?.result || payload || {};
  const balance = number(data.balance ?? data.money ?? data.cardBalance ?? data.BALANCE);
  return { cardNumber: String(data.cardNumber ?? data.cardno ?? data.idserial ?? ""), balance: { amountMinor: Math.round(balance * 100), currency: "CNY" } };
}

function parseTransactions(body, cardNumber) {
  const items = [];
  for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => clean(cell[1]));
    if (cells.length < 3 || !/\d{4}[-/.]\d{1,2}/.test(cells[0])) continue;
    const amount = number(cells[2]);
    items.push({ time: dateTime(cells[0]), amountMinor: Math.round(Math.abs(amount) * 100), currency: "CNY", direction: amount < 0 ? "debit" : "credit", merchant: cells[1] || "" });
  }
  return { cardNumber: String(cardNumber), items };
}

function parseJsonp(body) {
  const value = String(body).replace(/^\s*\w+\s*\(/, "").replace(/\)\s*;?\s*$/, "");
  try { const data = JSON.parse(value); return data?.rows || data?.data?.rows || []; } catch { return []; }
}
function parseWeeks(value) { const numbers = String(value || "").match(/\d+/g) || []; if (numbers.length < 2) return numbers.map(Number); const result = []; for (let n = Number(numbers[0]); n <= Number(numbers[1]); n += 1) result.push(n); return result; }
function clean(value) { return String(value).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); }
function absolute(href, base) { return /^https?:\/\//i.test(href) ? href : `${base}/${String(href).replace(/^\//, "")}`; }
function uniqueById(items) { const seen = {}; return items.filter((item) => !seen[item.id] && (seen[item.id] = true)); }
function passFail(value) { return /合格|通过|不合格|未通过/.test(value); }
function nonnegative(value) { return Math.max(0, number(value)); }
function number(value) { const result = Number.parseFloat(String(value).replace(/,/g, "").replace(/[^\d.-]/g, "")); return Number.isFinite(result) ? result : 0; }
function dateTime(value) { const normalized = String(value).replace(/[/.]/g, "-"); return `${normalized.length === 10 ? normalized : normalized.slice(0, 10)}T00:00:00Z`; }
function formBody(fields) { return Object.entries(fields).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&"); }
function addDays(date, days) { const result = new Date(date); result.setUTCDate(result.getUTCDate() + days); return result; }
function dateString(date) { return date.toISOString().slice(0, 10).replace(/-/g, ""); }
function mondayOfCurrentWeek() { const now = new Date(); now.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return now.toISOString().slice(0, 10); }

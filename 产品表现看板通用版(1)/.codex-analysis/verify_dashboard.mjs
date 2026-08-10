import fs from "node:fs";

const htmlPath = "outputs/产品表现离线看板.html";
const html = fs.readFileSync(htmlPath, "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 1) throw new Error(`Expected 1 inline script, found ${scripts.length}`);
if (html.includes("__DATA_JSON__")) throw new Error("Data placeholder was not replaced");
if (!html.includes('<meta charset="utf-8">')) throw new Error("UTF-8 declaration missing");

const script = scripts[0];
new Function(script);

const match = script.match(/const DASHBOARD_DATA = (\{[\s\S]*?\});\r?\nconst rows =/);
if (!match) throw new Error("Embedded dashboard data not found");
const data = JSON.parse(match[1]);
const totals = {};
for (const key of ["units", "orders", "netSales", "profit", "spend", "adSales", "sessions"]) {
  totals[key] = data.rows.reduce((sum, row) => sum + (row[key] || 0), 0);
}
totals.acoas = totals.spend / totals.netSales;
totals.margin = totals.profit / totals.netSales;
totals.orderCvr = totals.orders / totals.sessions;
const bdRows = data.rows.filter((row) => row.bd).length;

const requiredIds = [
  "dateFrom", "dateTo", "rankDimension", "granularity", "resetFilters",
  "kpis", "moneyChart", "orderMixChart", "conversionChart", "rankChart",
  "tableHead", "tableBody", "compareAFrom", "compareATo", "compareBFrom",
  "compareBTo", "compareMetricControls", "compareCards",
];
const missingIds = requiredIds.filter((id) => !html.includes(`id="${id}"`));
if (missingIds.length) throw new Error(`Missing elements: ${missingIds.join(", ")}`);
if (!html.includes("BD ASIN")) throw new Error("BD labels are missing");
for (const token of ["page-tabs", "data-view=\"main\"", "main-page-block", "compare-page-block", "function setView"]) {
  if (!html.includes(token)) throw new Error(`Missing page switch token: ${token}`);
}
if (!html.includes(".compare-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));")) {
  throw new Error("Compare cards must render as two columns on wide screens");
}
if (!html.includes(".compare-grid { grid-template-columns: 1fr; }")) {
  throw new Error("Compare cards must collapse to one column on narrow screens");
}
for (const token of ["function previousRange", "function previousGroups", "function formatPreviousValue", "cell-compare"]) {
  if (!html.includes(token)) throw new Error(`Missing table previous-period token: ${token}`);
}
if (html.includes("前期：")) {
  throw new Error("Previous-period table values must show only the value, without the 前期 prefix");
}
if (html.includes("百分点")) {
  throw new Error("Table period-over-period values must not use percentage-point wording");
}
for (const token of ["compare-body", "compare-bars", "compare-bar-row", "compare-bar-fill"]) {
  if (!html.includes(token)) throw new Error(`Missing redesigned compare card token: ${token}`);
}
for (const token of ["bdScheduleByParent", "function bdScheduleText", "label-with-bd", "title=\"${esc(bdScheduleText", "th:nth-child(2), td:nth-child(2)", "left: 220px"]) {
  if (!html.includes(token)) throw new Error(`Missing sticky/BD schedule token: ${token}`);
}
if (!html.includes('["label","维度","text"],["note","数据说明","note"],["netSales"')) {
  throw new Error("Data note column must be second, immediately after the dimension column");
}
if (!html.includes("grid-template-columns: 130px 130px minmax(135px, 1fr) 105px 110px 125px minmax(135px, 1fr);")) {
  throw new Error("Top filter grid must use the compact one-row layout");
}

console.log(JSON.stringify({
  bytes: Buffer.byteLength(html),
  rows: data.rows.length,
  mappedAsins: data.meta.mappedAsins,
  dateRange: [data.meta.minDate, data.meta.maxDate],
  filters: Object.fromEntries(Object.entries(data.meta.options).map(([k, v]) => [k, v.length])),
  totals,
  bdRows,
  bdMatchedAsins: data.meta.bdMatchedAsins,
  scriptSyntax: "ok",
  requiredElements: "ok",
}, null, 2));

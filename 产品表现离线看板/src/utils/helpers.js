/* ============================================================
   通用工具函数
   ============================================================ */

/** 安全除法 */
export function safeDiv(a, b) {
  return b ? a / b : NaN;
}

/** HTML 转义 */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

/** 规范化：去空白/标点/大小写 */
export function norm(value) {
  return cleanText(value).replace(/[\s\n\r\t（）()_\-—:/：/]+/g, "").toLowerCase();
}

/** 文本清洗 */
export function cleanText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    // Excel serial date detection (40000~60000 range = 2009~2064)
    if (value > 40000 && value < 60000) {
      const d = new Date((value - 25569) * 86400 * 1000);
      return d.toISOString().slice(0, 10);
    }
    return String(value);
  }
  return String(value).trim();
}

/** 日期清洗：取前10位 */
export function cleanDate(value) {
  const text = cleanText(value);
  return text ? text.slice(0, 10) : "";
}

/** 数值清洗：等价 Python number() */
export function parseNumber(value) {
  if (value == null || value === "") return 0.0;
  if (typeof value === "number") {
    if (isNaN(value)) return 0.0;
    return value;
  }
  let text = String(value).trim().replace(/,/g, "").replace(/\$/g, "");
  if (!text || ["-", "--", "N/A", "#N/A"].includes(text)) return 0.0;
  if (text.endsWith("%")) {
    text = text.slice(0, -1);
    const n = parseFloat(text);
    return isNaN(n) ? 0.0 : n / 100;
  }
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : 0.0;
}

/** 日期加天数 */
export function dateAdd(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 日期跨度天数 */
export function dateSpanDays(from, to) {
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  return Math.floor((end - start) / 86400000) + 1;
}

/** 时间粒度桶 */
export function periodKey(date, granularity) {
  if (granularity === "day") return date;
  if (granularity === "month") return date.slice(0, 7);
  const d = new Date(date + "T00:00:00Z");
  const delta = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - delta);
  return d.toISOString().slice(0, 10);
}

/** 前周期范围 */
export function previousRange(from, to) {
  const a = from <= to ? from : to;
  const b = from <= to ? to : from;
  const days = dateSpanDays(a, b);
  const prevTo = dateAdd(a, -1);
  const prevFrom = dateAdd(prevTo, 1 - days);
  return { from: prevFrom, to: prevTo, days };
}

/** 图表 Y 轴最大值取整 */
export function niceMax(v) {
  if (!v) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

/** 文件大小格式化 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

/** localStorage 备注 key */
export function noteStorageKey(parent) {
  return `product-dashboard-parent-note::${parent}`;
}

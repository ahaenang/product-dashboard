/* ============================================================
   数字/货币/百分比格式化
   ============================================================ */

const money0Formatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const money2Formatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function fmtMoney0(v) {
  return money0Formatter.format(v || 0);
}

export const fmtMoney = fmtMoney0;

export function fmtMoney2(v) {
  return money2Formatter.format(v || 0);
}

export function fmtNum(v) {
  return numberFormatter.format(v || 0);
}

export function fmtPct(v) {
  return Number.isFinite(v) ? (v * 100).toFixed(2) + "%" : "—";
}

export function fmtCompact(v) {
  return compactFormatter.format(v || 0);
}

export function formatMetric(v, type) {
  if (type === "money") return fmtMoney2(v || 0);
  if (type === "pct") return fmtPct(v);
  return fmtNum(v || 0);
}

export function formatPreviousValue(previous, type) {
  if (!Number.isFinite(previous)) return "-";
  if (type === "money") return fmtMoney2(previous || 0);
  if (type === "pct") return fmtPct(previous);
  return fmtNum(previous || 0);
}

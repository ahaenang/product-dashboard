/* ============================================================
   全局状态管理 — Context + useReducer
   ============================================================ */

import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import { loadDashboardData, getAllFiles } from './db.js';
import { safeDiv, dateSpanDays, dateAdd, periodKey, previousRange } from '../utils/helpers.js';

const DashboardContext = createContext(null);

const dims = { store: "统计店铺", country: "国家", stage: "阶段", series: "系列", parent: "父体" };
const metricKeys = ["units", "sales", "orders", "netSales", "b2bUnits", "b2bOrders", "profit", "returns", "sessionsBrowser", "sessionsMobile", "sessions", "impressions", "clicks", "spend", "adSales", "adOrders", "naturalClicks", "naturalOrders"];

export const trendMetrics = {
  netSales: { label: "净销售额", type: "money", color: "var(--primary)" },
  sales: { label: "销售额", type: "money", color: "var(--teal)" },
  profit: { label: "毛利润", type: "money", color: "var(--green)" },
  spend: { label: "广告花费", type: "money", color: "var(--amber)" },
  adSales: { label: "广告销售额", type: "money", color: "var(--purple)" },
};

export const rankMetrics = {
  netSales: { label: "净销售额", type: "money" },
  profit: { label: "毛利润", type: "money" },
  spend: { label: "广告花费", type: "money" },
  acos: { label: "ACOS", type: "pct" },
  acoas: { label: "TACOS", type: "pct" },
  orders: { label: "订单量", type: "num" },
  units: { label: "销量", type: "num" },
};

export const compareMetrics = {
  netSales: { label: "净销售额", type: "money" },
  sales: { label: "销售额", type: "money" },
  profit: { label: "订单毛利润", type: "money" },
  margin: { label: "毛利率", type: "pct" },
  spend: { label: "广告花费", type: "money" },
  adSales: { label: "广告销售额", type: "money" },
  acos: { label: "ACOS", type: "pct" },
  acoas: { label: "TACOS", type: "pct" },
  units: { label: "销量", type: "num" },
  orders: { label: "订单量", type: "num" },
  sessions: { label: "会话", type: "num" },
  orderCvr: { label: "订单转化率", type: "pct" },
  unitCvr: { label: "销量转化率", type: "pct" },
  adShare: { label: "广告占比", type: "pct" },
  returnRate: { label: "退货率", type: "pct" },
  bdAsinCount: { label: "BD ASIN", type: "num" },
};

export const columns = [
  ["label", "维度", "text"], ["note", "数据说明", "note"], ["netSales", "净销售额", "money"],
  ["profit", "订单毛利润", "money"], ["margin", "毛利率", "pct"], ["spend", "广告花费", "money"],
  ["acos", "ACOS", "pct"], ["acoas", "TACOS", "pct"], ["units", "销量", "num"],
  ["orders", "订单量", "num"], ["orderCvr", "订单转化率", "pct"], ["unitCvr", "销量转化率", "pct"],
  ["adShare", "广告占比", "pct"], ["returnRate", "退货率", "pct"], ["bdAsinCount", "BD ASIN", "num"],
];

export { dims, metricKeys };

function initialFilters(meta) {
  const f = {};
  for (const k of Object.keys(dims)) {
    f[k] = new Set(meta?.options?.[k] || []);
  }
  return f;
}

function buildInit(meta) {
  return {
    dateFrom: meta?.minDate || "",
    dateTo: meta?.maxDate || "",
    granularity: "day",
    rankDimension: "parent",
    rankMetric: "netSales",
    trendMetrics: new Set(["netSales", "profit", "spend"]),
    compareMetrics: new Set(["netSales", "profit", "spend", "acoas", "orders", "units"]),
    filters: initialFilters(meta),
    view: "main",
    tableSort: { key: "netSales", dir: -1 },
    buildState: "idle", // idle | building | done | error
    buildLog: [],
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "SET_DATA": {
      const meta = action.payload.meta;
      const filters = {};
      for (const k of Object.keys(dims)) {
        filters[k] = new Set(meta?.options?.[k] || []);
      }
      return {
        ...state,
        dashboardData: action.payload,
        rows: action.payload.rows,
        meta,
        dateFrom: meta.minDate || "",
        dateTo: meta.maxDate || "",
        filters,
        buildState: "done",
      };
    }
    case "SET_DATE_RANGE":
      return { ...state, dateFrom: action.from, dateTo: action.to };
    case "SET_GRANULARITY":
      return { ...state, granularity: action.value };
    case "SET_FILTER": {
      const f = { ...state.filters, [action.dimension]: action.values };
      return { ...state, filters: f };
    }
    case "SET_RANK_DIMENSION":
      return { ...state, rankDimension: action.value };
    case "SET_RANK_METRIC":
      return { ...state, rankMetric: action.value };
    case "SET_TREND_METRICS":
      return { ...state, trendMetrics: action.values };
    case "SET_COMPARE_METRICS":
      return { ...state, compareMetrics: action.values };
    case "SET_VIEW":
      return { ...state, view: action.value };
    case "SET_TABLE_SORT":
      return { ...state, tableSort: action.payload };
    case "SET_BUILD_STATE":
      return {
        ...state,
        buildState: action.buildState,
        buildLog: action.log !== undefined ? action.log : state.buildLog,
      };
    case "APPEND_BUILD_LOG": {
      const line = `[${new Date().toLocaleTimeString()}] ${action.message}`;
      return { ...state, buildLog: [...state.buildLog, line] };
    }
    case "CLEAR_BUILD_LOG":
      return { ...state, buildLog: [] };
    case "RESET_FILTERS": {
      const meta = state.meta;
      const filters = {};
      for (const k of Object.keys(dims)) {
        filters[k] = new Set(meta?.options?.[k] || []);
      }
      return {
        ...state,
        dateFrom: meta?.minDate || "",
        dateTo: meta?.maxDate || "",
        granularity: "day",
        rankDimension: "parent",
        rankMetric: "netSales",
        filters,
      };
    }
    default:
      return state;
  }
}

export function DashboardProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { rows: [], meta: {} }, (init) => ({
    ...init,
    ...buildInit(null),
  }));

  // 初始化：从 IndexedDB 加载数据
  useEffect(() => {
    (async () => {
      try {
        const saved = await loadDashboardData();
        if (saved?.payload) {
          dispatch({ type: "SET_DATA", payload: saved.payload });
        }
      } catch (err) {
        console.error("加载 IndexedDB 数据失败:", err);
      }
    })();
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

export function useRows() {
  return useContext(DashboardContext)?.state?.rows || [];
}

export function useMeta() {
  return useContext(DashboardContext)?.state?.meta || {};
}

// ---- 聚合与计算 hooks ----

function calculate(a) {
  return Object.assign(a, {
    bdAsinCount: a.bdAsin ? a.bdAsin.size : 0,
    bdShare: safeDiv(a.bdRows || 0, a.rowCount || 0),
    naturalShare: safeDiv(a.naturalOrders, a.naturalOrders + a.adOrders),
    adShare: safeDiv(a.adOrders, a.naturalOrders + a.adOrders),
    orderCvr: safeDiv(a.orders, a.sessions),
    unitCvr: safeDiv(a.units, a.sessions),
    adCvr: safeDiv(a.adOrders, a.clicks),
    naturalCvr: safeDiv(a.naturalOrders, a.naturalClicks),
    acos: safeDiv(a.spend, a.adSales),
    acoas: safeDiv(a.spend, a.netSales),
    margin: safeDiv(a.profit, a.netSales),
    returnRate: safeDiv(a.returns, a.units),
    ctr: safeDiv(a.clicks, a.impressions),
    cpc: safeDiv(a.spend, a.clicks),
    roas: safeDiv(a.adSales, a.spend),
  });
}

function emptyAgg(label) {
  if (label === undefined) label = "";
  const a = { label, asin: new Set(), bdAsin: new Set(), bdRows: 0, rowCount: 0 };
  metricKeys.forEach(k => a[k] = 0);
  return a;
}

function addTo(a, r) {
  metricKeys.forEach(k => a[k] += r[k] || 0);
  if (r.bd) { a.bdRows++; a.bdAsin.add(r.asin); }
  a.asin.add(r.asin);
  a.rowCount++;
  return a;
}

export function aggregate(items, keyFn) {
  const map = new Map();
  items.forEach(r => {
    const key = keyFn(r);
    if (!map.has(key)) map.set(key, emptyAgg(key));
    addTo(map.get(key), r);
  });
  return [...map.values()].map(calculate);
}

export function total(items) {
  const a = emptyAgg("合计");
  items.forEach(r => addTo(a, r));
  return calculate(a);
}

export function filteredRows(rows, state) {
  if (!rows.length) return [];
  return rows.filter(r =>
    r.date >= state.dateFrom && r.date <= state.dateTo &&
    Object.keys(dims).every(k => state.filters[k]?.has(r[k]))
  );
}

export function useFilteredRows() {
  const { state } = useDashboard();
  return useMemo(() => filteredRows(state.rows || [], state), [
    state.rows, state.dateFrom, state.dateTo, state.filters,
  ]);
}

export function useTimeData(filtered) {
  const { state } = useDashboard();
  return useMemo(() => {
    return aggregate(filtered, r => periodKey(r.date, state.granularity)).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, state.granularity]);
}

export function useTotal(filtered) {
  return useMemo(() => total(filtered), [filtered]);
}

export function useGroupedData(filtered) {
  const { state } = useDashboard();
  return useMemo(() => aggregate(filtered, r => r[state.rankDimension]), [filtered, state.rankDimension]);
}

function rangeHasCompleteDates(from, to, meta, rows) {
  if (!meta.minDate || !meta.maxDate) return false;
  if (from < meta.minDate || to > meta.maxDate) return false;
  const expected = dateSpanDays(from, to);
  const seen = new Set(rows.filter(r => r.date >= from && r.date <= to).map(r => r.date));
  return seen.size === expected;
}

function rowsInRange(from, to, rows, filters) {
  return rows.filter(r =>
    r.date >= from && r.date <= to &&
    Object.keys(dims).every(k => filters[k]?.has(r[k]))
  );
}

const EMPTY_PREV = { complete: false, map: new Map(), range: { from: "", to: "", days: 0 } };

export function usePreviousGroups(filtered) {
  const { state } = useDashboard();
  const dim = state.rankDimension;
  return useMemo(() => {
    if (!state.dateFrom || !state.dateTo || !state.meta?.minDate) return EMPTY_PREV;
    const prev = previousRange(state.dateFrom, state.dateTo);
    if (!rangeHasCompleteDates(prev.from, prev.to, state.meta, state.rows || [])) {
      return { complete: false, map: new Map(), range: prev };
    }
    return {
      complete: true,
      map: new Map(aggregate(rowsInRange(prev.from, prev.to, state.rows || [], state.filters), r => r[dim]).map(d => [d.label, d])),
      range: prev,
    };
  }, [filtered, state.dateFrom, state.dateTo, dim, state.meta?.minDate, state.meta?.maxDate]);
}

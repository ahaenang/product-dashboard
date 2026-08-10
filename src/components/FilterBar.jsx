import React, { useRef, useCallback, useEffect } from 'react';
import { useDashboard, dims } from '../store/DashboardContext';
import { esc } from '../utils/helpers';
import { fmtNum } from '../utils/format';

export default function FilterBar() {
  const { state, dispatch } = useDashboard();
  const meta = state.meta || {};
  const debounceTimers = useRef({});
  const containerRef = useRef(null);

  // Computed status line
  const filtered = state.rows ? state.rows.filter(r =>
    r.date >= state.dateFrom && r.date <= state.dateTo &&
    Object.keys(dims).every(k => state.filters[k]?.has(r[k]))
  ) : [];
  const tAsinSize = new Set(filtered.map(r => r.asin)).size;
  const tBdCount = filtered.filter(r => r.bd).length;

  const handleDateChange = useCallback(() => {
    const fromEl = document.getElementById("dateFrom");
    const toEl = document.getElementById("dateTo");
    dispatch({
      type: "SET_DATE_RANGE",
      from: fromEl?.value || meta.minDate || "",
      to: toEl?.value || meta.maxDate || "",
    });
  }, [dispatch, meta.minDate, meta.maxDate]);

  const handleFilterChange = useCallback((key) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
      const root = document.querySelector(`.multi[data-filter="${key}"]`);
      if (!root) return;
      const checked = [...root.querySelectorAll("input:checked")].map(x => x.value);
      dispatch({ type: "SET_FILTER", dimension: key, values: new Set(checked) });
    }, 300);
  }, [dispatch]);

  const resetFilters = useCallback(() => {
    dispatch({ type: "RESET_FILTERS" });
  }, [dispatch]);

  // Sync DOM elements with state on filter changes
  useEffect(() => {
    for (const key of Object.keys(dims)) {
      syncMultiDOM(key, state.filters[key], meta.options?.[key] || []);
    }
  }, [state.filters, meta.options]);

  // Sync date inputs
  useEffect(() => {
    const fromEl = document.getElementById("dateFrom");
    const toEl = document.getElementById("dateTo");
    if (fromEl) fromEl.value = state.dateFrom || "";
    if (toEl) toEl.value = state.dateTo || "";
  }, [state.dateFrom, state.dateTo]);

  // Global click to close multi-selects
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest(".multi")) {
        document.querySelectorAll(".multi[open]").forEach(x => { x.open = false; });
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <section className="panel filters main-page-block" aria-label="筛选条件" ref={containerRef}>
      <div className="filter-grid">
        <label className="field">
          <span className="field-label">开始日期</span>
          <input id="dateFrom" type="date" defaultValue={state.dateFrom} onChange={handleDateChange} />
        </label>
        <label className="field">
          <span className="field-label">结束日期</span>
          <input id="dateTo" type="date" defaultValue={state.dateTo} onChange={handleDateChange} />
        </label>
        {Object.entries(dims).map(([key, label]) => (
          <div className="field" key={key}>
            <span className="field-label">{label}</span>
            <details className="multi" data-filter={key}>
              <summary>{summaryText(key, state.filters[key], meta.options?.[key] || [])}</summary>
              <div className="multi-menu"
                dangerouslySetInnerHTML={{ __html: buildMultiMenu(key, meta.options?.[key] || [], state.filters[key]) }}
                onClick={(e) => {
                  const action = e.target.dataset?.action;
                  const menu = e.currentTarget;
                  if (action) {
                    menu.querySelectorAll("input").forEach(x => x.checked = action === "all");
                  }
                  handleFilterChange(key);
                }}
              />
            </details>
          </div>
        ))}
      </div>
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="field-label" style={{ margin: 0 }}>时间粒度</span>
          <div className="seg" role="group" aria-label="时间粒度">
            {["day", "week", "month"].map(g => (
              <button key={g} type="button" data-value={g}
                className={state.granularity === g ? "active" : ""}
                onClick={() => dispatch({ type: "SET_GRANULARITY", value: g })}
              >{g === "day" ? "日" : g === "week" ? "周" : "月"}</button>
            ))}
          </div>
          <span className="status">{fmtNum(filtered.length)} 条明细 · {fmtNum(tAsinSize)} 个 ASIN · BD {fmtNum(tBdCount)} 个</span>
        </div>
        <div className="toolbar-right">
          <button className="btn" type="button" onClick={resetFilters}>重置筛选</button>
        </div>
      </div>
    </section>
  );
}

function summaryText(key, filterSet, allOptions) {
  const checked = filterSet?.size || 0;
  if (checked === allOptions.length) return `全部${dims[key]}`;
  if (checked) return `已选 ${checked}/${allOptions.length}`;
  return "未选择";
}

function syncMultiDOM(key, filterSet, allOptions) {
  const root = document.querySelector(`.multi[data-filter="${key}"]`);
  if (!root) return;
  const summary = root.querySelector("summary");
  if (summary) summary.textContent = summaryText(key, filterSet, allOptions);
  // Also sync checkbox states
  root.querySelectorAll("input[type=checkbox]").forEach(cb => {
    if (filterSet) cb.checked = filterSet.has(cb.value);
  });
}

function buildMultiMenu(key, options, filterSet) {
  const opts = options.map(v =>
    `<label class="option"><input type="checkbox" value="${esc(v)}" ${filterSet?.has(v) ? "checked" : ""}><span>${esc(v)}</span></label>`
  ).join("");
  return `<div class="multi-actions"><button type="button" class="mini-btn" data-action="all">全选</button><button type="button" class="mini-btn" data-action="none">清空</button></div>${opts}`;
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDashboard, dims, compareMetrics } from '../store/DashboardContext';
import { filteredRows, total } from '../store/DashboardContext';
import { safeDiv, dateAdd, esc } from '../utils/helpers';
import { fmtNum, formatMetric } from '../utils/format';

export default function ComparePage() {
  const { state, dispatch } = useDashboard();
  const meta = state.meta || {};
  const rows = state.rows || [];

  // Controlled date inputs
  const [aFrom, setAFrom] = useState("");
  const [aTo, setATo] = useState("");
  const [bFrom, setBFrom] = useState("");
  const [bTo, setBTo] = useState("");

  // Initialize compare dates when meta loads
  useEffect(() => {
    if (!meta.minDate || !meta.maxDate) return;
    const min = meta.minDate, max = meta.maxDate;
    const newAFrom = dateAdd(max, -1) < min ? min : dateAdd(max, -1);
    const newATo = max;
    const newBFrom = min;
    const newBTo = dateAdd(min, 1) > max ? max : dateAdd(min, 1);
    if (!aFrom) { setAFrom(newAFrom); setATo(newATo); setBFrom(newBFrom); setBTo(newBTo); }
  }, [meta.minDate, meta.maxDate]);

  const handleSelectAll = useCallback((action) => {
    dispatch({
      type: "SET_COMPARE_METRICS",
      values: new Set(action === "all" ? Object.keys(compareMetrics) : []),
    });
  }, [dispatch]);

  // Compute comparison (depends on controlled date state + filters)
  const compareResult = useMemo(() => {
    if (!aFrom || !meta.minDate) return null;

    const aStart = aFrom > aTo ? aTo : aFrom;
    const aEnd = aFrom > aTo ? aFrom : aTo;
    const bStart = bFrom > bTo ? bTo : bFrom;
    const bEnd = bFrom > bTo ? bFrom : bTo;

    const a = total(filteredRows(rows, {
      ...state,
      dateFrom: aStart,
      dateTo: aEnd,
    }));
    const b = total(filteredRows(rows, {
      ...state,
      dateFrom: bStart,
      dateTo: bEnd,
    }));

    return { a, b, aStart, aEnd, bStart, bEnd };
  }, [rows, state.filters, aFrom, aTo, bFrom, bTo, meta.minDate]);

  const active = [...state.compareMetrics].filter(k => compareMetrics[k]);
  const statusText = compareResult
    ? `A：${compareResult.aStart} 至 ${compareResult.aEnd}（${fmtNum(compareResult.a.rowCount)} 条 · ${fmtNum(compareResult.a.asin.size)} ASIN）｜B：${compareResult.bStart} 至 ${compareResult.bEnd}（${fmtNum(compareResult.b.rowCount)} 条 · ${fmtNum(compareResult.b.asin.size)} ASIN）`
    : "选择两个任意时间段进行对比";

  if (!meta.minDate) {
    return (
      <section className="panel compare-panel">
        <div className="empty">暂无数据，请先上传数据源并构建看板</div>
      </section>
    );
  }

  return (
    <section className="panel compare-panel" aria-label="自定义时间对比">
      <div className="compare-head">
        <div>
          <h2 className="panel-title">自定义时间对比</h2>
          <div className="panel-subtitle">{statusText}</div>
        </div>
      </div>
      <div className="compare-controls">
        <label className="field">
          <span className="field-label">时间段A开始</span>
          <input type="date" value={aFrom} onChange={e => setAFrom(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">时间段A结束</span>
          <input type="date" value={aTo} onChange={e => setATo(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">时间段B开始</span>
          <input type="date" value={bFrom} onChange={e => setBFrom(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">时间段B结束</span>
          <input type="date" value={bTo} onChange={e => setBTo(e.target.value)} />
        </label>
      </div>
      <div className="compare-metrics" onClick={(e) => {
        if (e.target.dataset?.action) {
          handleSelectAll(e.target.dataset.action);
        } else if (e.target.tagName === 'INPUT') {
          // onChange fires after click, so read after microtask
          requestAnimationFrame(() => {
            const container = e.currentTarget;
            const checked = [...container.querySelectorAll("input:checked")].map(x => x.value);
            dispatch({ type: "SET_COMPARE_METRICS", values: new Set(checked) });
          });
        }
      }}>
        {Object.entries(compareMetrics).map(([key, m]) => (
          <label key={key}>
            <input type="checkbox" value={key} defaultChecked={state.compareMetrics.has(key)} />{m.label}
          </label>
        ))}
        <span className="compare-actions">
          <button type="button" className="mini-btn" data-action="all">全选</button>
          <button type="button" className="mini-btn" data-action="clear">清除</button>
        </span>
      </div>
      <div className="compare-grid">
        {!active.length ? <div className="empty" style={{gridColumn:"1/-1"}}>请选择要对比的指标</div> :
          compareResult && active.map(key => {
            const metric = compareMetrics[key], av = compareResult.a[key], bv = compareResult.b[key];
            const diff = Number.isFinite(av) && Number.isFinite(bv) ? av - bv : NaN;
            const diffPct = Number.isFinite(diff) && bv ? safeDiv(diff, Math.abs(bv)) : NaN;
            let deltaText = "-", deltaCls = "";
            if (Number.isFinite(diff)) {
              if (metric.type === "pct") {
                deltaText = `${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(2)} pct`;
              } else {
                deltaText = `${diff >= 0 ? "+" : ""}${formatMetric(diff, metric.type)}${Number.isFinite(diffPct) ? ` · ${diffPct >= 0 ? "+" : ""}${(diffPct * 100).toFixed(1)}%` : ""}`;
              }
              deltaCls = diff >= 0 ? "positive" : "negative";
            }
            const denom = Math.max(Math.abs(av || 0), Math.abs(bv || 0), 1);
            const aWidth = Math.max(0, Math.min(100, Math.abs(av || 0) / denom * 100));
            const bWidth = Math.max(0, Math.min(100, Math.abs(bv || 0) / denom * 100));

            return (
              <article className="compare-card" key={key}>
                <div className="compare-card-title"><span>{metric.label}</span><span>A-B</span></div>
                <div className="compare-body">
                  <div className="compare-values">
                    <div className="compare-value"><span>时间段A</span><strong>{formatMetric(av, metric.type)}</strong></div>
                    <div className="compare-value"><span>时间段B</span><strong>{formatMetric(bv, metric.type)}</strong></div>
                    <div className="compare-delta"><span>A-B差异</span><strong className={deltaCls}>{deltaText}</strong></div>
                  </div>
                  <div className="compare-bars">
                    <div className="compare-bar-row"><span>A</span><div className="compare-bar-track"><div className="compare-bar-fill a" style={{'--w':`${aWidth}%`}} /></div><span>{aWidth.toFixed(0)}%</span></div>
                    <div className="compare-bar-row"><span>B</span><div className="compare-bar-track"><div className="compare-bar-fill b" style={{'--w':`${bWidth}%`}} /></div><span>{bWidth.toFixed(0)}%</span></div>
                  </div>
                </div>
              </article>
            );
          })
        }
      </div>
    </section>
  );
}

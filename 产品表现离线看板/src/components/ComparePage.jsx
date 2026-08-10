import React, { useCallback, useEffect, useMemo } from 'react';
import { useDashboard, dims, compareMetrics } from '../store/DashboardContext';
import { filteredRows, total } from '../store/DashboardContext';
import { safeDiv, dateAdd, esc } from '../utils/helpers';
import { fmtNum, formatMetric } from '../utils/format';

export default function ComparePage() {
  const { state, dispatch } = useDashboard();
  const meta = state.meta || {};
  const rows = state.rows || [];

  // 初始化对比日期
  useEffect(() => {
    if (!meta.minDate || !meta.maxDate) return;
    const min = meta.minDate, max = meta.maxDate;
    const aFromEl = document.getElementById("compareAFrom");
    const aToEl = document.getElementById("compareATo");
    const bFromEl = document.getElementById("compareBFrom");
    const bToEl = document.getElementById("compareBTo");
    if (aFromEl && !aFromEl.value) aFromEl.value = dateAdd(max, -1) < min ? min : dateAdd(max, -1);
    if (aToEl && !aToEl.value) aToEl.value = max;
    if (bFromEl && !bFromEl.value) bFromEl.value = min;
    if (bToEl && !bToEl.value) bToEl.value = dateAdd(min, 1) > max ? max : dateAdd(min, 1);
  }, [meta.minDate, meta.maxDate]);

  const handleMetricChange = useCallback((e) => {
    if (e.target.tagName !== 'INPUT') return;
    const container = document.getElementById("compareMetricControls");
    if (!container) return;
    const checked = [...container.querySelectorAll("input:checked")].map(x => x.value);
    dispatch({ type: "SET_COMPARE_METRICS", values: new Set(checked) });
  }, [dispatch]);

  const handleSelectAll = useCallback((action) => {
    const container = document.getElementById("compareMetricControls");
    if (!container) return;
    container.querySelectorAll("input").forEach(x => x.checked = action === "all");
    dispatch({
      type: "SET_COMPARE_METRICS",
      values: new Set(action === "all" ? Object.keys(compareMetrics) : []),
    });
  }, [dispatch]);

  // Compute comparison
  const compareData = useMemo(() => {
    const aFromEl = document.getElementById("compareAFrom");
    const aToEl = document.getElementById("compareATo");
    const bFromEl = document.getElementById("compareBFrom");
    const bToEl = document.getElementById("compareBTo");
    if (!aFromEl || !meta.minDate) return null;

    const aFrom = aFromEl.value || meta.minDate;
    const aTo = aToEl?.value || aFrom;
    const bFrom = bFromEl?.value || meta.minDate;
    const bTo = bToEl?.value || bFrom;

    const a = total(filteredRows(rows, {
      ...state,
      dateFrom: aFrom > aTo ? aTo : aFrom,
      dateTo: aFrom > aTo ? aFrom : aTo,
    }));
    const b = total(filteredRows(rows, {
      ...state,
      dateFrom: bFrom > bTo ? bTo : bFrom,
      dateTo: bFrom > bTo ? bFrom : bTo,
    }));

    return { a, b, aFrom: aFrom > aTo ? aTo : aFrom, aTo: aFrom > aTo ? aFrom : aTo, bFrom: bFrom > bTo ? bTo : bFrom, bTo: bFrom > bTo ? bFrom : bTo };
  }, [rows, state.filters]);

  const active = [...state.compareMetrics].filter(k => compareMetrics[k]);

  if (!meta.minDate) {
    return (
      <section className="panel compare-panel">
        <div className="empty">暂无数据，请先上传数据源并构建看板</div>
      </section>
    );
  }

  const metricsHTML = Object.entries(compareMetrics).map(([key, m]) =>
    `<label><input type="checkbox" value="${key}" ${state.compareMetrics.has(key) ? "checked" : ""}>${m.label}</label>`
  ).join("");

  let cardsHTML = "";
  if (compareData) {
    const { a, b } = compareData;
    const statusText = `A：${compareData.aFrom} 至 ${compareData.aTo}（${fmtNum(a.rowCount)} 条 · ${fmtNum(a.asin.size)} ASIN）｜B：${compareData.bFrom} 至 ${compareData.bTo}（${fmtNum(b.rowCount)} 条 · ${fmtNum(b.asin.size)} ASIN）`;

    if (!active.length) {
      cardsHTML = '<div class="empty">请选择要对比的指标</div>';
    } else {
      cardsHTML = active.map(key => {
        const metric = compareMetrics[key], av = a[key], bv = b[key];
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

        return `<article class="compare-card">
          <div class="compare-card-title"><span>${metric.label}</span><span>A-B</span></div>
          <div class="compare-body">
            <div class="compare-values">
              <div class="compare-value"><span>时间段A</span><strong>${formatMetric(av, metric.type)}</strong></div>
              <div class="compare-value"><span>时间段B</span><strong>${formatMetric(bv, metric.type)}</strong></div>
              <div class="compare-delta"><span>A-B差异</span><strong class="${deltaCls}">${deltaText}</strong></div>
            </div>
            <div class="compare-bars">
              <div class="compare-bar-row"><span>A</span><div class="compare-bar-track"><div class="compare-bar-fill a" style="--w:${aWidth}%"></div></div><span>${aWidth.toFixed(0)}%</span></div>
              <div class="compare-bar-row"><span>B</span><div class="compare-bar-track"><div class="compare-bar-fill b" style="--w:${bWidth}%"></div></div><span>${bWidth.toFixed(0)}%</span></div>
            </div>
          </div>
        </article>`;
      }).join("");
    }

    // Update status text
    const statusEl = document.getElementById("compareStatus");
    if (statusEl) statusEl.textContent = statusText;
  }

  return (
    <section className="panel compare-panel" aria-label="自定义时间对比">
      <div className="compare-head">
        <div>
          <h2 className="panel-title">自定义时间对比</h2>
          <div className="panel-subtitle" id="compareStatus">选择两个任意时间段进行对比</div>
        </div>
      </div>
      <div className="compare-controls">
        <label className="field"><span className="field-label">时间段A开始</span><input id="compareAFrom" type="date" /></label>
        <label className="field"><span className="field-label">时间段A结束</span><input id="compareATo" type="date" /></label>
        <label className="field"><span className="field-label">时间段B开始</span><input id="compareBFrom" type="date" /></label>
        <label className="field"><span className="field-label">时间段B结束</span><input id="compareBTo" type="date" /></label>
      </div>
      <div className="compare-metrics" id="compareMetricControls" onClick={(e) => {
        if (e.target.dataset?.action) {
          handleSelectAll(e.target.dataset.action);
        } else if (e.target.tagName === 'INPUT') {
          handleMetricChange(e);
        }
      }}
        dangerouslySetInnerHTML={{
          __html: metricsHTML + `<span class="compare-actions"><button type="button" class="mini-btn" data-action="all">全选</button><button type="button" class="mini-btn" data-action="clear">清除</button></span>`
        }}
      />
      <div className="compare-grid" id="compareCards"
        dangerouslySetInnerHTML={{ __html: cardsHTML }}
      />
    </section>
  );
}

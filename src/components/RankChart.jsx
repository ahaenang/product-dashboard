import React, { memo, useMemo } from 'react';
import { useDashboard, dims, rankMetrics } from '../store/DashboardContext';
import { esc } from '../utils/helpers';
import { formatMetric } from '../utils/format';

const RankChart = memo(function RankChart({ groups }) {
  const { state, dispatch } = useDashboard();
  const dim = state.rankDimension;
  const metricKey = state.rankMetric;
  const metric = rankMetrics[metricKey] || rankMetrics.netSales;

  const data = useMemo(() => {
    return [...groups].sort((a, b) => (b[metricKey] || 0) - (a[metricKey] || 0));
  }, [groups, metricKey]);

  const max = useMemo(() => {
    return Math.max(...data.map(d => Math.max(0, d[metricKey] || 0)), 1);
  }, [data, metricKey]);

  return (
    <article className="panel chart-panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title" id="rankTitle">{dims[dim]}{metric.label}排名</h2>
          <div className="panel-subtitle">当前筛选范围完整排名</div>
        </div>
        <div className="rank-controls">
          <label className="field">
            <span className="field-label">排名维度</span>
            <select value={dim} onChange={e => dispatch({ type: "SET_RANK_DIMENSION", value: e.target.value })}>
              <option value="parent">父体</option>
              <option value="series">系列</option>
              <option value="stage">阶段</option>
              <option value="store">统计店铺</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">排名指标</span>
            <select value={metricKey} onChange={e => dispatch({ type: "SET_RANK_METRIC", value: e.target.value })}>
              {Object.entries(rankMetrics).map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="bar-list" aria-label="排名">
        {!data.length ? <div className="empty">当前筛选无数据</div> :
          data.map((d, i) => (
            <div className="bar-row" key={d.label} aria-label={`${esc(d.label)} ${formatMetric(d[metricKey], metric.type)}`}>
              <div className="bar-label"><span className="bar-index">{i + 1}.</span> {d.label}</div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(0, d[metricKey] || 0) / max * 100}%` }} /></div>
              <div className="bar-value">{formatMetric(d[metricKey], metric.type)}</div>
            </div>
          ))}
      </div>
    </article>
  );
});

export default RankChart;

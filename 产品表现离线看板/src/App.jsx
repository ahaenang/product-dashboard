import React from 'react';
import { useDashboard } from './store/DashboardContext';
import PageTabs from './components/PageTabs';
import FilterBar from './components/FilterBar';
import KpiCards from './components/KpiCards';
import TrendChart from './components/TrendChart';
import ConversionChart from './components/ConversionChart';
import OrderMixChart from './components/OrderMixChart';
import RankChart from './components/RankChart';
import DetailTable from './components/DetailTable';
import ComparePage from './components/ComparePage';
import DataManager from './components/DataManager';
import { useFilteredRows, useTimeData, useTotal, useGroupedData, usePreviousGroups } from './store/DashboardContext';
import { esc, safeDiv } from './utils/helpers';
import { fmtNum, fmtPct, fmtMoney } from './utils/format';

function MetaBar() {
  const { state } = useDashboard();
  const meta = state.meta || {};
  if (!meta.minDate) {
    return (
      <header className="hero">
        <div>
          <h1>产品表现离线看板</h1>
          <p>父体与系列表现 · 数据管理 · 汇总分子÷汇总分母</p>
        </div>
        <div className="meta">暂无数据 · 请切换到「📂 数据管理」页面上传数据源</div>
      </header>
    );
  }
  return (
    <header className="hero">
      <div>
        <h1>产品表现离线看板</h1>
        <p>父体与系列表现 · 数据管理 · 汇总分子÷汇总分母</p>
      </div>
      <div className="meta">
        数据日期 {meta.minDate} 至 {meta.maxDate}<br />
        {fmtNum(meta.mappedRows)} 条已映射明细 · {fmtNum(meta.mappedAsins)} 个售卖 ASIN · BD父体 {fmtNum(meta.bdMatchedParents || 0)} 个
      </div>
    </header>
  );
}

function Footnote() {
  const { state } = useDashboard();
  const meta = state.meta || {};
  if (!meta.minDate) return null;

  const counts = meta.auditCounts || {};
  const items = [
    ["产品表现未匹配售卖产品ASIN", counts.sourceOnlyAsins || 0],
    ["售卖产品本期未出现在产品表现", counts.mappingOnlyAsins || 0],
    ["售卖产品重复ASIN", counts.duplicateMappingAsins || 0],
    ["BD父体未匹配售卖产品", counts.bdParentsWithoutProduct || 0],
    ["售卖产品父体无BD排期", counts.productParentsWithoutBd || 0],
  ];

  return (
    <p className="foot main-page-block">
      口径：TACOS＝广告花费÷净销售额；订单毛利率＝订单毛利润÷净销售额；其他比率均以当前筛选范围的汇总分子÷汇总分母计算。
      BD时间按 BD活动表 的父体 + 开始/结束日期同步到产品表现 ASIN。
      仅纳入售卖产品表已映射 ASIN。源文件：{esc(meta.sourceFile || "")}；
      售卖产品：{esc(meta.productFile || "")}；BD活动：{esc(meta.bdFile || "")}。
      <ul className="audit-list">
        {items.map(([label, value]) => (
          <li key={label}>{label}：{fmtNum(value)}</li>
        ))}
      </ul>
    </p>
  );
}

function Dashboard() {
  const filtered = useFilteredRows();
  const timeData = useTimeData(filtered);
  const totals = useTotal(filtered);
  const groups = useGroupedData(filtered);
  const prevInfo = usePreviousGroups(filtered);
  const { state } = useDashboard();

  if (!state.meta?.minDate) {
    return (
      <section className="kpi-grid main-page-block">
        <div className="empty" style={{ gridColumn: '1 / -1' }}>暂无数据，请先上传数据源并构建看板</div>
      </section>
    );
  }

  return (
    <>
      <FilterBar />
      <KpiCards totals={totals} />
      <section className="chart-grid main-page-block">
        <article className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">销售、利润与广告投入趋势</h2>
              <div className="panel-subtitle">{state.dateFrom} 至 {state.dateTo}</div>
            </div>
            <TrendMetricControls />
          </div>
          <TrendChart data={timeData} />
        </article>
        <article className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">转化率趋势</h2>
              <div className="panel-subtitle">订单、销量、广告与自然转化率</div>
            </div>
            <div className="legend">
              <span><i className="swatch" style={{ background: 'var(--primary)' }} />订单</span>
              <span><i className="swatch" style={{ background: 'var(--teal)' }} />销量</span>
              <span><i className="swatch" style={{ background: 'var(--amber)' }} />广告</span>
              <span><i className="swatch" style={{ background: 'var(--purple)' }} />自然</span>
            </div>
          </div>
          <ConversionChart data={timeData} />
        </article>
      </section>
      <section className="chart-grid equal main-page-block">
        <article className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">订单来源结构</h2>
              <div className="panel-subtitle">广告订单与自然订单占比</div>
            </div>
            <div className="legend">
              <span><i className="swatch" style={{ background: 'var(--purple)' }} />广告订单</span>
              <span><i className="swatch" style={{ background: 'var(--teal)' }} />自然订单</span>
            </div>
          </div>
          <OrderMixChart data={timeData} />
        </article>
        <RankChart groups={groups} />
      </section>
      <DetailTable groups={groups} prevInfo={prevInfo} />
      <Footnote />
    </>
  );
}

function TrendMetricControls() {
  const { state, dispatch } = useDashboard();
  const metrics = {
    netSales: { label: "净销售额", color: "var(--primary)" },
    sales: { label: "销售额", color: "var(--teal)" },
    profit: { label: "毛利润", color: "var(--green)" },
    spend: { label: "广告花费", color: "var(--amber)" },
    adSales: { label: "广告销售额", color: "var(--purple)" },
  };
  return (
    <div className="metric-controls" id="trendMetricControls" aria-label="趋势对比指标"
      onClick={(e) => {
        if (e.target.tagName !== 'INPUT') return;
        const checkboxes = e.currentTarget.querySelectorAll('input[type=checkbox]');
        const checked = [...checkboxes].filter(c => c.checked).map(c => c.value);
        const values = new Set(checked.length ? checked : ["netSales"]);
        if (!checked.length) {
          const first = e.currentTarget.querySelector('input[value="netSales"]');
          if (first) first.checked = true;
        }
        dispatch({ type: "SET_TREND_METRICS", values });
      }}
      dangerouslySetInnerHTML={{
        __html: Object.entries(metrics).map(([key, m]) =>
          `<label><input type="checkbox" value="${key}" ${state.trendMetrics.has(key) ? 'checked' : ''}><i class="swatch" style="background:${m.color}"></i>${m.label}</label>`
        ).join("") + `<span><i class="swatch" style="background:var(--red)"></i>BD时间</span>`
      }}
    />
  );
}

export default function App() {
  const { state } = useDashboard();

  return (
    <main className="app" data-view={state.view}>
      <MetaBar />
      <PageTabs />
      <Dashboard />
      <div className="compare-page-block"><ComparePage /></div>
      <div className="data-page-block"><DataManager /></div>
    </main>
  );
}

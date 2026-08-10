import React, { memo } from 'react';
import { fmtMoney, fmtNum, fmtPct } from '../utils/format';

const KpiCards = memo(function KpiCards({ totals }) {
  const cards = [
    ["净销售额", fmtMoney(totals.netSales), `销售额 ${fmtMoney(totals.sales)}`],
    ["订单毛利润", fmtMoney(totals.profit), `毛利率 ${fmtPct(totals.margin)}`],
    ["广告花费", fmtMoney(totals.spend), `广告销售额 ${fmtMoney(totals.adSales)}`],
    ["TACOS", fmtPct(totals.acoas), `ACOS ${fmtPct(totals.acos)}`],
    ["订单量", fmtNum(totals.orders), `广告 ${fmtNum(totals.adOrders)} · 自然 ${fmtNum(totals.naturalOrders)}`],
    ["销量", fmtNum(totals.units), `B2B ${fmtNum(totals.b2bUnits)}`],
    ["订单转化率", fmtPct(totals.orderCvr), `会话 ${fmtNum(totals.sessions)}`],
    ["退货率", fmtPct(totals.returnRate), `BD ASIN ${fmtNum(totals.bdAsinCount)}`],
  ];

  return (
    <section className="kpi-grid main-page-block" aria-label="关键指标">
      {cards.map(([label, value, note], i) => (
        <article className="kpi" key={i}>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value">{value}</div>
          <div className="kpi-note">{note}</div>
        </article>
      ))}
    </section>
  );
});

export default KpiCards;

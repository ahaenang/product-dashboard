import React, { memo, useMemo, useRef, useEffect } from 'react';
import { useDashboard } from '../store/DashboardContext';
import { esc } from '../utils/helpers';
import { fmtCompact, fmtNum, fmtPct } from '../utils/format';

const OrderMixChart = memo(function OrderMixChart({ data }) {
  const { state } = useDashboard();
  const containerRef = useRef(null);

  const svg = useMemo(() => {
    if (!data.length) return '<div class="empty">当前筛选无数据</div>';

    const W = 520, H = 310, m = { l: 48, r: 12, t: 12, b: 72 }, w = W - m.l - m.r, h = H - m.t - m.b;
    const max = niceMax(Math.max(...data.map(d => d.adOrders + d.naturalOrders), 1));
    const y = v => m.t + h - (v / max * h), group = w / data.length, bw = Math.min(40, group * .55);

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img"><title>广告与自然订单结构</title>`;
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4, yy = y(v);
      svg += `<line class="gridline" x1="${m.l}" y1="${yy}" x2="${W - m.r}" y2="${yy}"/><text x="${m.l - 7}" y="${yy + 4}" text-anchor="end">${fmtCompact(v)}</text>`;
    }
    data.forEach((d, i) => {
      const x = m.l + group * (i + .5) - bw / 2;
      const naturalH = d.naturalOrders / max * h, adH = d.adOrders / max * h, base = m.t + h;
      const label = state.granularity === "day" ? d.label.slice(5) : d.label;
      svg += `<rect x="${x}" y="${base - naturalH}" width="${bw}" height="${naturalH}" fill="var(--teal)" rx="3"/>`;
      svg += `<rect x="${x}" y="${base - naturalH - adH}" width="${bw}" height="${adH}" fill="var(--purple)" rx="3"/>`;
      svg += `<text x="${x + bw / 2}" y="${H - 56}" text-anchor="end" transform="rotate(-90 ${x + bw / 2} ${H - 56})">${esc(label)}</text>`;
      svg += `<rect class="hit" data-i="${i}" x="${m.l + group * i}" y="${m.t}" width="${group}" height="${h}"/>`;
    });
    svg += "</svg>";
    return svg;
  }, [data, state.granularity]);

  useEffect(() => {
    return bindChartTooltip(containerRef.current, data, d =>
      `<strong>${esc(d.label)}</strong>广告订单：${fmtNum(d.adOrders)}（${fmtPct(d.adShare)}）<br>自然订单：${fmtNum(d.naturalOrders)}（${fmtPct(d.naturalShare)}）`
    ) || (() => {});
  }, [svg, data]);

  return (
    <div className="chart" ref={containerRef} aria-label="订单来源结构图"
      dangerouslySetInnerHTML={{ __html: svg + '<div class="tooltip"></div>' }}
    />
  );
});

function niceMax(v) { if (!v) return 1; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; }

function bindChartTooltip(el, data, htmlFn) {
  if (!el) return;
  const tip = el.querySelector(".tooltip");
  if (!tip) return;
  const handlers = [];
  el.querySelectorAll(".hit").forEach(hit => {
    const onEnter = () => { tip.innerHTML = htmlFn(data[+hit.dataset.i]); tip.style.display = "block"; };
    const onMove = (e) => {
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.max(4, Math.min(r.width - tw - 4, e.clientX - r.left + 10)) + "px";
      tip.style.top = Math.max(4, Math.min(r.height - th - 4, e.clientY - r.top - th - 10)) + "px";
    };
    const onLeave = () => { tip.style.display = "none"; };
    hit.addEventListener("mouseenter", onEnter);
    hit.addEventListener("mousemove", onMove);
    hit.addEventListener("mouseleave", onLeave);
    handlers.push({ hit, onEnter, onMove, onLeave });
  });
  return () => {
    handlers.forEach(({ hit, onEnter, onMove, onLeave }) => {
      hit.removeEventListener("mouseenter", onEnter);
      hit.removeEventListener("mousemove", onMove);
      hit.removeEventListener("mouseleave", onLeave);
    });
  };
}

export default OrderMixChart;

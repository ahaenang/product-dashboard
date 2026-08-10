import React, { memo, useMemo, useRef, useEffect, useState } from 'react';
import { useDashboard, trendMetrics } from '../store/DashboardContext';
import { esc } from '../utils/helpers';
import { fmtCompact, fmtNum, formatMetric } from '../utils/format';

const TrendChart = memo(function TrendChart({ data }) {
  const { state } = useDashboard();
  const active = [...state.trendMetrics].filter(k => trendMetrics[k]);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ show: false, html: "", x: 0, y: 0 });

  const svg = useMemo(() => {
    if (!data.length) return '<div class="empty">当前筛选无数据</div>';

    const W = 760, H = 310;
    const m = { l: 58, r: 18, t: 16, b: 72 };
    const w = W - m.l - m.r, h = H - m.t - m.b;
    const vals = data.flatMap(d => active.map(k => d[k] || 0));
    const max = niceMax(Math.max(0, ...vals)), min = Math.min(0, ...vals);
    const span = max - min || 1;
    const y = v => m.t + (max - v) / span * h;
    const y0 = y(0);
    const x = i => data.length === 1 ? m.l + w / 2 : m.l + i * w / (data.length - 1);

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img"><title>销售、利润与广告投入趋势</title><defs>`;

    // Gradient definitions for area fills
    active.forEach(k => {
      const c = trendMetrics[k].color;
      svg += `<linearGradient id="grad-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c}" stop-opacity=".18"/><stop offset="100%" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
    });
    svg += "</defs>";

    for (let i = 0; i <= 4; i++) {
      const v = min + span * i / 4, yy = y(v);
      svg += `<line class="gridline" x1="${m.l}" y1="${yy}" x2="${W - m.r}" y2="${yy}"/><text x="${m.l - 8}" y="${yy + 4}" text-anchor="end">${esc(fmtCompact(v))}</text>`;
    }
    svg += `<line class="zero" x1="${m.l}" y1="${y0}" x2="${W - m.r}" y2="${y0}"/>`;

    const bdY = m.t + 10;
    data.forEach((d, i) => {
      if (d.bdAsinCount > 0) {
        const left = data.length === 1 ? m.l : (i ? ((x(i - 1) + x(i)) / 2) : m.l);
        const right = data.length === 1 ? W - m.r : (i === data.length - 1 ? W - m.r : (x(i) + x(i + 1)) / 2);
        svg += `<rect x="${left}" y="${m.t}" width="${right - left}" height="${h}" fill="var(--red)" opacity=".06" rx="4"/>`;
      }
    });

    active.forEach(k => {
      const metric = trendMetrics[k];
      const pts = data.map((d, i) => `${x(i)},${y(d[k] || 0)}`).join(" ");

      // Gradient area fill under line
      if (data.length > 1) {
        const areaPts = pts + ` ${x(data.length - 1)},${y0} ${x(0)},${y0}`;
        svg += `<polygon fill="url(#grad-${k})" points="${areaPts}"/>`;
      }

      svg += `<polyline fill="none" stroke="${metric.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/>`;
      data.forEach((d, i) => svg += `<circle cx="${x(i)}" cy="${y(d[k] || 0)}" r="4" fill="${metric.color}" stroke="#fff" stroke-width="1.5"/>`);
    });

    data.forEach((d, i) => {
      const label = state.granularity === "day" ? d.label.slice(5) : d.label;
      const hitX = data.length === 1 ? m.l : (i ? ((x(i - 1) + x(i)) / 2) : m.l);
      const hitW = data.length === 1 ? w : (i === data.length - 1 ? W - m.r - hitX : (x(i) + x(i + 1)) / 2 - hitX);
      svg += `<text x="${x(i)}" y="${H - 56}" text-anchor="end" transform="rotate(-90 ${x(i)} ${H - 56})">${esc(label)}</text><rect class="hit" data-i="${i}" x="${hitX}" y="${m.t}" width="${hitW}" height="${h}"/>`;
    });

    svg += "</svg>";
    return svg;
  }, [data, active, state.granularity]);

  // Tooltip bindings
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const tip = el.querySelector(".tooltip");
    if (!tip) return;

    const handlers = [];
    el.querySelectorAll(".hit").forEach(hit => {
      const onEnter = () => {
        const i = +hit.dataset.i;
        const d = data[i];
        const html = `<strong>${esc(d.label)}</strong>${active.map(k => `<br>${trendMetrics[k].label}：${formatMetric(d[k], trendMetrics[k].type)}`).join("")}<br>BD ASIN：${fmtNum(d.bdAsinCount)}`;
        tip.innerHTML = html;
        tip.style.display = "block";
      };
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const tw = tip.offsetWidth, th = tip.offsetHeight;
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
  }, [svg, data, active]);

  return (
    <div className="chart" ref={containerRef} aria-label="销售利润广告投入趋势图"
      dangerouslySetInnerHTML={{ __html: svg + '<div class="tooltip"></div>' }}
    />
  );
});

function niceMax(v) {
  if (!v) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

export default TrendChart;

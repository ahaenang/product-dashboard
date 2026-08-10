import React, { memo, useMemo, useRef, useEffect } from 'react';
import { esc } from '../utils/helpers';
import { fmtCompact, fmtPct, fmtNum, formatMetric } from '../utils/format';

const ConversionChart = memo(function ConversionChart({ data }) {
  const containerRef = useRef(null);
  const keys = ["orderCvr", "unitCvr", "adCvr", "naturalCvr"];
  const colors = ["var(--primary)", "var(--teal)", "var(--amber)", "var(--purple)"];

  const svg = useMemo(() => {
    if (!data.length) return '<div class="empty">当前筛选无数据</div>';

    const W = 650, H = 310, m = { l: 52, r: 14, t: 12, b: 72 }, w = W - m.l - m.r, h = H - m.t - m.b;
    const all = data.flatMap(d => keys.map(k => Number.isFinite(d[k]) ? d[k] : 0));
    const max = Math.max(.05, Math.min(2, niceMax(Math.max(...all))));
    const x = i => data.length === 1 ? m.l + w / 2 : m.l + i * w / (data.length - 1);
    const y = v => m.t + h - (Math.max(0, v) / max * h);

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img"><title>转化率趋势</title><defs>`;
    keys.forEach((k, j) => {
      svg += `<linearGradient id="cvg-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${colors[j]}" stop-opacity=".15"/><stop offset="100%" stop-color="${colors[j]}" stop-opacity="0"/></linearGradient>`;
    });
    svg += "</defs>";
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4, yy = y(v);
      svg += `<line class="gridline" x1="${m.l}" y1="${yy}" x2="${W - m.r}" y2="${yy}"/><text x="${m.l - 7}" y="${yy + 4}" text-anchor="end">${fmtPct(v)}</text>`;
    }

    const bdY = m.t + 10;
    data.forEach((d, i) => {
      if (d.bdAsinCount > 0) {
        const left = data.length === 1 ? m.l : (i ? ((x(i - 1) + x(i)) / 2) : m.l);
        const right = data.length === 1 ? W - m.r : (i === data.length - 1 ? W - m.r : (x(i) + x(i + 1)) / 2);
        svg += `<rect x="${left}" y="${m.t}" width="${right - left}" height="${h}" fill="var(--red)" opacity=".06" rx="4"/>`;
      }
    });

    const y0 = y(0);
    keys.forEach((k, j) => {
      const pts = data.map((d, i) => `${x(i)},${y(Number.isFinite(d[k]) ? d[k] : 0)}`).join(" ");
      if (data.length > 1) {
        const areaPts = pts + ` ${x(data.length - 1)},${y0} ${x(0)},${y0}`;
        svg += `<polygon fill="url(#cvg-${k})" points="${areaPts}"/>`;
      }
      svg += `<polyline fill="none" stroke="${colors[j]}" stroke-width="2" stroke-linejoin="round" points="${pts}"/>`;
      data.forEach((d, i) => svg += `<circle cx="${x(i)}" cy="${y(Number.isFinite(d[k]) ? d[k] : 0)}" r="4" fill="${colors[j]}" stroke="#fff" stroke-width="1.5"/>`);
    });

    data.forEach((d, i) => {
      const label = d.label.slice(5);
      svg += `<text x="${x(i)}" y="${H - 56}" text-anchor="end" transform="rotate(-90 ${x(i)} ${H - 56})">${esc(label)}</text><rect class="hit" data-i="${i}" x="${i ? ((x(i - 1) + x(i)) / 2) : m.l}" y="${m.t}" width="${data.length === 1 ? w : (i === data.length - 1 ? W - m.r - (x(i - 1) + x(i)) / 2 : (x(i + 1) - x(i - 1)) / 2)}" height="${h}"/>`;
    });

    svg += "</svg>";
    return svg;
  }, [data]);

  useEffect(() => {
    return bindChartTooltip(containerRef.current, data, d =>
      `<strong>${esc(d.label)}</strong>订单转化率：${fmtPct(d.orderCvr)}<br>销量转化率：${fmtPct(d.unitCvr)}<br>广告转化率：${fmtPct(d.adCvr)}<br>自然转化率：${fmtPct(d.naturalCvr)}<br>BD ASIN：${fmtNum(d.bdAsinCount)}`
    ) || (() => {});
  }, [svg, data]);

  return (
    <div className="chart" ref={containerRef} aria-label="转化率趋势图"
      dangerouslySetInnerHTML={{ __html: svg + '<div class="tooltip"></div>' }}
    />
  );
});

function niceMax(v) { if (!v) return 1; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; }

function bindChartTooltip(el, data, htmlFn) {
  if (!el) return;
  const tip = el.querySelector(".tooltip");
  if (!tip) return;
  const cleanups = [];
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
    cleanups.push(() => { hit.removeEventListener("mouseenter", onEnter); hit.removeEventListener("mousemove", onMove); hit.removeEventListener("mouseleave", onLeave); });
  });
  return () => cleanups.forEach(fn => fn());
}

export default ConversionChart;

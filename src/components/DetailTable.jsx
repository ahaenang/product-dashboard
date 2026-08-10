import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDashboard, dims, columns } from '../store/DashboardContext';
import { esc } from '../utils/helpers';
import { fmtNum, fmtPct, fmtMoney2, formatPreviousValue } from '../utils/format';
import { noteStorageKey } from '../utils/helpers';

const DetailTable = memo(function DetailTable({ groups, prevInfo }) {
  const { state, dispatch } = useDashboard();
  const dim = state.rankDimension;
  const sort = state.tableSort;
  const meta = state.meta || {};

  const sortedData = useMemo(() => {
    return [...groups].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return typeof av === "string"
        ? av.localeCompare(bv, "zh-CN") * sort.dir
        : ((av || 0) - (bv || 0)) * sort.dir;
    });
  }, [groups, sort]);

  const handleSort = useCallback((key) => {
    if (key === "note") return;
    dispatch({
      type: "SET_TABLE_SORT",
      payload: sort.key === key
        ? { key, dir: sort.dir * -1 }
        : { key, dir: key === "label" ? 1 : -1 },
    });
  }, [dispatch, sort]);

  const bdScheduleText = useCallback((label) => {
    if (dim !== "parent") return "-";
    const items = meta.bdScheduleByParent?.[label] || [];
    return items.length ? items.join("\n") : "-";
  }, [dim, meta.bdScheduleByParent]);

  // Attach note handlers via event delegation (no leaks)
  useEffect(() => {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody) return;
    const handler = (e) => {
      const input = e.target.closest(".note-input");
      if (!input) return;
      try { localStorage.setItem(noteStorageKey(input.dataset.parent), input.value); } catch {}
    };
    tableBody.addEventListener("input", handler);
    return () => tableBody.removeEventListener("input", handler);
  }, [sortedData]);

  const headHTML = columns.map(c =>
    `<th data-key="${c[0]}">${c[1]}${c[2] !== "note" && sort.key === c[0] ? (sort.dir > 0 ? " ↑" : " ↓") : ""}</th>`
  ).join("");

  const bodyHTML = sortedData.map(d => {
    const cells = columns.map(c => {
      const [key, , type] = c;
      if (type === "note") {
        if (dim !== "parent") return `<td class="note-cell"><span class="text-muted">切换到父体维度填写</span></td>`;
        const note = safeGetNote(d.label);
        return `<td class="note-cell"><textarea class="note-input" data-parent="${esc(d.label)}" placeholder="填写该父体的数据说明">${esc(note)}</textarea></td>`;
      }
      if (type === "text") {
        return `<td><span class="label-with-bd" title="${esc(bdScheduleText(d.label))}">${esc(d[key])}</span></td>`;
      }

      const main = type === "money" ? fmtMoney2(d[key] || 0) : type === "pct" ? fmtPct(d[key]) : fmtNum(d[key] || 0);
      const prev = prevInfo?.complete ? prevInfo.map.get(d.label) : null;
      const previousText = prev ? formatPreviousValue(prev[key], type) : "-";
      const profitClass = (key === "profit" || key === "margin") ? (d[key] < 0 ? "negative" : "positive") : "";

      return `<td class="${profitClass}"><span class="cell-main">${main}</span><span class="cell-compare">${previousText}</span></td>`;
    });
    return `<tr>${cells.join("")}</tr>`;
  }).join("") || `<tr><td colspan="${columns.length}">当前筛选无数据</td></tr>`;

  const html = `<table><thead><tr>${headHTML}</tr></thead><tbody id="tableBody">${bodyHTML}</tbody></table>`;

  return (
    <section className="panel table-panel main-page-block">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">{dims[dim]}表现明细</h2>
          <div className="panel-subtitle">点击表头排序；父体列悬停显示BD排期；数据说明自动保存；横向滚动时前两列固定</div>
        </div>
      </div>
      <div className="table-wrap"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(e) => {
          const th = e.target.closest("th");
          if (th?.dataset.key) handleSort(th.dataset.key);
        }}
      />
    </section>
  );
});

function safeGetNote(parent) {
  try { return localStorage.getItem(noteStorageKey(parent)) || ""; }
  catch { return ""; }
}

export default DetailTable;

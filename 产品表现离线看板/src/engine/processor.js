/* ============================================================
   数据处理引擎（复刻 Python build_dashboard.py 逻辑）
   在 Web Worker 中运行，不依赖 DOM/IndexedDB
   ============================================================ */

import * as XLSX from 'xlsx';
import { cleanText, cleanDate, norm, parseNumber } from '../utils/helpers.js';

/** 找表头行：匹配 required_aliases 的任意一组 */
function findHeaderRow(rows, requiredAliases, scanRows) {
  scanRows = scanRows || 10;
  const required = requiredAliases.map(aliases => aliases.map(norm));
  for (let i = 0; i < Math.min(scanRows, rows.length); i++) {
    const headers = rows[i].map(norm);
    let ok = true;
    for (const aliases of required) {
      if (!aliases.some(a => headers.includes(a))) { ok = false; break; }
    }
    if (ok) return { rowNum: i, headers: rows[i].map(cleanText) };
  }
  throw new Error("未识别到表头");
}

/** 按别名找列索引 */
function colByAlias(headers, aliases, required) {
  if (required === undefined) required = true;
  const aliasNorms = aliases.map(norm);
  const normalized = headers.map(norm);
  for (const alias of aliasNorms) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return idx;
  }
  for (const alias of aliasNorms) {
    for (let i = 0; i < normalized.length; i++) {
      if (alias && normalized[i].includes(alias)) return i;
    }
  }
  if (required) throw new Error(`缺少字段: ${aliases.join("/")}`);
  return null;
}

/** 取第一个非空 sheet */
function firstNonEmptySheet(wb) {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    if (range.e.r > 0 && range.e.c > 0) return { name, sheet: ws };
  }
  if (wb.SheetNames.length === 0) throw new Error("Excel 文件没有 sheet");
  return { name: wb.SheetNames[0], sheet: wb.Sheets[wb.SheetNames[0]] };
}

/** 加载售卖产品映射 */
function loadProductMapping(wb) {
  const { sheet } = firstNonEmptySheet(wb);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  const { rowNum: hdrRowNum, headers } = findHeaderRow(rows, [["ASIN"], ["名称"]]);

  const cols = {
    asin: colByAlias(headers, ["ASIN"]),
    parent: colByAlias(headers, ["名称", "父体名称", "父体"]),
    brand: colByAlias(headers, ["品牌"], false),
    series: colByAlias(headers, ["负责人", "系列"], false),
    stage: colByAlias(headers, ["阶段定位", "阶段"], false),
    ownerStore: colByAlias(headers, ["店铺", "归属店铺"], false),
  };

  const mapping = {};
  const duplicateAsins = new Set();
  for (let i = hdrRowNum + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(v => v === "" || v == null)) continue;
    const asin = cleanText(row[cols.asin]);
    if (!asin) continue;
    if (mapping[asin]) duplicateAsins.add(asin);
    mapping[asin] = {
      parent: cleanText(row[cols.parent] || ""),
      brand: cleanText(cols.brand != null ? row[cols.brand] || "" : ""),
      series: cleanText(cols.series != null ? row[cols.series] || "" : ""),
      stage: cleanText(cols.stage != null ? row[cols.stage] || "" : ""),
      ownerStore: cleanText(cols.ownerStore != null ? row[cols.ownerStore] || "" : ""),
    };
  }
  return { mapping, duplicateAsins: [...duplicateAsins].sort() };
}

/** 加载 BD 排期 */
function loadBdIntervalsByParent(wb) {
  if (!wb) return { intervals: [], byParent: {} };

  const { sheet } = firstNonEmptySheet(wb);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  const topRows = rows.slice(0, Math.min(5, rows.length));
  const intervals = [];

  for (let hr = 0; hr < Math.min(5, topRows.length); hr++) {
    const row = topRows[hr];
    if (!row) continue;
    for (let col = 0; col < row.length; col++) {
      if (!cleanText(row[col]).includes("开始")) continue;

      let endCol = null;
      for (let c = col + 1; c < Math.min(col + 4, (topRows[hr] || []).length); c++) {
        if (cleanText(topRows[hr][c]).includes("结束")) { endCol = c; break; }
      }
      if (endCol == null) continue;

      let parent = "";
      for (let pr = hr - 1; pr >= 0; pr--) {
        for (let pc = col; pc >= 0; pc--) {
          parent = cleanText((topRows[pr] || [])[pc] || "");
          if (parent) break;
        }
        if (parent) break;
      }
      if (!parent) continue;

      for (let rn = hr + 2; rn < rows.length; rn++) {
        const r = rows[rn];
        if (!r) continue;
        const start = cleanDate(r[col]);
        const end = cleanDate(r[endCol]);
        if (!start || !end) continue;
        intervals.push({
          parent,
          start: start <= end ? start : end,
          end: start <= end ? end : start,
        });
      }
    }
  }

  const seen = new Set();
  const unique = [];
  const byParent = {};
  for (const iv of intervals) {
    const key = `${iv.parent}|${iv.start}|${iv.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(iv);
    if (!byParent[iv.parent]) byParent[iv.parent] = [];
    byParent[iv.parent].push(iv);
  }
  return { intervals: unique, byParent };
}

function isBdDay(parent, day, bdByParent) {
  return (bdByParent[parent] || []).some(iv => iv.start <= day && day <= iv.end);
}

/** 加载产品表现源数据并映射 */
function loadSourceRows(wb, mapping, bdByParent) {
  const { sheet } = firstNonEmptySheet(wb);
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  const { rowNum: hdrRowNum, headers } = findHeaderRow(rawRows, [["日期"], ["ASIN"], ["店铺"], ["国家"]]);

  const cols = {
    date: colByAlias(headers, ["日期"]),
    asin: colByAlias(headers, ["ASIN"]),
    store: colByAlias(headers, ["店铺"]),
    country: colByAlias(headers, ["国家"]),
    units: colByAlias(headers, ["销量"]),
    sales: colByAlias(headers, ["销售额"]),
    orders: colByAlias(headers, ["订单量"]),
    netSales: colByAlias(headers, ["净销售额"]),
    b2bUnits: colByAlias(headers, ["B2B 销量", "B2B销量"]),
    b2bOrders: colByAlias(headers, ["B2B 订单量", "B2B订单量"]),
    profit: colByAlias(headers, ["订单毛利润"]),
    returns: colByAlias(headers, ["退货量"]),
    sessionsBrowser: colByAlias(headers, ["Sessions-Browser"]),
    sessionsMobile: colByAlias(headers, ["Sessions-Mobile"]),
    sessions: colByAlias(headers, ["Sessions-Total"]),
    impressions: colByAlias(headers, ["展示"]),
    clicks: colByAlias(headers, ["点击"]),
    spend: colByAlias(headers, ["广告花费"]),
    adSales: colByAlias(headers, ["广告销售额"]),
    adOrders: colByAlias(headers, ["广告订单量"]),
    naturalClicks: colByAlias(headers, ["自然点击量"]),
    naturalOrders: colByAlias(headers, ["自然订单量"]),
  };

  const compactRows = [];
  let sourceCount = 0;
  const sourceAsins = new Set();
  const matchedBdParents = new Set();
  const matchedBdIntervals = new Set();

  for (let i = hdrRowNum + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every(v => v === "" || v == null)) continue;
    sourceCount++;
    const asin = cleanText(row[cols.asin]);
    const day = cleanDate(row[cols.date]);
    if (asin) sourceAsins.add(asin);

    const m = mapping[asin];
    if (!m) continue;

    const parent = m.parent || "未分类";
    const bdFlag = (day && isBdDay(parent, day, bdByParent)) ? 1 : 0;
    if (bdFlag) {
      matchedBdParents.add(parent);
      for (const iv of bdByParent[parent] || []) {
        if (iv.start <= day && day <= iv.end) {
          matchedBdIntervals.add(`${parent}|${iv.start}|${iv.end}`);
        }
      }
    }

    function v(key) { return row[cols[key]]; }

    compactRows.push({
      date: day,
      asin,
      store: cleanText(v("store")),
      country: cleanText(v("country")),
      stage: m.stage || "未分类",
      series: m.series || "未分类",
      parent,
      ownerStore: m.ownerStore || "未分类",
      bd: bdFlag,
      units: Math.round(parseNumber(v("units")) * 10000) / 10000,
      sales: Math.round(parseNumber(v("sales")) * 10000) / 10000,
      orders: Math.round(parseNumber(v("orders")) * 10000) / 10000,
      netSales: Math.round(parseNumber(v("netSales")) * 10000) / 10000,
      b2bUnits: Math.round(parseNumber(v("b2bUnits")) * 10000) / 10000,
      b2bOrders: Math.round(parseNumber(v("b2bOrders")) * 10000) / 10000,
      profit: Math.round(parseNumber(v("profit")) * 10000) / 10000,
      returns: Math.round(parseNumber(v("returns")) * 10000) / 10000,
      sessionsBrowser: Math.round(parseNumber(v("sessionsBrowser")) * 10000) / 10000,
      sessionsMobile: Math.round(parseNumber(v("sessionsMobile")) * 10000) / 10000,
      sessions: Math.round(parseNumber(v("sessions")) * 10000) / 10000,
      impressions: Math.round(parseNumber(v("impressions")) * 10000) / 10000,
      clicks: Math.round(parseNumber(v("clicks")) * 10000) / 10000,
      spend: Math.round(parseNumber(v("spend")) * 10000) / 10000,
      adSales: Math.round(parseNumber(v("adSales")) * 10000) / 10000,
      adOrders: Math.round(parseNumber(v("adOrders")) * 10000) / 10000,
      naturalClicks: Math.round(parseNumber(v("naturalClicks")) * 10000) / 10000,
      naturalOrders: Math.round(parseNumber(v("naturalOrders")) * 10000) / 10000,
    });
  }

  return { compactRows, sourceCount, sourceAsins, matchedBdParents, matchedBdIntervals };
}

/** 主构建函数 */
export function buildDashboard(sourceWb, productsWb, bdWb, fileNames) {
  const { mapping, duplicateAsins } = loadProductMapping(productsWb);
  const { intervals: bdIntervals, byParent: bdByParent } = loadBdIntervalsByParent(bdWb);
  const result = loadSourceRows(sourceWb, mapping, bdByParent);
  const compactRows = result.compactRows;

  if (!compactRows.length) throw new Error("没有映射到任何售卖产品 ASIN，请检查售卖产品映射表");

  const sourceAsins = result.sourceAsins;
  const mappingAsins = new Set(Object.keys(mapping));
  const sourceParents = new Set();
  for (const asin of sourceAsins) {
    if (mappingAsins.has(asin) && mapping[asin]?.parent) sourceParents.add(mapping[asin].parent);
  }
  const bdParents = new Set(Object.keys(bdByParent));
  const dates = [...new Set(compactRows.map(r => r.date))].sort();
  const overlappedIntervals = bdIntervals.filter(iv =>
    sourceParents.has(iv.parent) && dates.length && iv.end >= dates[0] && iv.start <= dates[dates.length - 1]
  );

  const options = {};
  for (const key of ["store", "country", "stage", "series", "parent"]) {
    options[key] = [...new Set(compactRows.map(r => r[key]))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  const bdScheduleByParent = {};
  for (const [parent, items] of Object.entries(bdByParent)) {
    bdScheduleByParent[parent] = items
      .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
      .map(iv => `${iv.start} 至 ${iv.end}`);
  }

  const audit = {
    sourceOnlyAsins: [...sourceAsins].filter(a => !mappingAsins.has(a)).sort(),
    mappingOnlyAsins: [...mappingAsins].filter(a => !sourceAsins.has(a)).sort(),
    duplicateMappingAsins: duplicateAsins,
    bdParentsWithoutProduct: [...bdParents].filter(p => ![...sourceParents].includes(p)),
    productParentsWithoutBd: [...sourceParents].filter(p => !bdParents.has(p)),
  };
  const auditCounts = {};
  for (const [k, v] of Object.entries(audit)) auditCounts[k] = v.length;

  const matchedBdIntervalsArr = [...result.matchedBdIntervals].map(s => {
    const [p, st, en] = s.split("|");
    return { parent: p, start: st, end: en };
  });

  const meta = {
    sourceFile: fileNames?.source || "",
    productFile: fileNames?.products || "",
    bdFile: fileNames?.bd || "",
    minDate: dates[0] || "",
    maxDate: dates[dates.length - 1] || "",
    sourceRows: result.sourceCount,
    sourceAsins: sourceAsins.size,
    mappedRows: compactRows.length,
    mappedAsins: new Set(compactRows.map(r => r.asin)).size,
    mappingAsins: mappingAsins.size,
    bdIntervals: bdIntervals.length,
    bdOverlapIntervals: overlappedIntervals.length,
    bdMatchedIntervals: matchedBdIntervalsArr.length,
    bdMatchedParents: result.matchedBdParents.size,
    auditCounts,
    auditSamples: Object.fromEntries(Object.entries(audit).map(([k, v]) => [k, v.slice(0, 20)])),
    options,
    bdScheduleByParent,
  };

  return { meta, rows: compactRows };
}

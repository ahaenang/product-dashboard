/* ============================================================
   Web Worker — 数据解析与构建
   在主线程外执行 XLSX.read() + 数据处理，不阻塞 UI
   ============================================================ */

import * as XLSX from 'xlsx';
import { buildDashboard } from './processor.js';

self.onmessage = async (e) => {
  const { type, payload } = e.data;
  if (type !== 'build') return;

  try {
    const post = (msg) => self.postMessage(msg);

    post({ type: 'progress', step: 'parsing_source', message: '📊 解析产品表现数据...' });
    const sourceWb = XLSX.read(payload.source, { type: 'array' });

    post({ type: 'progress', step: 'parsing_products', message: '🏷️ 解析售卖产品映射...' });
    const productsWb = XLSX.read(payload.products, { type: 'array' });

    let bdWb = null;
    if (payload.bd) {
      post({ type: 'progress', step: 'parsing_bd', message: '📅 解析BD活动表...' });
      bdWb = XLSX.read(payload.bd, { type: 'array' });
    }

    post({ type: 'progress', step: 'mapping', message: '🔗 数据映射与计算中...' });
    const result = buildDashboard(sourceWb, productsWb, bdWb, {
      source: payload.sourceName || '',
      products: payload.productsName || '',
      bd: payload.bdName || '',
    });

    const totals = {};
    for (const key of ['units', 'orders', 'netSales', 'profit', 'spend', 'adSales', 'sessions', 'adOrders', 'naturalOrders', 'returns']) {
      totals[key] = result.rows.reduce((s, r) => s + (r[key] || 0), 0);
    }
    totals.tacos = totals.netSales ? totals.spend / totals.netSales : null;
    totals.margin = totals.netSales ? totals.profit / totals.netSales : null;

    post({ type: 'progress', step: 'done', message: '✅ 处理完成' });

    post({
      type: 'result',
      payload: {
        meta: result.meta,
        rows: result.rows,
        totals,
      },
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};

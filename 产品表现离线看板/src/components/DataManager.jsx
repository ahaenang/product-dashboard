import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDashboard } from '../store/DashboardContext';
import { dbPut, dbGet, dbGetAll, saveDashboardData } from '../store/db';
import { formatFileSize } from '../utils/helpers';

const FILE_IDS = { source: "source", products: "products", bd: "bd" };
const FILE_LABELS = {
  source: ["产品表现 ASIN 数据", "cardSourceStatus"],
  products: ["售卖产品映射表", "cardProductsStatus"],
  bd: ["BD 活动排期表", "cardBdStatus"],
};
const FILE_ICONS = { source: "📊", products: "🏷️", bd: "📅" };

export default function DataManager() {
  const { state, dispatch } = useDashboard();
  const [files, setFiles] = useState({ source: null, products: null, bd: null });
  const [dragging, setDragging] = useState({});
  const workerRef = useRef(null);

  // 加载已存储文件信息
  useEffect(() => {
    (async () => {
      const stored = await dbGetAll("sourceFiles");
      const map = { source: null, products: null, bd: null };
      for (const f of stored) {
        const type = Object.entries(FILE_IDS).find(([, v]) => v === f.id)?.[0];
        if (type) map[type] = f;
      }
      setFiles(map);
    })();
  }, []);

  // 更新构建状态显示
  useEffect(() => {
    (async () => {
      const data = await dbGet("dashboardData", "current");
      const timeEl = document.getElementById("buildTimeText");
      const statusEl = document.getElementById("buildStatusText");
      if (timeEl) timeEl.textContent = data?.builtAt
        ? `上次构建: ${new Date(data.builtAt).toLocaleString("zh-CN")}`
        : "尚未构建";
      if (statusEl) statusEl.textContent = data?.builtAt ? "已构建" : "就绪";
    })();
  });

  const handleFile = useCallback(async (file, type) => {
    if (!file) return;
    await dbPut("sourceFiles", {
      id: FILE_IDS[type],
      name: file.name,
      blob: file,
      updatedAt: new Date().toISOString(),
    });
    setFiles(prev => ({ ...prev, [type]: { name: file.name, blob: file } }));

    const [label] = FILE_LABELS[type];
    dispatch({ type: "APPEND_BUILD_LOG", message: `✅ ${label} 已上传: ${file.name}` });
  }, [dispatch]);

  const handleDrop = useCallback(async (e, type) => {
    e.preventDefault();
    setDragging(prev => ({ ...prev, [type]: false }));
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file, type);
  }, [handleFile]);

  const handleBuild = useCallback(async () => {
    // 读取文件
    const sourceFile = await dbGet("sourceFiles", "source");
    const productsFile = await dbGet("sourceFiles", "products");
    const bdFile = await dbGet("sourceFiles", "bd");

    if (!sourceFile) { alert("请先上传产品表现 ASIN 数据"); return; }
    if (!productsFile) { alert("请先上传售卖产品映射表"); return; }

    dispatch({ type: "SET_BUILD_STATE", buildState: "building", log: [] });
    dispatch({ type: "CLEAR_BUILD_LOG" });
    dispatch({ type: "APPEND_BUILD_LOG", message: "🔍 读取数据源文件..." });
    dispatch({ type: "APPEND_BUILD_LOG", message: `📊 产品表现: ${sourceFile.name}` });
    dispatch({ type: "APPEND_BUILD_LOG", message: `🏷️ 售卖产品: ${productsFile.name}` });
    if (bdFile) dispatch({ type: "APPEND_BUILD_LOG", message: `📅 BD活动: ${bdFile.name}` });

    // 终止旧 worker
    if (workerRef.current) { workerRef.current.terminate(); }

    // 创建 Worker
    const worker = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (e) => {
      const { type, step, message, payload } = e.data;
      if (type === "progress") {
        dispatch({ type: "APPEND_BUILD_LOG", message });
      } else if (type === "result") {
        dispatch({ type: "SET_DATA", payload: { meta: payload.meta, rows: payload.rows } });
        saveDashboardData({ meta: payload.meta, rows: payload.rows });
        dispatch({ type: "APPEND_BUILD_LOG", message: "" });
        dispatch({ type: "APPEND_BUILD_LOG", message: `✅ 构建完成！` });
        dispatch({ type: "APPEND_BUILD_LOG", message: `  日期: ${payload.meta.minDate} ~ ${payload.meta.maxDate}` });
        dispatch({ type: "APPEND_BUILD_LOG", message: `  映射后: ${payload.meta.mappedRows} 行 · ${payload.meta.mappedAsins} 个 ASIN` });
        if (payload.totals) {
          dispatch({ type: "APPEND_BUILD_LOG", message: `  TACOS: ${payload.totals.tacos != null ? (payload.totals.tacos * 100).toFixed(2) + "%" : "N/A"}` });
          dispatch({ type: "APPEND_BUILD_LOG", message: `  毛利率: ${payload.totals.margin != null ? (payload.totals.margin * 100).toFixed(2) + "%" : "N/A"}` });
        }
        dispatch({ type: "SET_BUILD_STATE", buildState: "done" });
        dispatch({ type: "SET_VIEW", value: "main" });
        worker.terminate();
      } else if (type === "error") {
        dispatch({ type: "APPEND_BUILD_LOG", message: `❌ 构建失败: ${message}` });
        dispatch({ type: "SET_BUILD_STATE", buildState: "error" });
        worker.terminate();
      }
    };

    worker.onerror = (err) => {
      dispatch({ type: "APPEND_BUILD_LOG", message: `❌ Worker 错误: ${err.message}` });
      dispatch({ type: "SET_BUILD_STATE", buildState: "error" });
    };

    // 发送文件到 Worker
    worker.postMessage({
      type: "build",
      payload: {
        source: await sourceFile.blob.arrayBuffer(),
        products: await productsFile.blob.arrayBuffer(),
        bd: bdFile ? await bdFile.blob.arrayBuffer() : null,
        sourceName: sourceFile.name,
        productsName: productsFile.name,
        bdName: bdFile?.name || "",
      },
    }, [sourceFile.blob, productsFile.blob, bdFile?.blob].filter(Boolean).map(b => b)); // 转移所有权
  }, [dispatch]);

  // 清理 worker
  useEffect(() => {
    return () => { if (workerRef.current) workerRef.current.terminate(); };
  }, []);

  const isBuilding = state.buildState === "building";
  const statusMap = { source: "cardSourceStatus", products: "cardProductsStatus", bd: "cardBdStatus" };

  return (
    <section className="panel data-page">
      <h2>📂 数据源管理</h2>
      <p style={{ color: 'var(--muted)', margin: '0 0 16px' }}>
        上传新的 Excel 数据源文件将自动替换旧文件。拖拽文件到卡片上即可上传。上传后点击「重新构建看板」刷新所有数据。
      </p>

      <div className="data-grid">
        {Object.entries(FILE_ICONS).map(([type, icon]) => {
          const file = files[type];
          return (
            <div key={type}
              className={`data-card ${file ? "has-file" : ""} ${dragging[type] ? "drag-over" : ""}`}
              id={`card-${type}`}
              onDragOver={e => { e.preventDefault(); setDragging(prev => ({ ...prev, [type]: true })); }}
              onDragLeave={() => setDragging(prev => ({ ...prev, [type]: false }))}
              onDrop={e => handleDrop(e, type)}
            >
              <div className="data-card-icon">{icon}</div>
              <div className="data-card-title">{FILE_LABELS[type][0]}</div>
              <div className="data-card-status" id={statusMap[type]}>
                {file ? `${file.name} (${file.blob ? formatFileSize(file.blob.size) : ""})` : type === "bd" ? "未上传（可选）" : "未上传"}
              </div>
              <div className="data-card-actions">
                <label className="upload-btn">
                  <input type="file" accept=".xlsx,.xls"
                    onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0], type); e.target.value = ""; }}
                  />
                  📎 选择文件
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="build-section">
        <div className="build-info">
          <strong id="buildStatusText">就绪</strong>
          <span id="buildTimeText">尚未构建</span>
        </div>
        <button
          className="btn btn-primary"
          style={{ padding: '10px 28px', fontSize: '15px' }}
          disabled={isBuilding}
          onClick={handleBuild}
        >
          {isBuilding ? "⏳ 构建中..." : "🔨 重新构建看板"}
        </button>
      </div>

      {(state.buildLog?.length > 0) && (
        <div className="build-log" style={{ display: 'block' }}>
          {state.buildLog.join("\n")}
        </div>
      )}
    </section>
  );
}

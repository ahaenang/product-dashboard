import React from 'react';
import { useDashboard } from '../store/DashboardContext';

export default function PageTabs() {
  const { state, dispatch } = useDashboard();

  return (
    <nav className="page-tabs" aria-label="看板页面切换">
      {[
        ["main", "整体表现看板"],
        ["compare", "自定义时间对比"],
        ["data", "📂 数据管理"],
      ].map(([view, label]) => (
        <button
          key={view}
          type="button"
          className={state.view === view ? "active" : ""}
          data-view={view}
          onClick={() => dispatch({ type: "SET_VIEW", value: view })}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

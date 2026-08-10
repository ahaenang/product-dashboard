import React from 'react';
import ReactDOM from 'react-dom/client';
import { DashboardProvider } from './store/DashboardContext';
import App from './App';
import './styles/variables.css';
import './styles/layout.css';
import './styles/filters.css';
import './styles/kpi.css';
import './styles/charts.css';
import './styles/table.css';
import './styles/compare.css';
import './styles/datamanager.css';
import './styles/responsive.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DashboardProvider>
      <App />
    </DashboardProvider>
  </React.StrictMode>
);

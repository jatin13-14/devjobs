import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './app/App.jsx';
import './styles/tokens.css';
import './styles/global.css';

const theme = {
  token: {
    colorPrimary: '#2563eb',
    colorText: '#101828',
    colorTextSecondary: '#667085',
    colorBgLayout: '#f8fafc',
    borderRadius: 10,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider theme={theme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);

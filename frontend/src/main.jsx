import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './app/App.jsx';
import { RenderBoundary } from './app/RenderBoundary.jsx';
import './styles/tokens.css';
import './styles/global.css';
import './styles/candidate.css';

import { theme } from './styles/theme.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RenderBoundary><ConfigProvider theme={theme}>
      <App />
    </ConfigProvider></RenderBoundary>
  </React.StrictMode>,
);

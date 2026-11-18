import { createElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Empty } from 'antd';
import { TeamOutlined, BankOutlined, ShopOutlined, SafetyOutlined, RightOutlined } from '@ant-design/icons';
import { http } from '../auth/api.js';

export function AdminDashboard({ overview, error }) {
  const [history, setHistory] = useState(null); const [failed, setFailed] = useState(false);
  useEffect(() => { let live = true; http.get('/admin/history/', { params: { page: 1, page_size: 4 } }).then(({ data }) => { if (live) setHistory(data.results); }).catch(() => { if (live) setFailed(true); }); return () => { live = false; }; }, []);
  const metrics = [['candidates', 'Candidates', TeamOutlined], ['recruiters', 'Recruiters', SafetyOutlined], ['companies', 'Companies', BankOutlined], ['jobs', 'Jobs', ShopOutlined]];
  return <section className="admin-dashboard"><h1>Admin Dashboard</h1><p>Manage platform users, companies, and jobs.</p>{error && <Alert type="error" title={error} role="alert" />}
    <div className="admin-metrics">{metrics.map(([key, label, Icon]) => <Link to={`/admin?section=${key}`} className="admin-panel admin-metric" key={key}>{createElement(Icon)}<strong>{Number.isFinite(overview[key]) ? overview[key].toLocaleString() : '—'}</strong><span>{label}</span></Link>)}</div>
    <div className="admin-dashboard-grid"><section className="admin-panel admin-activity"><h2>Platform Activity</h2><div className="admin-chart-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Historical activity unavailable" /><p>The API provides current totals without a historical time series.</p></div></section><section className="admin-panel"><div className="admin-panel-heading"><h2>Recent Activity</h2><Link to="/admin?section=history">View All →</Link></div><p className="admin-muted">Recorded moderation decisions</p>{failed ? <p role="alert">Activity could not be loaded. <Link to="/admin?section=history">Open audit history</Link></p> : history === null ? <p role="status">Loading activity…</p> : history.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No moderation decisions recorded" /> : <ul className="admin-events">{history.map((event) => <li key={event.id}><SafetyOutlined /><span><strong>{event.action} · {event.target_type}</strong><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></span></li>)}</ul>}</section></div>
    <h2 className="admin-review-title">Moderation workspace</h2><div className="admin-review-grid">{[['companies', 'Company moderation', BankOutlined], ['jobs', 'Job moderation', ShopOutlined], ['history', 'Audit history', SafetyOutlined]].map(([key, label, Icon]) => <Link key={key} className="admin-panel admin-review" to={`/admin?section=${key}`}>{createElement(Icon)}<span>{label}</span><RightOutlined /></Link>)}</div>
  </section>;
}

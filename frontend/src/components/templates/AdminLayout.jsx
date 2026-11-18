import { createElement, useState } from 'react';
import { Link, Outlet, useSearchParams, useNavigate } from 'react-router-dom';
import { Avatar, Button, ConfigProvider, Dropdown, Input, theme } from 'antd';
import { HomeOutlined, TeamOutlined, BankOutlined, ShopOutlined, HistoryOutlined, SunOutlined, MoonOutlined, DownOutlined, MoreOutlined } from '@ant-design/icons';
import { useAuth } from '../../features/auth/useAuth.js';
import '../../styles/admin.css';

const links = [['dashboard', 'Dashboard', HomeOutlined], ['candidates', 'Candidates', TeamOutlined], ['recruiters', 'Recruiters', TeamOutlined], ['companies', 'Companies', BankOutlined], ['jobs', 'Jobs', ShopOutlined], ['history', 'Audit History', HistoryOutlined]];
export function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth(); const [params] = useSearchParams();
  const section = params.get('section') || 'dashboard';
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('devjobs.admin.theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  function toggle() { const next = mode === 'light' ? 'dark' : 'light'; setMode(next); try { localStorage.setItem('devjobs.admin.theme', next); } catch { /* In-memory fallback. */ } }
  const nav = (items) => items.map(([key, label, Icon]) => <Link key={key} to={key === 'dashboard' ? '/admin' : `/admin?section=${key}`} aria-current={section === key ? 'page' : undefined} className={`admin-nav-link${section === key ? ' active' : ''}`}>{createElement(Icon, { 'aria-hidden': true })}<span>{label}</span></Link>);
  const brand = <span className="admin-brand"><b aria-hidden="true">〈/〉</b>DevJobs</span>;
  return <ConfigProvider theme={{ inherit: false, algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm, token: { motion: false, colorPrimary: '#2563eb', colorBgContainer: mode === 'dark' ? '#152231' : '#ffffff', colorText: mode === 'dark' ? '#f8fafc' : '#0f172a', colorTextSecondary: mode === 'dark' ? '#b8c6d6' : '#526171', colorBorder: mode === 'dark' ? '#334155' : '#e2e8f0', borderRadius: 10, controlHeight: 44 } }}><div className={`admin-shell admin-${mode}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="admin-sidebar"><Link to="/admin">{brand}</Link><span className="admin-badge">Admin</span><nav aria-label="Admin workspace">{nav(links)}</nav><div className="admin-sidebar-foot"><Avatar>AD</Avatar><span>Admin Workspace<small>Platform Management</small></span></div></aside>
    <header className="admin-header"><Link className="admin-mobile-brand" to="/admin">{brand}<span className="admin-badge">Admin</span></Link><Input.Search className="admin-header-search" aria-label="Search companies" placeholder="Search companies…" onSearch={(value) => navigate(`/admin?section=companies&q=${encodeURIComponent(value)}`)} /><Button type="text" shape="circle" aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} onClick={toggle} icon={mode === 'light' ? <SunOutlined /> : <MoonOutlined />} /><Dropdown trigger={['click']} menu={{ items: [{ key: 'identity', label: user?.email, disabled: true }, { key: 'logout', label: 'Log out', onClick: logout }] }}><Button type="text" className="admin-account" aria-label="Open user menu"><Avatar>{(user?.email || 'A')[0].toUpperCase()}</Avatar><span>Administrator<small>Admin</small></span><DownOutlined /></Button></Dropdown></header>
    <main id="main-content" className="admin-main"><Outlet /></main><nav className="admin-bottom-nav" aria-label="Mobile admin navigation">{nav([links[0], links[1], links[3], links[4]])}<Dropdown trigger={['click']} menu={{ items: [links[2], links[5]].map(([key, label]) => ({ key, label: <Link to={`/admin?section=${key}`}>{label}</Link> })) }}><Button type="text" aria-label="More admin sections"><MoreOutlined /><span>More</span></Button></Dropdown></nav>
  </div></ConfigProvider>;
}

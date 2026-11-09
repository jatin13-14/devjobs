import { createElement, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar, Button, ConfigProvider, Dropdown, Input, theme } from 'antd';
import { HomeOutlined, TeamOutlined, BankOutlined, UserOutlined, ShopOutlined, SunOutlined, MoonOutlined, DownOutlined, BarChartOutlined } from '@ant-design/icons';
import { useAuth } from '../../features/auth/useAuth.js';
import { jobsApi } from '../../features/jobs/services/api.js';
import '../../styles/recruiter.css';

const links = [['/recruiter', 'Dashboard', HomeOutlined], ['/recruiter/jobs', 'Jobs', ShopOutlined], ['/recruiter/applicants', 'Applicants', TeamOutlined], ['/recruiter/companies', 'Company', BankOutlined], ['/recruiter/profile', 'Profile', UserOutlined]];
export function RecruiterLayout() {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const [params] = useSearchParams();
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('devjobs.recruiter.theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  const [name, setName] = useState('');
  const [company, setCompany] = useState(null);
  useEffect(() => { let live = true; jobsApi.recruiterProfile().then((p) => { if (live) setName(p.name || ''); }).catch(() => {}); jobsApi.recruiterCompanies().then((items) => { if (live) setCompany(items.length === 1 ? items[0] : null); }).catch(() => {}); return () => { live = false; }; }, [user?.id]);
  function toggle() { const next = mode === 'light' ? 'dark' : 'light'; setMode(next); try { localStorage.setItem('devjobs.recruiter.theme', next); } catch { /* Keep the in-memory preference. */ } }
  const nav = (bottom = false) => (bottom ? links : [...links.slice(0, 4), ['/recruiter/companies', 'Team', TeamOutlined], ['/recruiter#applications-overview', 'Analytics', BarChartOutlined]]).map(([to, label, Icon]) => <NavLink key={label} to={to} end={to === '/recruiter'} className={({ isActive }) => `recruiter-nav-link${isActive && label !== 'Team' && label !== 'Analytics' ? ' active' : ''}`}>{createElement(Icon, { 'aria-hidden': true })}<span>{label}</span></NavLink>);
  const brand = <span className="recruiter-brand"><span aria-hidden="true">〈/〉</span> DevJobs</span>;
  return <ConfigProvider wave={{ disabled: true }} theme={{ inherit: false, algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm, token: { motion: false, colorPrimary: mode === 'dark' ? '#16e8b4' : '#00803c', colorPrimaryHover: mode === 'dark' ? '#56f5ce' : '#006b32', colorText: mode === 'dark' ? '#f4f8fa' : '#101727', colorTextSecondary: mode === 'dark' ? '#b6c8ca' : '#526171', colorBgContainer: mode === 'dark' ? '#152a30' : '#ffffff', colorBorder: mode === 'dark' ? '#31494e' : '#e2e8ef', borderRadius: 12, controlHeight: 44 } }}><div className={`recruiter-shell recruiter-${mode}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="recruiter-sidebar"><Link to="/recruiter" aria-label="DevJobs recruiter dashboard">{brand}</Link><span className="recruiter-role">Recruiter</span><nav aria-label="Recruiter workspace">{nav()}</nav><Link className="recruiter-sidebar-account" to={company ? `/recruiter/companies/${company.id}` : '/recruiter/companies'}><Avatar size={32}>{company ? company.name.slice(0, 1) : 'C'}</Avatar><span>{company?.name || 'Company workspace'}<span>{company ? 'Company profile →' : 'Choose your company →'}</span></span></Link></aside>
    <header className="recruiter-header"><Link className="recruiter-mobile-brand" to="/recruiter">{brand}</Link><Input.Search className="recruiter-search" aria-label="Search company jobs" placeholder="Search company jobs…" onSearch={(value) => navigate(`/recruiter/jobs?${params.get('company') || company?.id ? `company=${encodeURIComponent(params.get('company') || company.id)}&` : ''}search=${encodeURIComponent(value)}`)} /><Button type="text" shape="circle" aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} onClick={toggle} icon={mode === 'light' ? <SunOutlined /> : <MoonOutlined />} /><Dropdown trigger={['click']} menu={{ items: [{ key: 'profile', label: <Link to="/recruiter/profile">My profile</Link> }, { key: 'logout', label: 'Log out', onClick: logout }] }}><Button type="text" className="recruiter-account" aria-label="Open user menu"><Avatar size={32}>{(name || user?.email || '?').slice(0, 1).toUpperCase()}</Avatar><span>{name || 'Account'}<small>Recruiter</small></span><DownOutlined /></Button></Dropdown></header>
    <main id="main-content" className="recruiter-main"><Outlet /></main><nav className="recruiter-bottom-nav" aria-label="Mobile recruiter navigation">{nav(true)}</nav>
  </div></ConfigProvider>;
}

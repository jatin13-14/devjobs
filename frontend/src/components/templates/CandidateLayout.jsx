import { createElement, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Avatar, Button, ConfigProvider, Dropdown, Input, theme as antdTheme } from 'antd';
import { HomeOutlined, SearchOutlined, FileTextOutlined, UserOutlined, SunOutlined, MoonOutlined, DownOutlined } from '@ant-design/icons';
import { useAuth } from '../../features/auth/useAuth.js';
import { http } from '../../features/auth/api.js';

const links = [['/candidate', 'Dashboard', HomeOutlined], ['/', 'Find Jobs', SearchOutlined], ['/candidate/applications', 'Applications', FileTextOutlined], ['/candidate/profile', 'Profile', UserOutlined], ['/candidate/resume', 'Resume', FileTextOutlined]];
export function CandidateLayout({ authenticated = false }) {
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('devjobs.candidate.theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  const [name, setName] = useState('');
  const { user, logout } = useAuth(); const navigate = useNavigate();
  useEffect(() => { let live = true; if (authenticated) http.get('/candidates/me/profile/').then(({ data }) => { if (live) setName(data.full_name || ''); }).catch(() => {}); return () => { live = false; }; }, [authenticated, user?.id]);
  function toggle() { const next = mode === 'light' ? 'dark' : 'light'; setMode(next); try { localStorage.setItem('devjobs.candidate.theme', next); } catch { /* Preference remains usable without storage. */ } }
  const nav = (bottom = false) => links.filter((item) => !bottom || item[0] !== '/candidate/resume').map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/' || to === '/candidate'} className={({ isActive }) => `candidate-nav-link${isActive ? ' active' : ''}`}>{createElement(Icon)}<span>{label}</span></NavLink>);
  return <ConfigProvider wave={{ disabled: true }} theme={{ inherit: false, algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm, token: { motion: false, colorPrimary: '#5837ff', colorBgContainer: mode === 'dark' ? '#151e30' : '#ffffff', colorText: mode === 'dark' ? '#f8fafc' : '#10132c', colorTextSecondary: mode === 'dark' ? '#a7b3cb' : '#535d7d', colorBorder: mode === 'dark' ? '#2b3650' : '#e4e5f4', borderRadius: 12 } }}><div className={`candidate-shell candidate-${mode}${authenticated ? '' : ' candidate-public'}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {authenticated && <aside className="candidate-sidebar"><Link to="/candidate" aria-label="DevJobs dashboard"><span className="brand-mark"><span aria-hidden="true">〈/〉</span> DevJobs</span></Link><nav aria-label="Candidate workspace">{nav()}</nav></aside>}
    <header className="candidate-header"><Link className="candidate-mobile-brand" to={authenticated ? '/candidate' : '/'}><span className="brand-mark"><span aria-hidden="true">〈/〉</span> DevJobs</span></Link>{authenticated && <Input.Search className="candidate-search" aria-label="Search jobs by title, company, skills, or location" placeholder="Search jobs by title, company, skills, or location..." onSearch={(value) => navigate(`/?search=${encodeURIComponent(value)}`)} />}
      <Button className="candidate-theme-toggle" onClick={toggle} aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} icon={mode === 'light' ? <SunOutlined /> : <MoonOutlined />}>{mode === 'light' ? 'Light' : 'Dark'}</Button>
      {authenticated ? <Dropdown trigger={['click']} menu={{ items: [{ key: 'profile', label: <Link to="/candidate/profile">My profile</Link> }, { key: 'resume', label: <Link to="/candidate/resume">Resume</Link> }, { key: 'logout', label: 'Log out', onClick: logout }] }}><Button type="text" className="candidate-account" aria-label="Open user menu"><Avatar size={32}>{(name || user?.email || '?').slice(0, 1).toUpperCase()}</Avatar><span>{name || 'Account'}</span><DownOutlined /></Button></Dropdown> : <Link to="/login">Log in</Link>}
    </header><main id="main-content" className="candidate-main"><Outlet /></main>{authenticated && <nav className="candidate-bottom-nav" aria-label="Mobile candidate navigation">{nav(true)}</nav>}
  </div></ConfigProvider>;
}

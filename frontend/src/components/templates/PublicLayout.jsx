import { createElement, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button, ConfigProvider, Drawer } from 'antd';
import { AppstoreOutlined, SearchOutlined, FileTextOutlined, UserOutlined, TeamOutlined, BankOutlined, SafetyOutlined, HistoryOutlined, CodeOutlined } from '@ant-design/icons';
import { PrimaryNavigation } from '../molecules/PrimaryNavigation.jsx';
import { useAuth } from '../../features/auth/useAuth.js';
import { CandidateLayout } from './CandidateLayout.jsx';
import { roleColors } from '../../styles/theme.js';

const navigation = {
  candidate: [['/candidate', 'Overview', AppstoreOutlined], ['/', 'Discover Jobs', SearchOutlined], ['/candidate/applications', 'My Applications', FileTextOutlined], ['/candidate/profile', 'My Profile', UserOutlined], ['/candidate/skills', 'My Skills', CodeOutlined], ['/candidate/resume', 'My Resume', FileTextOutlined]],
  recruiter: [['/recruiter', 'Overview', AppstoreOutlined], ['/recruiter/companies', 'My Companies', BankOutlined], ['/recruiter/jobs', 'Job Postings', FileTextOutlined], ['/recruiter/applicants', 'Applicants', TeamOutlined], ['/recruiter/profile', 'Recruiter Profile', UserOutlined]],
  admin: [['/admin', 'Platform Overview', SafetyOutlined], ...['companies', 'recruiters', 'candidates', 'jobs', 'history'].map((kind) => [`/admin?section=${kind}`, ({ jobs: 'Jobs Moderation', history: 'Audit History' })[kind] || kind[0].toUpperCase() + kind.slice(1), kind === 'history' ? HistoryOutlined : TeamOutlined])],
};
export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth(); const location = useLocation();
  const authPage = /^(\/login|\/register|\/admin\/login)/.test(location.pathname);
  const role = !authPage && user ? (user.is_platform_admin ? 'admin' : user.role) : null;
  if (role === 'candidate' || (!user && (location.pathname === '/login' || location.pathname === '/register/candidate'))) return <CandidateLayout authenticated={role === 'candidate'} />;
  const sidebar = role && <><div className="workspace-label">{role === 'candidate' ? 'Career workspace' : 'Workspace'}</div><nav aria-label={`${role} workspace`}>{navigation[role]?.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/' || to === '/candidate' || to === '/recruiter'} onClick={() => setMenuOpen(false)} className={({ isActive }) => (role === 'admin' ? location.pathname + location.search === to : isActive) ? 'workspace-link active' : 'workspace-link'}>{createElement(Icon, { 'aria-hidden': true })}<span>{label}</span></NavLink>)}</nav></>;
  return <ConfigProvider theme={{ token: { colorPrimary: roleColors[role || (location.pathname.includes('recruiter') ? 'recruiter' : location.pathname === '/admin/login' ? 'admin' : 'candidate')] } }}><div className={`app-shell ${role ? `workspace role-${role}` : 'public-shell'}`}>
    <a className="skip-link" href="#main-content">Skip to content</a><PrimaryNavigation />
    <div className="workspace-body">{role && <><aside className="workspace-sidebar">{sidebar}</aside><div className="workspace-mobile-menu"><Button onClick={() => setMenuOpen(true)} aria-label="Open workspace menu" aria-expanded={menuOpen}>☰ Menu</Button></div><Drawer title="DevJobs workspace" open={menuOpen} onClose={() => setMenuOpen(false)} placement="left" size="default">{sidebar}</Drawer></>}
    <main id="main-content" className="workspace-main"><Outlet /></main></div>
    <footer className="site-footer"><div className="container">© {new Date().getFullYear()} DevJobs. Built for the people who build software.</div></footer>
  </div></ConfigProvider>;
}

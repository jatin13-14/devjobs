import { createElement, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Alert, Avatar, Button } from 'antd';
import { ShopOutlined, TeamOutlined, ClockCircleOutlined, CheckCircleOutlined, PlusOutlined, BankOutlined, EditOutlined, RightOutlined } from '@ant-design/icons';
import { jobsApi } from '../services/api.js';
import { parseApplicationOverview } from '../services/recruiterOverview.js';

export function RecruiterOverview({ profile, selected, activeJobs, authorization, companyPicker, error, retry }) {
  const { hash } = useLocation();
  const canManage = ['OWNER', 'ADMIN'].includes(selected?.role);
  const [data, setData] = useState(null);
  const execute = authorization.execute;
  useEffect(() => {
    let live = true;
    if (!selected || error) return () => { live = false; };
    const identity = selected;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    Promise.allSettled([
      jobsApi.company(selected.id),
      canManage ? execute((config) => jobsApi.companyApplicationOverview(selected.id, timeZone, config)).then(parseApplicationOverview) : Promise.resolve(null),
    ]).then(([company, applications]) => {
      if (live) setData({ identity, company: company.status === 'fulfilled' ? company.value : null, applications: applications.status === 'fulfilled' ? applications.value : null, failed: applications.status === 'rejected' });
    });
    return () => { live = false; };
  }, [selected, canManage, error, execute]);
  const current = data?.identity === selected ? data : null;
  useEffect(() => { if (hash === '#applications-overview') document.getElementById('applications-overview')?.scrollIntoView({ block: 'start' }); }, [hash, current]);
  const stats = current?.applications;
  const companyQuery = selected ? `?company=${selected.id}` : '';
  const post = canManage && <Link to={`/recruiter/jobs/new${companyQuery}`}><Button type="primary" icon={<PlusOutlined />}>Post a Job</Button></Link>;
  const cards = [[ShopOutlined, selected && !error ? activeJobs ?? '—' : '—', 'Active Jobs'], [TeamOutlined, stats?.total ?? '—', 'Total Applicants'], [ClockCircleOutlined, stats?.submitted ?? '—', 'New Applicants'], [CheckCircleOutlined, stats?.reviewing ?? '—', 'In Review']];
  const max = Math.max(2, Math.ceil(Math.max(0, ...(stats?.days.map((d) => d.count) || [])) / 2) * 2);
  const points = stats?.days.map((day, i) => `${28 + i * 48},${150 - day.count / max * 120}`).join(' ');
  return <section className="recruiter-overview">
    <div className="recruiter-overview-main"><div className="recruiter-welcome"><div><p>Hi{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''} 👋</p><h1>Recruiter Workspace</h1><p>Manage jobs, review applicants, and build your team.</p></div><div className="recruiter-welcome-actions">{post}<Link className="recruiter-mobile-review" to="/recruiter/applicants"><Button>Review Applicants</Button></Link></div></div>
    {error && <Alert type="error" title={error} action={<Button onClick={retry}>Retry</Button>} />}{companyPicker}
    <div className="recruiter-metrics">{cards.map(([Icon, value, label], i) => <article className={`recruiter-metric metric-${i}`} key={label}>{createElement(Icon, { 'aria-hidden': true })}<strong>{value}</strong><span>{label}</span></article>)}</div>
    {!selected && <div className="recruiter-panel recruiter-no-company"><p>You have no active company selected.</p><Link to="/recruiter/companies">Choose or create a company →</Link></div>}
    <div className="recruiter-overview-panels"><section className="recruiter-panel recruiter-chart" id="applications-overview"><div className="recruiter-panel-heading"><h2>Applications Overview</h2><span>Last 7 Days</span></div>{stats ? <><svg viewBox="0 0 340 190" role="img" aria-label={`Daily applications in the last seven days: ${stats.days.map((d) => d.count).join(', ')}`}><defs><linearGradient id="recruiter-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#10b981" stopOpacity=".4" /><stop offset="1" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs>{[0, .5, 1].map((n) => <g key={n}><line x1="28" x2="316" y1={150 - n * 120} y2={150 - n * 120} stroke="currentColor" opacity=".1" /><text x="4" y={154 - n * 120}>{Math.round(n * max)}</text></g>)}<polygon points={`28,150 ${points} 316,150`} fill="url(#recruiter-chart-fill)" /><polyline points={points} fill="none" stroke="#10b981" strokeWidth="2.5" />{stats.days.map((d, i) => <g key={i}><circle cx={28 + i * 48} cy={150 - d.count / max * 120} r="3" fill="#10b981" /><text x={28 + i * 48} y="177" textAnchor="middle">{d.date.toLocaleDateString(undefined, { weekday: 'short' })}</text></g>)}</svg><p className="recruiter-chart-note">Daily applications · local time</p></> : <p className="recruiter-empty">{!canManage ? 'Applicant activity requires an OWNER or ADMIN membership.' : current?.failed ? 'Application activity unavailable.' : 'Loading application activity…'}</p>}{current?.failed && <Button onClick={retry}>Retry activity</Button>}</section>
    <section className="recruiter-panel recruiter-recent"><div className="recruiter-panel-heading"><h2>Recent Applicants</h2><Link to="/recruiter/applicants">View All →</Link></div>{stats && current.applications.recent.length ? current.applications.recent.map((a) => <Link className="recruiter-recent-row" key={a.id} to={`/recruiter/jobs/${a.job.id}/applicants/${a.id}${companyQuery}`}><Avatar>{a.candidate.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</Avatar><span><strong>{a.candidate.full_name}</strong><small>{a.candidate.professional_headline || a.job.title}</small></span><time dateTime={a.applied_at}>{new Date(a.applied_at).toLocaleDateString()}</time></Link>) : <p className="recruiter-empty">{stats ? 'No applicants yet. New applications will appear here.' : 'Applicant information unavailable.'}</p>}</section></div></div>
    <aside className="recruiter-overview-aside"><section className="recruiter-panel"><h2>Company Overview</h2>{selected ? <><div className="recruiter-company-summary"><Avatar shape="square" size={54}>{selected.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</Avatar><div><strong>{selected.name}</strong><small>{[current?.company?.industry, current?.company?.company_size].filter(Boolean).join(' · ')}</small></div></div><p className="recruiter-membership">Active membership · {selected.role}</p><Link className="recruiter-outline-link" to={`/recruiter/companies/${selected.id}`}>{canManage ? 'Manage Company' : 'View Company'} ↗</Link></> : <Link to="/recruiter/companies">Choose a company →</Link>}</section>
    <section className="recruiter-panel recruiter-quick"><h2>Quick Actions</h2>{(canManage ? [[`/recruiter/jobs/new${companyQuery}`, 'Post a New Job', ShopOutlined], ['/recruiter/applicants', 'Review Applicants', TeamOutlined], [`/recruiter/companies/${selected.id}`, 'Edit Company Profile', EditOutlined], [`/recruiter/companies/${selected.id}`, 'Invite Team Member', TeamOutlined]] : [['/recruiter/jobs', 'View Jobs', ShopOutlined], ['/recruiter/companies', 'View Company', BankOutlined]]).map(([to, label, Icon]) => <Link key={label} to={to}>{createElement(Icon)}<span>{label}</span><RightOutlined /></Link>)}</section></aside>
  </section>;
}

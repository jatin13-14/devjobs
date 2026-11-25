import { Link } from 'react-router-dom';
import { Avatar, Button, Dropdown } from 'antd';
import { Brand } from '../atoms/Brand.jsx';
import { useAuth } from '../../features/auth/useAuth.js';

export function PrimaryNavigation() {
  const { user, logout } = useAuth();
  return <header className="site-header"><div className="container nav-content">
    <Link to="/" className="brand-link" aria-label="DevJobs home"><Brand /></Link>
    <nav className="nav-links" aria-label="Main navigation"><Link to="/">Discover Jobs</Link>{!user && <Link to="/register/recruiter">For employers</Link>}</nav>
    <div className="nav-actions">{user ? <><Dropdown menu={{ items: [{ key: 'profile', label: <Link to={user.is_platform_admin ? '/admin' : `/${user.role}/profile`}>My profile</Link> }, ...(user.role === 'candidate' ? [{ key: 'saved-jobs', label: <Link to="/candidate/saved-jobs">Saved jobs</Link> }] : []), { key: 'logout', label: 'Log out', onClick: logout }] }} trigger={['click']}><Button aria-label="Open user menu"><Avatar size="small">{user.email?.[0]?.toUpperCase()}</Avatar><span className="nav-user">{user.email}</span></Button></Dropdown></> : <><Link to="/login"><Button type="text">Log in</Button></Link><Link to="/register/candidate"><Button type="primary">Create account</Button></Link></>}</div>
  </div></header>;
}

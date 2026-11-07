import { Link } from 'react-router-dom';
import { Button } from 'antd';
import { Brand } from '../atoms/Brand.jsx';
import { useAuth } from '../../features/auth/useAuth.js';

export function PrimaryNavigation() {
  const { user, logout } = useAuth();
  return (
    <header className="site-header">
      <div className="container nav-content">
        <Link to="/" className="brand-link"><Brand /></Link>
        <nav className="nav-links" aria-label="Main navigation">
          <Link to="/">Jobs</Link>
          {user?.is_platform_admin && <Link to="/admin">Administration</Link>}
          {user?.role === 'candidate' && <><Link to="/candidate/applications">My Applications</Link><Link to="/candidate/profile">My Profile</Link><Link to="/candidate/resume">My Resume</Link></>}
          {user?.role === 'recruiter' && <><Link to="/recruiter/profile">My Profile</Link><Link to="/recruiter/companies/new">Create company</Link><Link to="/recruiter">Dashboard</Link><Link to="/recruiter/jobs">Company Jobs</Link></>}
          <a href="#companies">Companies</a>
          <a href="#resources">Career resources</a>
        </nav>
        <div className="nav-actions">
          {user ? <><span className="nav-user">{user.email}</span><Button type="text" onClick={logout}>Log out</Button></> : <><Link to="/login"><Button type="text">Log in</Button></Link><Link to="/register/candidate"><Button type="primary">Create account</Button></Link></>}
        </div>
      </div>
    </header>
  );
}

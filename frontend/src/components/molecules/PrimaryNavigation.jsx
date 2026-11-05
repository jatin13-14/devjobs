import { Link } from 'react-router-dom';
import { Button } from 'antd';
import { Brand } from '../atoms/Brand.jsx';

export function PrimaryNavigation() {
  return (
    <header className="site-header">
      <div className="container nav-content">
        <Link to="/" className="brand-link"><Brand /></Link>
        <nav className="nav-links" aria-label="Main navigation">
          <Link to="/">Find jobs</Link>
          <a href="#companies">Companies</a>
          <a href="#resources">Career resources</a>
        </nav>
        <div className="nav-actions">
          <Button type="text">Log in</Button>
          <Button type="primary">Create account</Button>
        </div>
      </div>
    </header>
  );
}

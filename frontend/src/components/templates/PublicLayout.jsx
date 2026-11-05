import { Outlet } from 'react-router-dom';
import { PrimaryNavigation } from '../molecules/PrimaryNavigation.jsx';

export function PublicLayout() {
  return (
    <>
      <PrimaryNavigation />
      <main><Outlet /></main>
      <footer className="site-footer">
        <div className="container">© {new Date().getFullYear()} DevJobs. Built for the people who build software.</div>
      </footer>
    </>
  );
}

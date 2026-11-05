import { JobSearchHero } from '../components/JobSearchHero.jsx';

export function JobSearchPage() {
  return (
    <>
      <JobSearchHero />
      <section className="container intro-section">
        <div>
          <p className="eyebrow">A BETTER WAY TO FIND WORK</p>
          <h2>Opportunities for people who build.</h2>
        </div>
        <p className="intro-copy">Search across software, data and AI roles. More focused discovery and candidate tools are coming as we build the MVP.</p>
      </section>
    </>
  );
}

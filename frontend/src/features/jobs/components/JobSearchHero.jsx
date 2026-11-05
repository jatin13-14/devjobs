import { Button, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const roleOptions = [
  { value: 'engineering', label: 'Software engineering' },
  { value: 'ai', label: 'AI / Machine learning' },
  { value: 'full-stack', label: 'Full-stack development' },
  { value: 'backend', label: 'Backend development' },
  { value: 'frontend', label: 'Frontend development' },
];

export function JobSearchHero() {
  return (
    <section className="hero-section">
      <div className="container hero-content">
        <p className="eyebrow">THE NEXT CHAPTER STARTS HERE</p>
        <h1>Build what’s next.<br /><span>Find your next role.</span></h1>
        <p className="hero-description">Explore opportunities with teams building the future of technology.</p>
        <div className="search-panel" role="search" aria-label="Search jobs">
          <Input
            size="large"
            prefix={<SearchOutlined />}
            placeholder="Job title, skill or company"
            aria-label="Job title, skill or company"
          />
          <Select
            size="large"
            placeholder="Specialization"
            options={roleOptions}
            aria-label="Specialization"
          />
          <Button size="large" type="primary">Search jobs</Button>
        </div>
        <p className="search-hint">Popular: Python · React · AI Engineer · Django</p>
      </div>
    </section>
  );
}

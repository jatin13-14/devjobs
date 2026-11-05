import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfigProvider } from 'antd';
import { JobSearchHero } from './JobSearchHero.jsx';

describe('JobSearchHero', () => {
  it('renders the job search heading and accessible search controls', () => {
    render(<ConfigProvider><JobSearchHero /></ConfigProvider>);
    expect(screen.getByRole('heading', { name: /build what’s next/i })).toBeInTheDocument();
    expect(screen.getByRole('search', { name: /search jobs/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /job title, skill or company/i })).toBeInTheDocument();
  });
});

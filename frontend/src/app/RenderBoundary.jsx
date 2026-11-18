import { Component } from 'react';

// Keep this fallback independent of Ant Design and the authenticated layouts:
// it must still render when one of those providers or layouts throws.
export class RenderBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error, info) {
    // Component names locate the failure without logging API bodies or user data.
    console.error('DevJobs rendering failed', { name: error.name, componentStack: info.componentStack });
  }

  render() {
    if (this.state.failed) return <main className="container page-state" role="alert">
      <h1>This page could not be displayed</h1>
      <p>Try again, or reload the page to fetch the latest application files.</p>
      <button type="button" onClick={() => this.setState({ failed: false })}>Try again</button>{' '}
      <button type="button" onClick={() => window.location.reload()}>Reload page</button>{' '}
      <a href="/">Browse jobs</a>
    </main>;
    return this.props.children;
  }
}

import { Card, Tag } from 'antd';
export function PageHeader({ eyebrow, title, description, action }) {
  return <header className="workspace-page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action}</header>;
}
export function StatCard({ label, value, hint }) {
  return <Card className="stat-card"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</Card>;
}
export function StatusLabel({ value }) {
  const color = { SUBMITTED: 'blue', REVIEWING: 'gold', SHORTLISTED: 'green', REJECTED: 'red', PUBLISHED: 'green', DRAFT: 'gold', Restricted: 'red', Active: 'green' }[value];
  return <Tag color={color}>{String(value).replaceAll('_', ' ')}</Tag>;
}

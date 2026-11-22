import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ROUTES } from '../seo/RouteMeta';

const linkStyle = {
  color: 'var(--gold)',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 14px',
};

// Shown for any address that is not a Meridian page. Vercel serves the same page with a real 404 status
// (build/404.html), and this keeps in-app navigation to an unknown address consistent with it.
export default function NotFound() {
  const links = ROUTES.filter((r) => r.indexable && r.key !== 'disclaimer');
  return (
    <div className="page-fade-in" style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 20px' }}>
      <Helmet>
        <title>Page not found | Meridian</title>
      </Helmet>
      <p style={{ color: 'var(--gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 8px' }}>
        Error 404
      </p>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '32px', fontWeight: 600, margin: '0 0 12px' }}>Page not found</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7, margin: '0 0 28px' }}>
        We couldn&rsquo;t find that page. It may have moved, or the address may be mistyped.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {links.map((r) => (
          <Link key={r.key} to={r.path} style={linkStyle}>{r.nav}</Link>
        ))}
      </div>
    </div>
  );
}

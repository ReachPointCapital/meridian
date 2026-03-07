import React, { useState, useEffect } from 'react';
import MacroSidebar from './MacroSidebar';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('meridian_sidebar_collapsed') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    const handler = () => {
      try {
        setCollapsed(localStorage.getItem('meridian_sidebar_collapsed') === 'true');
      } catch {}
    };
    window.addEventListener('storage', handler);
    // Also listen for custom event from MacroSidebar
    window.addEventListener('sidebar-toggle', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('sidebar-toggle', handler);
    };
  }, []);

  const sidebarWidth = collapsed ? 32 : 200;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <MacroSidebar />
      <main className="main-content" style={{
        paddingTop: '72px',
        paddingLeft: '24px',
        paddingRight: `${sidebarWidth + 24}px`,
        paddingBottom: '24px',
        minHeight: '100vh',
        transition: 'padding-right 200ms ease',
      }}>
        {children}
      </main>
      <style>{`
        @media (max-width: 1200px) {
          .macro-sidebar-desktop { display: none !important; }
          .macro-mobile-toggle { display: flex !important; }
          .macro-sidebar-mobile { display: flex !important; }
          .main-content {
            padding-right: 24px !important;
          }
        }
        @media (max-width: 768px) {
          .main-content {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
        }
      `}</style>
    </div>
  );
}

import { useState, useEffect } from 'react';

export default function DisclaimerModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('meridian-disclaimer-accepted');
    if (!accepted) setShow(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem('meridian-disclaimer-accepted', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#0D1117',
        border: '1px solid rgba(240,165,0,0.3)',
        borderRadius: '12px',
        maxWidth: '560px',
        width: '100%',
        padding: '36px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            background: '#F0A500', color: '#000000',
            fontSize: '11px', fontWeight: '800',
            padding: '3px 8px', borderRadius: '4px', letterSpacing: '0.05em',
          }}>
            MERIDIAN
          </div>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff' }}>
            Important Disclaimer
          </span>
        </div>

        {/* Body */}
        <div style={{ fontSize: '13px', lineHeight: '1.7', color: 'rgba(255,255,255,0.7)', marginBottom: '24px' }}>
          <p style={{ marginBottom: '14px' }}>
            Meridian is a <strong style={{ color: '#ffffff' }}>financial data and research platform</strong> provided
            for <strong style={{ color: '#ffffff' }}>informational purposes only</strong>. Nothing on this platform
            constitutes investment advice, a recommendation to buy or sell any security, or an offer to provide
            investment advisory services.
          </p>
          <p style={{ marginBottom: '14px' }}>
            All data, valuations, models, and analysis — including the Reach Point Base Model, DCF, LBO, and
            scenario outputs — are <strong style={{ color: '#ffffff' }}>quantitative estimates based on historical
            data and mathematical assumptions</strong>. They do not account for all factors that may affect
            the value or performance of any security.
          </p>
          <p style={{ marginBottom: '14px' }}>
            Market data may be <strong style={{ color: '#ffffff' }}>delayed, inaccurate, or incomplete</strong>.
            Reach Point Research makes no representations or warranties regarding the accuracy or completeness
            of any information displayed.
          </p>
          <p style={{ marginBottom: '0' }}>
            <strong style={{ color: '#ffffff' }}>Past performance does not guarantee future results.</strong> Always
            conduct your own due diligence and consult a qualified financial advisor before making investment decisions.
          </p>
        </div>

        {/* Links row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <a
            href="/disclaimer"
            style={{ fontSize: '11px', color: 'rgba(240,165,0,0.7)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Read full disclaimer →
          </a>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>
            © 2026 Reach Point Research · Reach Point Capital LLC
          </span>
        </div>

        {/* Accept button */}
        <button
          onClick={handleAccept}
          style={{
            width: '100%',
            background: '#F0A500',
            color: '#000000',
            border: 'none',
            borderRadius: '8px',
            padding: '14px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            letterSpacing: '0.02em',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.target.style.opacity = '0.9'}
          onMouseLeave={e => e.target.style.opacity = '1'}
        >
          I Understand — Continue to Meridian
        </button>

        {/* Sub note */}
        <p style={{
          fontSize: '10px', color: 'rgba(255,255,255,0.2)',
          textAlign: 'center', marginTop: '12px', marginBottom: '0',
        }}>
          This notice will not appear again on this device.
        </p>
      </div>
    </div>
  );
}

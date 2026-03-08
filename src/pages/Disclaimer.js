import { useNavigate } from 'react-router-dom';

const sectionHeaderStyle = {
  color: '#F0A500',
  textTransform: 'uppercase',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  marginBottom: '12px',
};

const bodyStyle = {
  color: 'rgba(255,255,255,0.7)',
  fontSize: '13px',
  lineHeight: '1.8',
  marginBottom: '0',
};

const sectionStyle = {
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  marginBottom: '32px',
  paddingBottom: '32px',
};

export default function Disclaimer() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0A0E1A',
      padding: '64px 32px',
    }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            color: '#F0A500',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '0',
            marginBottom: '32px',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.target.style.opacity = '0.8'}
          onMouseLeave={e => e.target.style.opacity = '1'}
        >
          ← Back to Meridian
        </button>

        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{
            display: 'inline-block',
            background: '#F0A500',
            color: '#000000',
            fontSize: '11px',
            fontWeight: '800',
            padding: '3px 8px',
            borderRadius: '4px',
            letterSpacing: '0.05em',
          }}>
            MERIDIAN
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#ffffff',
            marginTop: '12px',
            marginBottom: '4px',
          }}>
            Legal Disclaimer & Terms of Use
          </h1>
          <p style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.3)',
            margin: '4px 0 0',
          }}>
            Last updated: March 2026 · Reach Point Research, a division of Reach Point Capital LLC
          </p>
        </div>

        {/* Section 1 */}
        <div style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>No Investment Advice</h2>
          <p style={bodyStyle}>
            The information, data, tools, models, and analysis provided on Meridian (the "Platform") are
            for informational and educational purposes only. Nothing on this Platform constitutes or should
            be construed as investment advice, financial advice, trading advice, or any other type of advice.
            Reach Point Research is not a registered investment advisor, broker-dealer, or financial planner
            under any applicable law or regulation.
          </p>
          <p style={{ ...bodyStyle, marginTop: '14px' }}>
            You should not make any investment or financial decision based solely on information provided
            by this Platform. Always conduct independent research and consult with a qualified, licensed
            financial professional before making any investment decisions.
          </p>
        </div>

        {/* Section 2 */}
        <div style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Data Accuracy & Sources</h2>
          <p style={bodyStyle}>
            Market data displayed on Meridian is sourced from third-party providers including Yahoo Finance,
            the Federal Reserve Economic Data (FRED) system, the U.S. Securities and Exchange Commission
            (SEC) EDGAR database, and other public data sources. This data may be delayed, inaccurate,
            incomplete, or subject to change without notice.
          </p>
          <p style={{ ...bodyStyle, marginTop: '14px' }}>
            Reach Point Research makes no representations or warranties, express or implied, as to the
            accuracy, completeness, timeliness, or reliability of any data, information, or analysis
            displayed on the Platform. We expressly disclaim all warranties of any kind.
          </p>
        </div>

        {/* Section 3 */}
        <div style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Quantitative Models</h2>
          <p style={bodyStyle}>
            Valuation outputs including but not limited to the Reach Point Base Model, Discounted Cash
            Flow (DCF) analysis, Leveraged Buyout (LBO) modeling, comparable company analysis, and
            scenario analysis are generated using mathematical models and historical financial data.
          </p>
          <p style={{ ...bodyStyle, marginTop: '14px' }}>
            These outputs are quantitative estimates only and are subject to significant uncertainty.
            Model outputs are highly sensitive to input assumptions and may not reflect actual market
            conditions, company-specific factors, macroeconomic developments, or other material
            considerations. A change in any assumption can materially affect the output.
          </p>
          <p style={{ ...bodyStyle, marginTop: '14px' }}>
            No valuation output on this Platform should be interpreted as a prediction, forecast, or
            guarantee of future performance.
          </p>
        </div>

        {/* Section 4 */}
        <div style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>No Affiliation</h2>
          <p style={bodyStyle}>
            Meridian and Reach Point Research are independent entities and are not affiliated with,
            endorsed by, or in any way connected to any stock exchange, financial regulatory body,
            data exchange, or any company whose securities may be displayed on this Platform.
            All company names, ticker symbols, and logos are the property of their respective owners
            and are used for identification purposes only.
          </p>
        </div>

        {/* Section 5 */}
        <div style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Limitation of Liability</h2>
          <p style={bodyStyle}>
            To the fullest extent permitted by applicable law, Reach Point Research, Reach Point
            Capital LLC, and their respective officers, directors, employees, and agents shall not
            be liable for any direct, indirect, incidental, special, consequential, or punitive damages
            arising out of or in connection with your use of the Platform or reliance on any information
            or analysis provided herein, even if advised of the possibility of such damages.
          </p>
          <p style={{ ...bodyStyle, marginTop: '14px' }}>
            Your use of this Platform is at your sole risk.
          </p>
        </div>

        {/* Section 6 */}
        <div style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Third-Party Data Terms</h2>
          <p style={bodyStyle}>
            This Platform utilizes publicly available data from various third-party sources. Use of
            this Platform does not grant any rights to underlying data. Users are responsible for
            compliance with any applicable terms of service of third-party data providers.
          </p>
        </div>

        {/* Section 7 */}
        <div style={{ marginBottom: '0' }}>
          <h2 style={sectionHeaderStyle}>Changes to This Disclaimer</h2>
          <p style={bodyStyle}>
            Reach Point Research reserves the right to modify this disclaimer at any time.
            Continued use of the Platform following any modification constitutes acceptance of
            the updated terms.
          </p>
        </div>

        {/* Footer */}
        <p style={{
          color: 'rgba(255,255,255,0.2)',
          fontSize: '11px',
          textAlign: 'center',
          marginTop: '64px',
        }}>
          © 2026 Reach Point Research · A division of Reach Point Capital LLC ·
          For questions: info@reachpointcapital.com
        </p>
      </div>
    </div>
  );
}

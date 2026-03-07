import { usePro } from '../../context/ProContext';

export default function ProGate({ children, title }) {
  const { isPro, togglePro } = usePro();

  if (isPro) return children;

  return (
    <div style={styles.container}>
      <div style={styles.lockedContent}>
        <div style={styles.lockIcon}>&#128274;</div>
        {title && <h3 style={styles.title}>{title}</h3>}
        <p style={styles.upgradeText}>Upgrade to Pro</p>
        <button style={styles.button} onClick={togglePro}>
          Unlock Pro
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '160px',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    overflow: 'hidden',
  },
  lockedContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '32px 24px',
    textAlign: 'center',
  },
  lockIcon: {
    fontSize: '32px',
    filter: 'grayscale(0)',
    color: 'var(--gold)',
    marginBottom: '4px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  upgradeText: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  button: {
    marginTop: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#000',
    backgroundColor: 'var(--gold)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};

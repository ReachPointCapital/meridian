import React from 'react';
import { Info } from 'lucide-react';

export default function InfoTooltip({ text, size = 12 }) {
  return (
    <span className="tooltip-container" style={{ marginLeft: '4px', verticalAlign: 'middle' }}>
      <Info size={size} style={{ color: 'var(--text-tertiary)', cursor: 'help' }} />
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

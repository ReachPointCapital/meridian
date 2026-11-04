// Guards the modern look in src/modern.css ("Graphite & Champagne", Refined): every text and accent colour stays
// readable (WCAG AA, 4.5:1) on every surface it is drawn on, in both themes, and the look is actually switched on.
// Run with: npm run test:utils
import fs from 'fs';
import path from 'path';

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');
const css = read('src', 'modern.css');

// The `{ ... }` block that follows an exact selector.
function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

// Hex-valued custom properties; later selectors override earlier ones, as the cascade does.
function tokens(...selectors) {
  const out = {};
  for (const selector of selectors) {
    for (const m of block(selector).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  }
  return out;
}

const channel = (hex, i) => {
  const v = parseInt(hex.slice(i, i + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const themes = {
  dark: tokens(
    'html[data-look="modern"]:not([data-theme="light"])',
    'html[data-look="modern"][data-tier="refined"]:not([data-theme="light"])',
  ),
  light: tokens(
    'html[data-look="modern"][data-theme="light"]',
    'html[data-look="modern"][data-tier="refined"][data-theme="light"]',
  ),
};

describe.each(Object.entries(themes))('modern %s theme', (_name, t) => {
  const surfaces = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'card-top'];
  const readable = ['text-primary', 'text-secondary', 'text-tertiary', 'gold', 'accent', 'green', 'red'];

  test.each(readable.flatMap((fg) => surfaces.map((bg) => [fg, bg])))('%s is readable on %s', (fg, bg) => {
    expect(t[fg]).toBeDefined();
    expect(t[bg]).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  test('button text (bg-primary) is readable on the gold fill', () => {
    expect(contrast(t['bg-primary'], t.gold)).toBeGreaterThanOrEqual(4.5);
  });
});

test('the light theme defines every colour token the dark theme does', () => {
  const missing = Object.keys(themes.dark).filter((k) => !(k in themes.light));
  expect(missing).toEqual([]);
});

describe('the look is switched on', () => {
  test('the page opts in to the modern look and the Refined tier', () => {
    expect(read('public', 'index.html')).toMatch(/<html[^>]*data-look="modern"[^>]*data-tier="refined"/);
  });

  test('the stylesheet and the spotlight script are loaded', () => {
    expect(read('src', 'index.js')).toMatch(/import ['"]\.\/modern\.css['"]/);
    expect(read('public', 'index.html')).toMatch(/spotlight\.js/);
    expect(fs.existsSync(path.join(__dirname, '..', '..', 'public', 'spotlight.js'))).toBe(true);
  });
});

// Guards the theme in src/index.css: every text/accent color stays readable (WCAG AA, 4.5:1) on the surfaces it
// is drawn on, and the dark and light themes define the same tokens. Run with: npm run test:utils
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '..', 'index.css'), 'utf8');

// Collect the hex-valued custom properties declared in the first `{ ... }` after a selector.
function tokens(selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
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
  dark: tokens(':root,\n[data-theme="dark"]'),
  light: tokens('[data-theme="light"]'),
};

describe.each(Object.entries(themes))('%s theme', (_name, t) => {
  const surfaces = ['bg-primary', 'bg-secondary'];
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

test('light theme defines every token the dark theme does', () => {
  const missing = Object.keys(themes.dark).filter((k) => !(k in themes.light));
  expect(missing).toEqual([]);
});

import fs from 'fs';
import path from 'path';

// jsdom cannot lay a page out, so this pins the style that keeps the Models search row inside a phone screen. The measured
// proof is in the pull request: at 375px wide the page was 16px wider than the screen because the search input (flex: 1)
// could not shrink below its own intrinsic width, which pushed the "Search" button past the edge.
const source = fs.readFileSync(path.join(__dirname, 'Models.js'), 'utf8');

function searchInputStyle() {
  const start = source.indexOf('function ModelsEmptyState');
  const input = source.indexOf('<input', start);
  return source.slice(input, source.indexOf('/>', input));
}

describe('Models search row', () => {
  test('the search input can shrink below its intrinsic width (min-width: 0), so the button is never pushed off a phone screen', () => {
    expect(searchInputStyle()).toMatch(/minWidth:\s*0/);
  });

  test('the input still takes the free space beside the button', () => {
    expect(searchInputStyle()).toMatch(/flex:\s*1/);
  });
});

// At 320px wide the model tiles ("DCF Model", "LBO Model", ...) were still 24px past the screen: a bare repeat(3, 1fr)
// track cannot go narrower than its text, so three columns needed about 380px. The grid now keeps three columns on a
// tablet or desktop and drops to two (or one) on a narrow phone.
describe('Models tile grid', () => {
  // Comments are stripped so the code can still explain what it replaced.
  const tileSource = () => source
    .slice(source.indexOf('function ModelsEmptyState'), source.indexOf('// ── DCF Model ──'))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*$/gm, '');

  test('is not a bare repeat(3, 1fr), which cannot shrink below its text', () => {
    expect(tileSource()).not.toMatch(/repeat\(3,\s*1fr\)/);
  });

  test('wraps its columns to the space it has (auto-fit with a minimum column width)', () => {
    expect(tileSource()).toMatch(/repeat\(auto-fit,\s*minmax\(/);
  });
});

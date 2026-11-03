const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractArticle } = require('../api/_article');

const page = `<!doctype html><html><head>
<title>Fed holds rates | Example News</title>
<meta name="description" content="The Fed left rates unchanged.">
<meta property="og:image" content="https://example.com/fed.png">
<script>window.track('x')</script><style>.a{color:red}</style></head>
<body><nav>Home Markets</nav><header>Logo</header>
<article><h1>Fed holds rates</h1><p>Policymakers voted &amp; agreed.</p><p>It was &quot;unanimous&quot;.</p></article>
<aside>Related stories</aside><footer>Copyright</footer></body></html>`;

test('extractArticle pulls the title, description, image and the article text', () => {
  const a = extractArticle(page, 'https://example.com/fed');
  assert.equal(a.title, 'Fed holds rates');
  assert.equal(a.description, 'The Fed left rates unchanged.');
  assert.equal(a.image, 'https://example.com/fed.png');
  assert.equal(a.url, 'https://example.com/fed');
  assert.equal(a.text, 'Fed holds rates Policymakers voted & agreed. It was "unanimous".');
});

test('scripts, styles, navigation and footers never leak into the text', () => {
  const a = extractArticle(page, 'https://example.com/fed');
  for (const junk of ['track', 'color:red', 'Home Markets', 'Logo', 'Related stories', 'Copyright']) {
    assert.ok(!a.text.includes(junk), junk);
  }
});

test('with no <article> it falls back to <main>, then to the whole page', () => {
  assert.equal(extractArticle('<main><p>From main</p></main>', 'u').text, 'From main');
  assert.equal(extractArticle('<div>Plain body</div>', 'u').text, 'Plain body');
});

test('the text is capped at 5000 characters and a bare page yields empty fields, not errors', () => {
  assert.equal(extractArticle(`<article>${'x '.repeat(5000)}</article>`, 'u').text.length, 5000);
  assert.deepEqual(extractArticle('', 'u'), { title: '', description: '', text: '', image: null, url: 'u' });
});

test('an image URL that is not http(s) is dropped', () => {
  const html = '<meta property="og:image" content="javascript:alert(1)"><article>x</article>';
  assert.equal(extractArticle(html, 'u').image, null);
});

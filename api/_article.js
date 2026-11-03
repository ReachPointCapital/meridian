// Turns a news page into the title, summary and plain text the article reader shows (see test/article.test.js).
const MAX_TEXT = 5000;

const STRIP = ['script', 'style', 'nav', 'footer', 'header', 'aside'];

function stripBlocks(html) {
  return STRIP.reduce((out, tag) => out.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), ''), html);
}

// &amp; goes last so "&amp;lt;" stays the literal text "&lt;" instead of becoming "<".
function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

const toText = (html) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function extractArticle(html, url) {
  const source = typeof html === 'string' ? html : '';
  const clean = stripBlocks(source);

  const title = (clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const description = (clean.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || [])[1];
  const body = (clean.match(/<article[^>]*>([\s\S]*?)<\/article>/i) || clean.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || [])[1];
  const image = (source.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || [])[1];

  return {
    title: title ? decodeEntities(title.replace(/\s*\|.*$/, '')).trim() : '',
    description: description ? decodeEntities(description) : '',
    text: toText(body || clean).substring(0, MAX_TEXT),
    image: image && /^https?:\/\//i.test(image) ? image : null,
    url,
  };
}

module.exports = { extractArticle };

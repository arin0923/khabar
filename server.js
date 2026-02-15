const express = require('express');
const fetch   = require('node-fetch');
const xml2js  = require('xml2js');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ── Sources ────────────────────────────────────────────────────
const SOURCES = [
  {
    name: 'The Kathmandu Post',
    key:  'ktmpost',
    url:  'https://kathmandupost.com/rss',
    googleQuery: 'Nepal news kathmandu post',
    emoji: '📰',
  },
  {
    name: 'OnlineKhabar',
    key:  'onlinekhabar',
    url:  'https://english.onlinekhabar.com/feed',
    googleQuery: 'Nepal news onlinekhabar english',
    emoji: '🗞️',
  },
  {
    name: 'Setopati',
    key:  'setopati',
    url:  'https://setopati.com/feed',
    googleQuery: 'Nepal news setopati',
    emoji: '📋',
  },
  {
    name: 'Ratopati',
    key:  'ratopati',
    url:  'https://ratopati.com/feed',
    googleQuery: 'Nepal news ratopati',
    emoji: '📌',
  },
  {
    name: 'BBC Nepal',
    key:  'bbcnepali',
    url:  'https://feeds.bbci.co.uk/nepali/rss.xml',
    googleQuery: 'Nepal news BBC',
    emoji: '🌐',
  },
];

// ── Google News RSS URL ────────────────────────────────────────
function googleNewsRssUrl(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-NP&gl=NP&ceid=NP:en`;
}

// ── Category Keywords ──────────────────────────────────────────
const CAT_KEYWORDS = {
  politics:      ['minister','government','parliament','party','election','pm','president','political','nepal','police','court','cabinet','vote','law','constitution'],
  business:      ['economy','trade','bank','market','investment','finance','gdp','revenue','budget','tax','rupee','billion','million','company','stock'],
  sports:        ['cricket','football','match','player','team','cup','league','goal','score','win','tournament','championship','athlete','olympics'],
  technology:    ['tech','digital','internet','app','software','cyber','ai','startup','innovation','data','computer','mobile','telecom'],
  health:        ['health','hospital','covid','virus','vaccine','disease','doctor','medicine','mental','cancer','pandemic','surgery','treatment'],
  world:         ['international','global','india','china','usa','united nations','foreign','world','war','climate','summit','nato'],
  entertainment: ['film','movie','music','celebrity','culture','festival','artist','concert','award','dance','theatre','television'],
};

function guessCategory(title = '', desc = '') {
  const text = (title + ' ' + desc).toLowerCase();
  for (const [cat, kws] of Object.entries(CAT_KEYWORDS)) {
    if (kws.some(k => text.includes(k))) return cat;
  }
  return 'general';
}

// ── Fetch with proper timeout via AbortController ──────────────
// node-fetch@2 ignores the `timeout` option — must use AbortController
async function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept':          'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control':   'no-cache',
      },
      follow: 5,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const text = await res.text();
    if (!text || text.trim().length < 50) throw new Error('Empty response body');
    return text;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Timed out after ' + ms + 'ms');
    throw err;
  }
}

// ── Extract image from RSS item ────────────────────────────────
function extractImage(item) {
  if (item.enclosure?.[0]?.$?.url)          return item.enclosure[0].$.url;
  if (item['media:content']?.[0]?.$?.url)   return item['media:content'][0].$.url;
  if (item['media:thumbnail']?.[0]?.$?.url) return item['media:thumbnail'][0].$.url;
  const desc = String(item.description?.[0] || '');
  const m1 = desc.match(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/i);
  if (m1) return m1[1];
  const m2 = desc.match(/<img[^>]+src=["']([^"']+)/i);
  if (m2) return m2[1];
  return null;
}

// ── Parse RSS / Atom XML ───────────────────────────────────────
async function parseRSS(xml, source, isGoogleNews = false) {
  const parser = new xml2js.Parser({ explicitArray: true, ignoreAttrs: false });
  let result;
  try {
    result = await parser.parseStringPromise(xml);
  } catch (e) {
    throw new Error(`XML parse error: ${e.message}`);
  }

  const items = result?.rss?.channel?.[0]?.item || result?.feed?.entry || [];
  if (items.length === 0) throw new Error('Feed has 0 items');

  return items.map(item => {
    const title   = String(item.title?.[0]?._ || item.title?.[0] || '').trim();
    const link    = String(item.link?.[0]?._ || item.link?.[0]?.$?.href || item.link?.[0] || '').trim();
    const rawDesc = item.description?.[0] || item.summary?.[0]?._ || item.summary?.[0] || '';
    const desc    = String(rawDesc).replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim().slice(0, 220);
    const pubDate = item.pubDate?.[0] || item.updated?.[0] || item.published?.[0] || '';
    const image   = extractImage(item);

    // Google News puts the real publisher in <source>
    let sourceName = source.name;
    if (isGoogleNews && item.source?.[0]) {
      const s = item.source[0];
      sourceName = (typeof s === 'string' ? s : s._ || s) || source.name;
    }

    return {
      id:        Buffer.from(link || title).toString('base64').slice(0, 16),
      title,
      link,
      excerpt:   desc,
      date:      pubDate,
      image,
      source:    sourceName,
      sourceKey: source.key,
      emoji:     source.emoji,
      category:  guessCategory(title, desc),
      viaGoogle: isGoogleNews,
    };
  }).filter(a => a.title && a.link);
}

// ── Fetch one source: primary RSS → Google News fallback ───────
async function fetchSource(source) {
  const log = { source: source.name, method: null, count: 0, error: null };

  // 1️⃣ Try primary RSS
  try {
    console.log(`  ▶ [${source.name}] Primary RSS…`);
    const xml      = await fetchWithTimeout(source.url);
    const articles = await parseRSS(xml, source, false);
    log.method = 'rss';
    log.count  = articles.length;
    console.log(`  ✓ [${source.name}] RSS OK — ${articles.length} articles`);
    return { articles, log };
  } catch (err) {
    console.warn(`  ✗ [${source.name}] RSS failed: ${err.message}`);
    log.error = `RSS: ${err.message}`;
  }

  // 2️⃣ Google News fallback
  try {
    const gnUrl = googleNewsRssUrl(source.googleQuery);
    console.log(`  ▶ [${source.name}] Google News fallback…`);
    const xml      = await fetchWithTimeout(gnUrl);
    const articles = await parseRSS(xml, source, true);
    log.method = 'google';
    log.count  = articles.length;
    log.error  = null;
    console.log(`  ✓ [${source.name}] Google News — ${articles.length} articles`);
    return { articles, log };
  } catch (err) {
    console.error(`  ✗ [${source.name}] Google News failed: ${err.message}`);
    log.error += ` | Google: ${err.message}`;
  }

  log.method = 'failed';
  return { articles: [], log };
}

// ── Cache ──────────────────────────────────────────────────────
let cache = {
  articles:    [],
  lastUpdated: null,
  fetchingNow: false,
  fetchLog:    [],
};

async function refreshCache() {
  if (cache.fetchingNow) { console.log('Already refreshing, skipping.'); return; }
  cache.fetchingNow = true;
  const t0 = Date.now();
  console.log('\n🔄 Refreshing news cache…');

  const results = await Promise.allSettled(SOURCES.map(fetchSource));

  let allArticles = [];
  const fetchLog  = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      allArticles = allArticles.concat(r.value.articles);
      fetchLog.push(r.value.log);
    } else {
      console.error('Unexpected rejection:', r.reason);
    }
  }

  // Last-resort: general Nepal news Google feed if everything failed
  if (allArticles.length === 0) {
    console.warn('\n⚠️  All sources failed. Trying general Nepal news…');
    try {
      const xml      = await fetchWithTimeout(googleNewsRssUrl('Nepal latest news'));
      const articles = await parseRSS(xml, { name: 'Google News', key: 'google', emoji: '🌐' }, true);
      allArticles    = articles;
      fetchLog.push({ source: 'Google News (general)', method: 'google', count: articles.length, error: null });
      console.log(`  ✓ General Nepal feed — ${articles.length} articles`);
    } catch (err) {
      console.error(`  ✗ General Nepal feed failed: ${err.message}`);
    }
  }

  // Sort & deduplicate
  allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
  const seen    = new Set();
  const deduped = allArticles.filter(a => {
    const k = a.title.toLowerCase().slice(0, 55);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  cache.articles    = deduped;
  cache.lastUpdated = new Date().toISOString();
  cache.fetchLog    = fetchLog;
  cache.fetchingNow = false;

  console.log(`\n✅ Done in ${((Date.now()-t0)/1000).toFixed(1)}s — ${deduped.length} unique articles`);
  fetchLog.forEach(l => {
    const icon = l.method === 'failed' ? '✗' : '✓';
    console.log(`   ${icon} ${l.source}: ${l.method} (${l.count})${l.error ? '  ← ' + l.error : ''}`);
  });
  console.log('');
}

// ── Routes ─────────────────────────────────────────────────────

app.get('/api/news', (req, res) => {
  const { category, source, limit = 60 } = req.query;
  let articles = [...cache.articles];
  if (category && category !== 'all') articles = articles.filter(a => a.category === category);
  if (source   && source   !== 'all') articles = articles.filter(a => a.sourceKey === source);
  res.json({
    articles:    articles.slice(0, parseInt(limit)),
    total:       articles.length,
    lastUpdated: cache.lastUpdated,
    fetching:    cache.fetchingNow,
  });
});

// Open http://localhost:3000/api/debug to see exactly what happened
app.get('/api/debug', (req, res) => {
  res.json({
    totalArticles: cache.articles.length,
    lastUpdated:   cache.lastUpdated,
    fetchingNow:   cache.fetchingNow,
    sources:       cache.fetchLog,
    sample:        cache.articles.slice(0, 3).map(a => ({
      title:  a.title,
      source: a.source,
      link:   a.link,
    })),
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status:      cache.articles.length > 0 ? 'ok' : 'empty',
    articles:    cache.articles.length,
    lastUpdated: cache.lastUpdated,
    fetching:    cache.fetchingNow,
    sources:     cache.fetchLog,
  });
});

app.post('/api/refresh', (req, res) => {
  res.json({ message: 'Triggered. See terminal for progress, then visit /api/debug' });
  refreshCache();
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🇳🇵  Khabar — Nepal News Aggregator`);
  console.log(`🌐  Open: http://localhost:${PORT}`);
  console.log(`🔍  Debug: http://localhost:${PORT}/api/debug\n`);
  await refreshCache();
});

cron.schedule('*/10 * * * *', () => {
  console.log('⏰ Auto-refresh triggered');
  refreshCache();
});

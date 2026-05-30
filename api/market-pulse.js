export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    // v8エンドポイントを使用
    const url = 'https://query2.finance.yahoo.com/v8/finance/chart/%5EN225?interval=1d&range=1d';
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Referer': 'https://finance.yahoo.com',
      }
    });
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta) {
      res.status(200).json({ results: [], debug: 'no meta' });
      return;
    }

    // 各シンボルを個別取得
    const symbols = ['%5EN225', '%5ETOPIX', 'USDJPY%3DX', '%5EVIX'];
    const results = [];

    for (const sym of symbols) {
      try {
        const r2 = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://finance.yahoo.com',
          }
        });
        const d2 = await r2.json();
        const m = d2?.chart?.result?.[0]?.meta;
        if (m) {
          results.push({
            symbol: m.symbol,
            regularMarketPrice: m.regularMarketPrice,
            regularMarketChangePercent: ((m.regularMarketPrice - m.previousClose) / m.previousClose) * 100,
            regularMarketChange: m.regularMarketPrice - m.previousClose,
          });
        }
      } catch(e2) {}
    }

    res.status(200).json({ results });
  } catch(e) {
    res.status(500).json({ error: e.message, results: [] });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // TOPIXはETF(1306.T)で代替
  const symbols = ['%5EN225', '1306.T', 'USDJPY%3DX', '%5EVIX'];

  try {
    const results = [];

    for (const sym of symbols) {
      try {
        const r = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2d`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://finance.yahoo.com',
          }
        });
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta) {
          const price = meta.regularMarketPrice;
          const prev  = meta.previousClose || meta.chartPreviousClose;
          const change     = prev ? price - prev : null;
          const changePct  = prev ? ((price - prev) / prev) * 100 : null;

          // シンボル名を統一
          let symbol = meta.symbol;
          if (symbol === '1306.T') symbol = '^TOPIX';

          results.push({
            symbol,
            regularMarketPrice: price,
            regularMarketChangePercent: changePct ? +changePct.toFixed(2) : null,
            regularMarketChange: change ? +change.toFixed(2) : null,
          });
        }
      } catch(e2) {}
    }

    res.status(200).json({ results });
  } catch(e) {
    res.status(500).json({ error: e.message, results: [] });
  }
}

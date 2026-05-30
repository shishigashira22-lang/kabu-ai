export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const ticker = code.includes('.') ? code : code + '.T';

  try {
    // v8 APIで基本データ取得
    const response = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'ja,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) throw new Error(`Yahoo Finance error: ${response.status}`);

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return res.status(404).json({ error: 'Stock not found' });

    let detailInfo = {};

    // v7 APIで詳細情報取得
    try {
      const r2 = await fetch(
        `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Referer': 'https://finance.yahoo.com/',
          },
          signal: AbortSignal.timeout(8000)
        }
      );
      if (r2.ok) {
        const d2 = await r2.json();
        const q = d2?.quoteResponse?.result?.[0];
        if (q) {
          detailInfo = {
            per: q.trailingPE ? +q.trailingPE.toFixed(1) : null,
            pbr: q.priceToBook ? +q.priceToBook.toFixed(1) : null,
            div: q.trailingAnnualDividendYield ? +(q.trailingAnnualDividendYield * 100).toFixed(1) : null,
            cap: q.marketCap || null,
            sector: q.sector || null,
            high52: q.fiftyTwoWeekHigh || null,
            chg: q.regularMarketChangePercent ? +q.regularMarketChangePercent.toFixed(2) : 0,
          };
        }
      }
    } catch(e) {}

    // Yahoo Finance Japan APIで日本語名を取得
    let japaneseName = null;
    try {
      const r3 = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&lang=ja&region=JP&quotesCount=1`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Referer': 'https://finance.yahoo.co.jp/',
          },
          signal: AbortSignal.timeout(5000)
        }
      );
      if (r3.ok) {
        const d3 = await r3.json();
        const quote = d3?.quotes?.[0];
        if (quote?.shortname) japaneseName = quote.shortname;
        else if (quote?.longname) japaneseName = quote.longname;
      }
    } catch(e) {}

    res.status(200).json({
      name: japaneseName || meta.shortName || meta.symbol,
      price: meta.regularMarketPrice || meta.chartPreviousClose || 0,
      per: detailInfo.per ?? null,
      pbr: detailInfo.pbr ?? null,
      div: detailInfo.div ?? null,
      cap: detailInfo.cap ?? null,
      sector: detailInfo.sector ?? null,
      high52: detailInfo.high52 ?? meta.fiftyTwoWeekHigh ?? null,
      chg: detailInfo.chg ?? 0,
      isReal: true,
    });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

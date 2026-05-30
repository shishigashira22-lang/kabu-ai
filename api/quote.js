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
    // まずv8 APIを試す
    const response = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://finance.yahoo.com/',
          'Origin': 'https://finance.yahoo.com',
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) throw new Error(`Yahoo Finance error: ${response.status}`);

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta) return res.status(404).json({ error: 'Stock not found' });

    // v7 APIも試して詳細情報を取得
    let detailInfo = {};
    try {
      const res2 = await fetch(
        `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'https://finance.yahoo.com/',
          },
          signal: AbortSignal.timeout(8000)
        }
      );
      if (res2.ok) {
        const d2 = await res2.json();
        const q = d2?.quoteResponse?.result?.[0];
        if (q) {
          detailInfo = {
            name: q.longName || q.shortName || meta.shortName,
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

    res.status(200).json({
      name: detailInfo.name || meta.shortName || meta.symbol,
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

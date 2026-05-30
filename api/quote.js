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
    const response = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}&lang=en-US`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) throw new Error(`Yahoo Finance error: ${response.status}`);

    const data = await response.json();
    const q = data?.quoteResponse?.result?.[0];

    if (!q) return res.status(404).json({ error: 'Stock not found' });

    res.status(200).json({
      name: q.longName || q.shortName || code,
      price: q.regularMarketPrice || 0,
      per: q.trailingPE ? +q.trailingPE.toFixed(1) : null,
      pbr: q.priceToBook ? +q.priceToBook.toFixed(1) : null,
      div: q.trailingAnnualDividendYield ? +(q.trailingAnnualDividendYield * 100).toFixed(1) : null,
      cap: q.marketCap || null,
      sector: q.sector || null,
      high52: q.fiftyTwoWeekHigh || null,
      low52: q.fiftyTwoWeekLow || null,
      chg: q.regularMarketChangePercent ? +q.regularMarketChangePercent.toFixed(2) : 0,
      isReal: true,
    });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

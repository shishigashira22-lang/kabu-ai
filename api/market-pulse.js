export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const symbols = ['%5EN225', '%5ETOPIX', 'USDJPY%3DX', '%5EVIX'];

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketChange`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      }
    });
    const data = await r.json();
    const results = data?.quoteResponse?.result || [];
    res.status(200).json({ results });
  } catch(e) {
    res.status(500).json({ error: e.message, results: [] });
  }
}

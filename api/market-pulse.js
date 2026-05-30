export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const symbols = ['^N225', '^TOPIX', 'USDJPY=X', '^VIX'];

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketChange`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    const data = await r.json();
    const results = data?.quoteResponse?.result || [];
    res.status(200).json({ results });
  } catch(e) {
    res.status(500).json({ error: e.message, results: [] });
  }
}

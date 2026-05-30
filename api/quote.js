// J-Quants APIを使った銘柄情報取得
// IDトークンをキャッシュ（Vercelのメモリ内）
let cachedIdToken = null;
let cachedIdTokenExpiry = 0;

async function getIdToken() {
  // キャッシュが有効なら使い回す（23時間）
  if (cachedIdToken && Date.now() < cachedIdTokenExpiry) {
    return cachedIdToken;
  }

  const res = await fetch('https://api.jquants.com/v1/token/auth_refresh?refreshtoken=' + process.env.JPKEY, {
    method: 'POST',
  });
  const data = await res.json();
  if (!data.idToken) throw new Error('IDトークン取得失敗');

  cachedIdToken = data.idToken;
  cachedIdTokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedIdToken;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const pureCode = code.replace('.T', '');
  const ticker = code.includes('.') ? code : code + '.T';

  try {
    // 1. IDトークン取得
    const idToken = await getIdToken();

    // 2. J-Quants APIで銘柄情報取得
    const infoRes = await fetch(`https://api.jquants.com/v1/listed/info?code=${pureCode}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    const infoData = await infoRes.json();
    const stockInfo = infoData.info?.[0];

    // 3. Yahoo Financeで株価・財務データ取得
    let priceData = {};
    try {
      const yRes = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://finance.yahoo.com/',
        }
      });
      const yData = await yRes.json();
      const meta = yData?.chart?.result?.[0]?.meta;
      if (meta) {
        priceData.price = meta.regularMarketPrice;
        priceData.high52 = meta.fiftyTwoWeekHigh;
        const prev = meta.previousClose || meta.chartPreviousClose;
        priceData.chg = prev ? +((( meta.regularMarketPrice - prev) / prev) * 100).toFixed(2) : 0;
      }
    } catch(e) {}

    // 4. Yahoo Finance v7で財務データ取得
    let finData = {};
    try {
      const fRes = await fetch(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://finance.yahoo.com/',
        }
      });
      const fData = await fRes.json();
      const q = fData?.quoteResponse?.result?.[0];
      if (q) {
        finData = {
          per: q.trailingPE ? +q.trailingPE.toFixed(1) : null,
          pbr: q.priceToBook ? +q.priceToBook.toFixed(1) : null,
          div: q.trailingAnnualDividendYield ? +(q.trailingAnnualDividendYield * 100).toFixed(1) : null,
          cap: q.marketCap || null,
          sector: q.sector || null,
          high52: q.fiftyTwoWeekHigh || priceData.high52 || null,
        };
      }
    } catch(e) {}

    res.status(200).json({
      name: stockInfo?.CompanyName || stockInfo?.CompanyNameEnglish || `銘柄${pureCode}`,
      price: priceData.price || null,
      per: finData.per ?? null,
      pbr: finData.pbr ?? null,
      div: finData.div ?? null,
      cap: finData.cap ?? null,
      sector: stockInfo?.Sector17CodeName || finData.sector || null,
      high52: finData.high52 ?? null,
      chg: priceData.chg ?? 0,
      isReal: true,
    });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

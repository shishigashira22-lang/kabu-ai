const WATCH_LIST = [
  {code:'7203', name:'トヨタ自動車', sector:'自動車'},
  {code:'6758', name:'ソニーグループ', sector:'電機'},
  {code:'9984', name:'ソフトバンクG', sector:'通信'},
  {code:'6723', name:'ルネサス', sector:'半導体'},
  {code:'4063', name:'信越化学', sector:'化学'},
  {code:'8306', name:'三菱UFJ FG', sector:'銀行'},
  {code:'9432', name:'NTT', sector:'通信'},
  {code:'6861', name:'キーエンス', sector:'電機'},
  {code:'9433', name:'KDDI', sector:'通信'},
  {code:'7974', name:'任天堂', sector:'娯楽'},
  {code:'6367', name:'ダイキン工業', sector:'機械'},
  {code:'4519', name:'中外製薬', sector:'医薬'},
  {code:'6954', name:'ファナック', sector:'機械'},
  {code:'8035', name:'東京エレクトロン', sector:'半導体'},
  {code:'4502', name:'武田薬品', sector:'医薬'},
  {code:'7267', name:'本田技研', sector:'自動車'},
  {code:'6501', name:'日立製作所', sector:'電機'},
  {code:'3382', name:'セブン&アイ', sector:'小売'},
  {code:'2914', name:'JT', sector:'食品'},
  {code:'9020', name:'JR東日本', sector:'鉄道'},
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'FMP API key not set', stocks: [] });

  try {
    // FMPで複数銘柄を一括取得
    const symbols = WATCH_LIST.map(s => `${s.code}.T`).join(',');
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/quote/${symbols}?apikey=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) throw new Error(`FMP error: ${response.status}`);

    const data = await response.json();

    const results = (Array.isArray(data) ? data : []).map(q => {
      const code = q.symbol.replace('.T', '');
      const info = WATCH_LIST.find(s => s.code === code) || {};
      return {
        code,
        name: info.name || q.name || code,
        sector: info.sector || '-',
        price: q.price || 0,
        chg: q.changesPercentage ? +q.changesPercentage.toFixed(2) : 0,
      };
    }).filter(s => s.price > 0);

    res.status(200).json({ stocks: results, updatedAt: new Date().toISOString() });

  } catch(e) {
    res.status(500).json({ error: e.message, stocks: [] });
  }
}

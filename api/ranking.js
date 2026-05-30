const STOCK_INFO = {
  '7203': {name:'トヨタ自動車', sector:'自動車'},
  '6758': {name:'ソニーグループ', sector:'電機'},
  '9984': {name:'ソフトバンクG', sector:'通信'},
  '6723': {name:'ルネサス', sector:'半導体'},
  '4063': {name:'信越化学', sector:'化学'},
  '8306': {name:'三菱UFJ FG', sector:'銀行'},
  '9432': {name:'NTT', sector:'通信'},
  '6861': {name:'キーエンス', sector:'電機'},
  '9433': {name:'KDDI', sector:'通信'},
  '7974': {name:'任天堂', sector:'娯楽'},
  '6367': {name:'ダイキン工業', sector:'機械'},
  '4519': {name:'中外製薬', sector:'医薬'},
  '6954': {name:'ファナック', sector:'機械'},
  '8035': {name:'東京エレクトロン', sector:'半導体'},
  '4502': {name:'武田薬品', sector:'医薬'},
  '7267': {name:'本田技研', sector:'自動車'},
  '6501': {name:'日立製作所', sector:'電機'},
  '3382': {name:'セブン&アイ', sector:'小売'},
  '2914': {name:'JT', sector:'食品'},
  '9020': {name:'JR東日本', sector:'鉄道'},
  '1114': {name:'銘柄1114', sector:'その他'},
  '6203': {name:'銘柄6203', sector:'その他'},
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const codes = Object.keys(STOCK_INFO);
    const counts = {};

    await Promise.all(codes.map(async code => {
      try {
        const r = await fetch(
          `${process.env.KV_REST_API_URL}/get/analyze_count_${code}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
          }
        );
        const data = await r.json();
        counts[code] = data.result ? parseInt(data.result) : 0;
      } catch(e) {
        counts[code] = 0;
      }
    }));

    // 1回以上のものだけ、カウント順に並び替えてTOP5
    const ranking = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count], i) => ({
        rank: i + 1,
        code,
        name: STOCK_INFO[code]?.name || `銘柄${code}`,
        sector: STOCK_INFO[code]?.sector || '-',
        count,
      }));

    res.status(200).json({ ranking });
  } catch(e) {
    res.status(500).json({ error: e.message, ranking: [] });
  }
}

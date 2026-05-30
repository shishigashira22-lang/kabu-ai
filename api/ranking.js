// IDトークンキャッシュ
let cachedIdToken = null;
let cachedIdTokenExpiry = 0;

async function getIdToken() {
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

async function getStockName(code) {
  try {
    const idToken = await getIdToken();
    const res = await fetch(`https://api.jquants.com/v1/listed/info?code=${code}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    const data = await res.json();
    return data.info?.[0]?.CompanyName || `銘柄${code}`;
  } catch(e) {
    return `銘柄${code}`;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const baseUrl = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    // SCANで analyze_count_* のキーを全取得
    let cursor = 0;
    let allKeys = [];

    do {
      const r = await fetch(`${baseUrl}/scan/${cursor}?match=analyze_count_*&count=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      cursor = parseInt(data.result[0]);
      allKeys = allKeys.concat(data.result[1]);
    } while (cursor !== 0);

    if (allKeys.length === 0) {
      return res.status(200).json({ ranking: [] });
    }

    // 各キーのカウントを取得
    const counts = {};
    await Promise.all(allKeys.map(async key => {
      try {
        const code = key.replace('analyze_count_', '');
        const r = await fetch(`${baseUrl}/get/${key}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await r.json();
        counts[code] = data.result ? parseInt(data.result) : 0;
      } catch(e) {}
    }));

    // カウント順に並び替えてTOP5
    const top5 = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // J-Quantsから銘柄名を取得
    const ranking = await Promise.all(top5.map(async ([code, count], i) => {
      const name = await getStockName(code);
      return {
        rank: i + 1,
        code,
        name,
        sector: '-',
        count,
      };
    }));

    res.status(200).json({ ranking });
  } catch(e) {
    res.status(500).json({ error: e.message, ranking: [] });
  }
}

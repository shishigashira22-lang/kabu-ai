export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    // 現在のカウントを取得
    const getRes = await fetch(
      `${process.env.KV_REST_API_URL}/get/analyze_count_${code}`,
      { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } }
    );
    const getData = await getRes.json();
    const current = getData.result ? parseInt(getData.result) : 0;

    // カウントを+1して保存
    await fetch(`${process.env.KV_REST_API_URL}/set/analyze_count_${code}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: String(current + 1) })
    });

    res.status(200).json({ success: true, count: current + 1 });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

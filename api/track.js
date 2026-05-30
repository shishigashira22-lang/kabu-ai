export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const incrRes = await fetch(
      `${process.env.KV_REST_API_URL}/incr/analyze_count_${code}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
      }
    );
    const incrData = await incrRes.json();
    res.status(200).json({ success: true, count: incrData.result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

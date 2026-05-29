export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 環境変数から取得（ユーザーには見えない）
  const token = process.env.LINE_CHANNEL_TOKEN;
  const userId = process.env.LINE_USER_ID;
  const { message } = req.body;

  if (!token || !userId || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: message }]
      })
    });

    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      const error = await response.text();
      return res.status(400).json({ error });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

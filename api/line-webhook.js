export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const events = req.body?.events || [];

  for (const event of events) {
    // ユーザーがメッセージを送ってきた時
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const text = event.message.text.trim();

      // KVにユーザーIDを保存（テキストをキーに）
      await fetch(`${process.env.KV_REST_API_URL}/set/line_user_${userId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: userId })
      });

      // 最新ユーザーIDも保存（決済時に使う）
      await fetch(`${process.env.KV_REST_API_URL}/set/latest_line_user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: userId })
      });

      // 返信メッセージ
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_TOKEN}`
        },
        body: JSON.stringify({
          replyToken: event.replyToken,
          messages: [{
            type: 'text',
            text: `✅ 登録完了！\nかぶAIへようこそ！\n\n分析レポートの購入後、このLINEに結果が届きます📊\n\nhttps://kabu-ai-steel.vercel.app`
          }]
        })
      });
    }
  }

  res.status(200).json({ status: 'ok' });
}

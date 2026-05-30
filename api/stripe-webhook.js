import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e) {
    return res.status(400).json({ error: `Webhook error: ${e.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { stockCode, stockName, plan } = session.metadata;

    // LINEに送信
    const message = `✅ 決済完了！
━━━━━━━━━━━━
🏢 ${stockName}（#${stockCode}）
📊 プラン：${plan}
━━━━━━━━━━━━
分析レポートをお届けします！
かぶAI: https://kabu-ai-steel.vercel.app`;

    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_TOKEN}`
      },
      body: JSON.stringify({
        to: process.env.LINE_USER_ID,
        messages: [{ type: 'text', text: message }]
      })
    });
  }

  res.status(200).json({ received: true });
}

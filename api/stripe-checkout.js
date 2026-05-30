import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { amount, stockCode, stockName, plan, comment, score, per, pbr, div, cap, highRatio } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: `かぶAI ${plan}（${stockName} #${stockCode}）`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL || 'https://kabu-ai-steel.vercel.app'}/?success=1&code=${stockCode}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL || 'https://kabu-ai-steel.vercel.app'}/`,
      metadata: {
        stockCode,
        stockName,
        plan,
        comment: (comment || '').slice(0, 500),
        score: String(score || ''),
        per: String(per || ''),
        pbr: String(pbr || ''),
        div: String(div || ''),
        cap: cap || '',
        highRatio: String(highRatio || ''),
      }
    }, {
      idempotencyKey: `${stockCode}-${Date.now()}`
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

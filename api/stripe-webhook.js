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

// KVからユーザーIDを取得
async function getLineUserId(sessionId) {
  // セッションIDに紐付いたユーザーIDを取得
  try {
    const res = await fetch(`${process.env.KV_REST_API_URL}/get/session_${sessionId}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
    });
    const data = await res.json();
    if (data.result) return data.result;
  } catch(e) {}

  // なければ最新ユーザーIDを取得
  try {
    const res = await fetch(`${process.env.KV_REST_API_URL}/get/latest_line_user`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
    });
    const data = await res.json();
    if (data.result) return data.result;
  } catch(e) {}

  // 最終手段：環境変数のユーザーID
  return process.env.LINE_USER_ID;
}

async function generateDetailedAnalysis(stockName, stockCode, per, pbr, div, cap, highRatio, score, baseComment) {
  const prompt = `あなたは日本株の財務データアナリストです。以下のデータを元に、投資家向けの詳細な財務分析レポートを日本語で作成してください。

銘柄: ${stockName}（${stockCode}）
AIスコア: ${score}点
PER: ${per}倍 / PBR: ${pbr}倍 / 配当利回り: ${div}% / 時価総額: ${cap} / 52週高値比: ${highRatio}%

以下の4項目を必ず含めてください：
①【バリュエーション評価】PER・PBRから見た割安・割高の判断
②【配当・インカム評価】配当利回りの魅力度
③【モメンタム評価】52週高値比から見た株価位置
④【総合所見】投資家へのデータ的観点からの総括（200文字程度）

※投資推奨は含めず、データの特徴のみ記述してください。`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || baseComment;
  } catch(e) {
    return baseComment;
  }
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
    const { stockCode, stockName, plan, comment, score, per, pbr, div, cap, highRatio } = session.metadata;

    // ユーザーIDを取得
    const lineUserId = await getLineUserId(session.id);

    let analysisContent = comment;
    let messageTitle = '📋 簡易レポート';

    if (plan === '詳細レポート') {
      messageTitle = '📊 詳細レポート';
      analysisContent = await generateDetailedAnalysis(
        stockName, stockCode, per, pbr, div, cap, highRatio, score, comment
      );
    }

    const message = plan === '詳細レポート'
      ? `✅ 決済完了！かぶAI詳細分析レポート
━━━━━━━━━━━━
🏢 ${stockName}（#${stockCode}）
📊 プラン：${messageTitle}
🤖 AIスコア：${score}点
━━━━━━━━━━━━
📈 PER：${per}倍
📈 PBR：${pbr}倍
💰 配当利回り：${div}%
🏛 時価総額：${cap}
📉 52週高値比：${highRatio}%
━━━━━━━━━━━━
🔍 詳細AI分析：
${analysisContent}
━━━━━━━━━━━━
⚠️ 投資助言ではありません
📲 かぶAI: https://kabu-ai-steel.vercel.app`
      : `✅ 決済完了！かぶAI簡易分析レポート
━━━━━━━━━━━━
🏢 ${stockName}（#${stockCode}）
📊 プラン：${messageTitle}
🤖 AIスコア：${score}点
━━━━━━━━━━━━
📈 PER：${per}倍
📈 PBR：${pbr}倍
💰 配当利回り：${div}%
🏛 時価総額：${cap}
📉 52週高値比：${highRatio}%
━━━━━━━━━━━━
🤖 AI分析コメント：
${analysisContent}
━━━━━━━━━━━━
⚠️ 投資助言ではありません
📲 かぶAI: https://kabu-ai-steel.vercel.app`;

    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_TOKEN}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: message }]
      })
    });
  }

  res.status(200).json({ received: true });
}

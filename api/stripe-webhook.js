import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).json({ error: `Webhook error: ${e.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};

    const { stockCode, stockName, plan, score, per, pbr, div, cap, highRatio, sector, chg, price } = meta;

    try {
      // 1. KVから最新LINEユーザーIDを取得
      const kvRes = await fetch(`${process.env.KV_REST_API_URL}/get/latest_line_user`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
      });
      const kvData = await kvRes.json();
      const lineUserId = kvData.result;

      if (!lineUserId) {
        console.error('LINE user ID not found');
        return res.status(200).json({ received: true });
      }

      // 2. Claude APIでコメント生成
      const chgSign = parseFloat(chg) >= 0 ? '▲' : '▼';
      const prompt = plan === '詳細レポート'
        ? `あなたは日本株の専門アナリストです。以下の財務データと、あなたが知っている${stockName}（証券コード:${stockCode}）に関する知識を総合して、投資家向けの詳細分析レポートを作成してください。投資推奨は含めず、以下の6項目を必ず含めてください。600文字以内の日本語で。

【財務データ】
銘柄: ${stockName}（${stockCode}）/ 業種: ${sector}
株価: ¥${Number(price).toLocaleString()} (${chgSign}${Math.abs(parseFloat(chg))}%)
PER: ${per}倍 / PBR: ${pbr}倍 / 配当利回り: ${div}%
時価総額: ${cap} / 52週高値比: ${highRatio}% / AIスコア: ${score}点

【必須項目】
①会社概要：何をしている会社か（1〜2文）
②経営理念・強み：企業の特徴や競争優位性
③成長性：売上・利益の傾向や成長ドライバー
④財務評価：PER・PBR・配当利回りの業界水準との比較
⑤株価モメンタム：52週高値比${highRatio}%から見た現在のポジション
⑥総合評価：注目すべきポイントと今後のリスク`
        : `あなたは日本株の専門アナリストです。以下の財務データを元に、${stockName}（${stockCode}）の簡易分析コメントを200文字以内の日本語で作成してください。投資推奨は含めず、最も注目すべき財務上の特徴を具体的な数値を使って記述してください。

銘柄: ${stockName}（${stockCode}）/ 業種: ${sector}
株価: ¥${Number(price).toLocaleString()} (${chgSign}${Math.abs(parseFloat(chg))}%)
PER: ${per}倍 / PBR: ${pbr}倍 / 配当利回り: ${div}%
時価総額: ${cap} / 52週高値比: ${highRatio}% / AIスコア: ${score}点`;

      const aiRes = await fetch('https://kabu-ai-steel.vercel.app/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const aiData = await aiRes.json();
      const comment = aiData.content?.[0]?.text || '分析コメントの生成に失敗しました。';

      // 3. LINEにレポート送信
      const lineMessage = plan === '詳細レポート'
        ? `📊 詳細分析レポート\n\n` +
          `【${stockName}（#${stockCode}）】\n` +
          `株価: ¥${Number(price).toLocaleString()} ${chgSign}${Math.abs(parseFloat(chg))}%\n` +
          `━━━━━━━━━━━━\n` +
          `PER: ${per}倍　PBR: ${pbr}倍\n` +
          `配当: ${div}%　AIスコア: ${score}点\n` +
          `52週高値比: ${highRatio}%\n` +
          `━━━━━━━━━━━━\n` +
          `🤖 AI分析コメント\n${comment}\n\n` +
          `📈 かぶAI\nhttps://kabu-ai-steel.vercel.app`
        : `💡 簡易分析レポート\n\n` +
          `【${stockName}（#${stockCode}）】\n` +
          `株価: ¥${Number(price).toLocaleString()} ${chgSign}${Math.abs(parseFloat(chg))}%\n` +
          `AIスコア: ${score}点\n` +
          `━━━━━━━━━━━━\n` +
          `🤖 AI分析コメント\n${comment}\n\n` +
          `📈 かぶAI\nhttps://kabu-ai-steel.vercel.app`;

      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_TOKEN}`
        },
        body: JSON.stringify({
          to: lineUserId,
          messages: [{ type: 'text', text: lineMessage }]
        })
      });

    } catch (e) {
      console.error('Webhook processing error:', e);
    }
  }

  res.status(200).json({ received: true });
}

// raw bodyを取得するヘルパー
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

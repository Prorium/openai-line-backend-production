const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Client, middleware } = require('@line/bot-sdk');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// 環境変数チェック
const requiredEnvVars = ['OPENAI_API_KEY', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// OpenAI設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// LINE Bot設定
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(lineConfig);

// セキュリティ設定
app.use(helmet());
app.use(cors({
  origin: '*', // 開発用：本番では許可ドメインに絞ること
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-line-signature']
}));

// レート制限
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 最大100リクエスト
  message: { error: 'Too many requests, please try again later.' }
});

// ボディパーサー設定
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// OpenAI チャットエンドポイント（ストリーミング）
app.post('/chat', limiter, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // ストリーミングレスポンス設定
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// LINE Webhook エンドポイント
app.post('/line/webhook', limiter, middleware(lineConfig), async (req, res) => {
  try {
    const events = req.body.events;

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        await handleTextMessage(event);
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('LINE Webhook Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// テキストメッセージ処理
async function handleTextMessage(event) {
  const userMessage = event.message.text.trim();
  const replyToken = event.replyToken;

  let responseText;

  if (userMessage === '結果') {
    // 民泊シミュレーター実行
    responseText = runMinpakuSimulator();
  } else {
    // ヘルプメッセージ
    responseText = `こんにちは！以下の機能が利用できます：

📊 民泊シミュレーション
「結果」と送信すると、民泊投資のシミュレーション結果を表示します。

💡 その他のメッセージ
現在は「結果」のみ対応しています。`;
  }

  // LINE返信
  await client.replyMessage(replyToken, {
    type: 'text',
    text: responseText
  });
}

// 民泊シミュレーター関数
function runMinpakuSimulator() {
  // ここを実運用ロジックに差し替え
  // 実際の運用では、データベースから最新のシミュレーション結果を取得するか、
  // リアルタイムで計算を実行する処理に置き換えてください
  
  const scenarios = [
    {
      region: '東京都',
      operation: '購入',
      propertyType: '1DK',
      area: '35㎡',
      capacity: '2名',
      lawType: '民泊新法対応',
      monthlyRevenue: '¥180,000',
      monthlyExpenses: '¥120,000',
      monthlyProfit: '¥60,000',
      annualProfit: '¥720,000',
      roi: '8.5%'
    },
    {
      region: '大阪府',
      operation: '転貸（サブリース）',
      propertyType: '1R',
      area: '25㎡',
      capacity: '1名',
      lawType: '民泊新法対応',
      monthlyRevenue: '¥120,000',
      monthlyExpenses: '¥85,000',
      monthlyProfit: '¥35,000',
      annualProfit: '¥420,000',
      roi: '12.3%'
    },
    {
      region: '京都府',
      operation: '購入',
      propertyType: '1DK',
      area: '40㎡',
      capacity: '3名',
      lawType: '民泊新法対応',
      monthlyRevenue: '¥200,000',
      monthlyExpenses: '¥140,000',
      monthlyProfit: '¥60,000',
      annualProfit: '¥720,000',
      roi: '9.2%'
    }
  ];

  // ランダムにシナリオを選択
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  return `📊 民泊シミュレーション結果

🏠 物件情報
地域: ${scenario.region}
運用方式: ${scenario.operation}
間取り: ${scenario.propertyType}
面積: ${scenario.area}
収容人数: ${scenario.capacity}
法規制: ${scenario.lawType}

💰 収益予測
月間売上: ${scenario.monthlyRevenue}
月間経費: ${scenario.monthlyExpenses}
月間利益: ${scenario.monthlyProfit}
年間利益: ${scenario.annualProfit}
投資利回り: ${scenario.roi}

※ この結果はサンプルデータです。実際の投資判断には詳細な市場調査が必要です。`;
}

// 404エラーハンドリング
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// エラーハンドリング
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Chat endpoint: http://localhost:${PORT}/chat`);
  console.log(`LINE webhook: http://localhost:${PORT}/line/webhook`);
  console.log('✅ All required environment variables are set');
});


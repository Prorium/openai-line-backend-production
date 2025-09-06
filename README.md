# OpenAI + LINE Bot統合バックエンド

OpenAI APIとLINE Messaging APIを統合したNode.js（Express）バックエンドサービスです。民泊シミュレーター機能とOpenAIチャット機能を提供します。

## 機能一覧

### エンドポイント

- **GET /health** - ヘルスチェック（`{"status":"ok"}`を返す）
- **POST /chat** - OpenAI Chat Completions APIをServer-Sent Events（SSE）でストリーミング配信
- **POST /line/webhook** - LINE Bot Webhook（署名検証あり）

### LINE Bot機能

- **「結果」メッセージ** → 民泊シミュレーション結果を返信
- **その他のメッセージ** → ヘルプメッセージを返信

## ローカル実行手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定してください：

```env
OPENAI_API_KEY=your_openai_api_key_here
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token_here
LINE_CHANNEL_SECRET=your_line_channel_secret_here
```

### 3. サーバーの起動

```bash
npm start
```

サーバーはポート3000で起動します。

### 4. 動作確認

#### ヘルスチェック
```bash
curl http://localhost:3000/health
# 期待される応答: {"status":"ok"}
```

#### LINE Webhook（POST専用）
```bash
curl -X POST http://localhost:3000/line/webhook
# 期待される応答: 署名エラー（正常：実際のLINEからの署名が必要）
```

#### OpenAI チャット（ストリーミング）
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}' \
  --no-buffer
```

## Railway デプロイ手順

### 1. GitHubにプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo-name.git
git push -u origin main
```

### 2. Railwayでデプロイ

1. [Railway.app](https://railway.app) にアクセス
2. GitHubアカウントでログイン
3. **New Project** をクリック
4. **Deploy from GitHub repo** を選択
5. 対象のリポジトリを選択
6. 自動デプロイが開始されます

### 3. 環境変数の設定

Railwayのプロジェクト画面で：

1. **Variables** タブを開く
2. 以下の環境変数を追加：
   - `OPENAI_API_KEY`: OpenAI APIキー
   - `LINE_CHANNEL_ACCESS_TOKEN`: LINE チャネルアクセストークン
   - `LINE_CHANNEL_SECRET`: LINE チャネルシークレット

### 4. デプロイ完了

デプロイが完了すると、以下のようなURLが発行されます：
```
https://your-app-name.railway.app
```

## LINE 公式アカウント設定手順

### 1. LINE Developers Console設定

1. [LINE Developers Console](https://developers.line.biz/) にアクセス
2. プロバイダーを選択または作成
3. 新しいチャネル（Messaging API）を作成
4. **Messaging API設定** タブで以下を設定：
   - **チャネルシークレット** をコピー（環境変数 `LINE_CHANNEL_SECRET` に使用）
   - **チャネルアクセストークン** を発行・コピー（環境変数 `LINE_CHANNEL_ACCESS_TOKEN` に使用）

### 2. Webhook URL設定

1. **Messaging API設定** タブの **Webhook設定** で：
   - **Webhook URL**: `https://your-app-name.railway.app/line/webhook`
   - **Webhookの利用**: 有効
   - **検証** ボタンをクリックして接続確認

### 3. 応答設定

1. **Messaging API設定** タブの **応答設定** で：
   - **あいさつメッセージ**: 無効
   - **応答メッセージ**: 無効
   - **Webhook**: 有効

### 4. 動作確認

1. LINE公式アカウントを友だち追加
2. 「結果」と送信
3. 民泊シミュレーション結果が返信されることを確認

## 動作確認コマンド例

### Server-Sent Events（SSE）のテスト

#### curl使用例
```bash
curl -X POST https://your-app-name.railway.app/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"こんにちは"}]}' \
  --no-buffer
```

#### JavaScript fetch使用例
```javascript
async function testChat() {
  const response = await fetch('https://your-app-name.railway.app/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'こんにちは' }
      ]
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          console.log('Stream completed');
          return;
        }
        try {
          const parsed = JSON.parse(data);
          console.log(parsed.content);
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}
```

### LINE Bot動作確認

1. LINE公式アカウントに「結果」と送信
2. 民泊シミュレーション結果が返信される
3. その他のメッセージでヘルプが返信される

## トラブルシューティング

### よくある問題と解決方法

#### 1. `/line/webhook` をGETでアクセスすると404エラー

**現象**: ブラウザで `/line/webhook` にアクセスすると `{"error":"Endpoint not found"}` が表示される

**原因**: LINE WebhookはPOST専用エンドポイントのため

**解決**: 正常な動作です。LINEからのPOSTリクエストのみ受け付けます

#### 2. LINE署名エラー

**現象**: Webhook接続時に署名検証エラーが発生

**確認ポイント**:
- `LINE_CHANNEL_SECRET` が正しく設定されているか
- 環境変数に余分なスペースや改行が含まれていないか
- LINE Developers Consoleのチャネルシークレットと一致しているか

#### 3. LINE返信失敗

**現象**: メッセージを送信してもBotが応答しない

**確認ポイント**:
- `LINE_CHANNEL_ACCESS_TOKEN` が正しく設定されているか
- アクセストークンの有効期限が切れていないか
- トークンに適切な権限が付与されているか
- Webhook URLが正しく設定されているか

#### 4. OpenAI API エラー

**現象**: `/chat` エンドポイントでエラーが発生

**確認ポイント**:
- `OPENAI_API_KEY` が正しく設定されているか
- APIキーの使用量制限に達していないか
- リクエスト形式が正しいか（`messages` 配列が必要）

#### 5. Railway ログの確認方法

1. Railwayプロジェクト画面で **Deployments** タブを開く
2. 最新のデプロイメントをクリック
3. **View Logs** でサーバーログを確認
4. エラーメッセージから問題を特定

### 環境変数の確認

Railway上で環境変数が正しく設定されているか確認：

1. プロジェクト画面で **Variables** タブを開く
2. 以下の3つの変数が設定されていることを確認：
   - `OPENAI_API_KEY`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`

## セキュリティ注意事項

### 本番環境での設定

- **CORS設定**: 現在は開発用に `origin: '*'` を設定していますが、本番環境では許可するドメインを明示的に指定してください
- **レート制限**: 現在は15分間に100リクエストに制限していますが、用途に応じて調整してください
- **環境変数**: APIキーやシークレットは絶対にコードに直書きせず、環境変数で管理してください

### 推奨設定例（本番環境）

```javascript
// CORS設定例
app.use(cors({
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-line-signature']
}));
```

## 開発履歴

### 過去ログ参考

開発時のテスト環境URL（参考のみ）:
- 開発URL: `https://3000-iojyjfw2zv8y31hzzixvg-279714ea.manusvm.computer`
- 動作確認済み: GET /health, POST /line/webhook, POST /chat, 民泊シミュレーター

本番運用はRailway URLを使用してください。

## ライセンス

MIT License

## サポート

問題が発生した場合は、以下を確認してください：

1. 環境変数の設定
2. Railway デプロイログ
3. LINE Developers Console の設定
4. OpenAI API の使用状況

それでも解決しない場合は、エラーログと設定内容を確認して対応してください。


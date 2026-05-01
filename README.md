# AIスライド構成案ジェネレーター

テーマ・ターゲット・目的・要点メモを入力すると、Claude AIがGamma等のツールにそのまま貼り付けられるMarkdown形式のスライド構成案を生成するWebアプリケーションです。

---

## 目次

1. [技術スタック](#技術スタック)
2. [ローカル環境でのセットアップ](#ローカル環境でのセットアップ)
3. [Vercelへのデプロイ手順](#vercelへのデプロイ手順)
4. [設定の変更方法（遠隔修正ガイド）](#設定の変更方法遠隔修正ガイド)
5. [APIの動作確認方法](#apiの動作確認方法)
6. [トラブルシューティング](#トラブルシューティング)
7. [ファイル構成](#ファイル構成)

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | HTML / CSS / JavaScript（バニラJS） |
| バックエンド | Node.js 18以上 + Express |
| AIエンジン | Anthropic Claude API（claude-sonnet-4-20250514） |
| ホスティング | Vercel |

---

## ローカル環境でのセットアップ

### 1. 必要なもの

- **Node.js v18以上**（https://nodejs.org でインストール）
- **Anthropic APIキー**（https://console.anthropic.com で発行）

Node.jsのバージョン確認：
```bash
node -v
# v18.x.x 以上であればOK
```

---

### 2. プロジェクトの準備

```bash
# リポジトリをクローン（GitHubにある場合）
git clone https://github.com/YOUR_USERNAME/ai-slide-generator.git
cd ai-slide-generator

# または、ファイルをそのままフォルダに置いて
cd ai-slide-generator
```

---

### 3. 依存パッケージのインストール

```bash
npm install
```

---

### 4. 環境変数の設定

`.env.example` をコピーして `.env` を作成します：

```bash
# Mac / Linux
cp .env.example .env

# Windows（コマンドプロンプト）
copy .env.example .env
```

`.env` をテキストエディタで開き、APIキーを記入します：

```
ANTHROPIC_API_KEY=sk-ant-あなたの実際のAPIキー
```

> ⚠️ `.env` ファイルは絶対にGitにコミットしないでください（`.gitignore` で除外済みです）

---

### 5. サーバーの起動

```bash
npm start
```

ターミナルに以下が表示されれば起動成功です：

```
✅ サーバー起動: http://localhost:5000
   モデル: claude-sonnet-4-20250514
   最大トークン: 2000
```

ブラウザで **http://localhost:5000** を開いて動作確認してください。

---

## Vercelへのデプロイ手順

### 事前準備

- GitHubアカウント（https://github.com）
- Vercelアカウント（https://vercel.com）

---

### 1. GitHubにコードをプッシュ

```bash
git init
git add .
git commit -m "初回コミット"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-slide-generator.git
git push -u origin main
```

> ⚠️ `.env` が `.gitignore` に含まれていることを必ず確認してください

---

### 2. Vercelでプロジェクトを作成

1. https://vercel.com にログイン
2. 「New Project」をクリック
3. GitHubのリポジトリ一覧から `ai-slide-generator` を選択
4. 「Import」をクリック

---

### 3. 環境変数の設定（重要）

Vercelのプロジェクト設定画面で環境変数を登録します：

1. 「Environment Variables」セクションを開く
2. 以下を追加：

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-あなたの実際のAPIキー` |

3. 「Save」をクリック

---

### 4. デプロイ実行

「Deploy」をクリックするとデプロイが開始します。

完了後に発行されるURL（例：`https://ai-slide-generator-xxx.vercel.app`）でアクセスできます。

---

## 設定の変更方法（遠隔修正ガイド）

すべての重要設定は **`server.js` の `CONFIG` オブジェクト**（ファイル上部）にまとめてあります。

```javascript
const CONFIG = {
  MODEL: "claude-sonnet-4-20250514",   // ← モデルを変更する場合はここ
  MAX_TOKENS: 2000,                     // ← トークン数を変更する場合はここ
  SYSTEM_PROMPT: `...`,                 // ← AIへの指示を変更する場合はここ
  USER_PROMPT_TEMPLATE: (data) => `...` // ← 送信フォーマットを変更する場合はここ
};
```

### よくある変更例

#### AIの出力品質が悪い → システムプロンプトを調整

`server.js` の `SYSTEM_PROMPT` を編集して、GitHubにプッシュするとVercelが自動でリデプロイします。

#### モデルを最新版に変更したい

`CONFIG.MODEL` の値を変更します（例：`"claude-opus-4-20250514"`）。

#### トークン数を増やして長い構成案を生成したい

`CONFIG.MAX_TOKENS` の値を増やします（最大8192、費用増に注意）。

---

## APIの動作確認方法

### ヘルスチェック（サーバーが正常動作しているか確認）

ブラウザまたはターミナルでアクセスします：

```bash
# ローカル
curl http://localhost:5000/api/health

# 本番（VercelのURLに置き換え）
curl https://あなたのURL.vercel.app/api/health
```

正常なレスポンス例：
```json
{
  "status": "ok",
  "model": "claude-sonnet-4-20250514",
  "maxTokens": 2000,
  "apiKeySet": true,
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

> `"apiKeySet": false` の場合はAPIキーが設定されていません

### 生成APIのテスト（curlコマンド）

```bash
curl -X POST http://localhost:5000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "theme": "新サービスのご提案",
    "target": "30代の経営者",
    "goal": "サービス導入の承認を得る",
    "notes": "・課題：業務効率が低い\n・解決策：AI活用\n・費用：月額3万円",
    "slideCount": "10〜12枚"
  }'
```

---

## トラブルシューティング

### ❌ `ANTHROPIC_API_KEY が .env に設定されていません` と表示される

→ `.env` ファイルが作成されているか確認してください。`.env.example` をコピーして作成します。

---

### ❌ ブラウザで `Cannot GET /` と表示される

→ `public/index.html` が存在するか確認してください。

---

### ❌ APIキーが無効です と表示される（401エラー）

→ Anthropicコンソール（https://console.anthropic.com）でAPIキーが有効か確認してください。

---

### ❌ APIの利用上限に達しました と表示される（429エラー）

→ Anthropicコンソールで利用状況と上限設定を確認してください。しばらく待ってから再試行してください。

---

### ❌ 生成がタイムアウトした と表示される（504エラー）

→ 通信環境の問題またはClaude APIの一時的な混雑です。時間をおいて再試行してください。

---

### ❌ Vercelデプロイ後に `Internal Server Error` になる

→ Vercelのプロジェクト設定 → Environment Variables で `ANTHROPIC_API_KEY` が正しく設定されているか確認してください。

設定後は「Redeploy」を実行してください。

---

### ❌ `/api/health` で `"apiKeySet": false` になる

→ 環境変数 `ANTHROPIC_API_KEY` が読み込まれていません。

**ローカルの場合：** `.env` ファイルが `server.js` と同じフォルダにあるか確認してください。

**Vercelの場合：** プロジェクト設定 → Environment Variables を確認し、再デプロイしてください。

---

## ファイル構成

```
ai-slide-generator/
├── server.js           # バックエンドサーバー本体（設定・API処理）
├── public/
│   └── index.html      # フロントエンド全コード（HTML・CSS・JS一体型）
├── package.json        # 依存パッケージ定義
├── .env                # APIキー設定（Gitに含めない）← 自分で作成
├── .env.example        # 環境変数サンプル（Gitで管理）
├── .gitignore          # Git除外設定
├── vercel.json         # Vercelデプロイ設定
└── README.md           # このファイル
```

---

## 費用の目安（月次）

| サービス | 月額 | 備考 |
|---|---|---|
| Anthropic Claude API | $5〜$20 | 月100件生成で$5〜$10程度 |
| Vercel | 無料〜 | 個人・小規模は無料枠で対応可 |
| GitHub | 無料 | プライベートリポジトリも無料 |

---

## 受け入れ条件チェックリスト

- [ ] すべての入力フォームが正常に動作する
- [ ] Claude APIへのリクエスト・レスポンスが正常に動作する
- [ ] 生成されたMarkdownがGammaに問題なく貼り付けられる
- [ ] コピーボタンが正常に動作する
- [ ] APIキーがフロントエンドコードに含まれていない
- [ ] `/api/health` で `"status": "ok"` が返る
- [ ] README.mdの手順に従いローカル環境で動作確認ができる
- [ ] Vercelへのデプロイが完了しURLでアクセスできる

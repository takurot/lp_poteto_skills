# デプロイ手順

`.github/workflows/deploy.yml` が、PR と `main` への push のたびにテスト一式（`npm test`、build、`npm run validate`、`npm run e2e`）を実行する。デプロイはテストが通ったときだけ行う。

| イベント | ジョブ | 動作 |
|---|---|---|
| `main` への push | `deploy` | `wrangler deploy` で本番に公開する |
| 同一リポジトリのブランチからの PR | `preview` | `wrangler versions upload` でバージョンを作り、プレビュー URL を PR にコメントする |
| フォークからの PR | なし | テストだけを実行する。シークレットは渡らない |

## GitHub Secrets の設定

`deploy` ジョブは GitHub Environment `production` で動く（初回実行時に自動で作られる）。次の 2 つの置き場所のどちらかを選ぶ。

- **本番だけ（推奨）**: Settings → Environments → `production` で Deployment branches を `main` に限り、そこに Environment secret として追加する。`main` 以外のブランチのワークフローからトークンは読めない。PR プレビューはシークレットがないため警告を出してスキップする。
- **本番と PR プレビュー**: Settings → Secrets and variables → Actions に Repository secret として追加する。プレビューには同じトークンが渡るため、push 権限を持つ人はブランチのワークフローを書き換えて本番にデプロイできる。`versions upload` にも Workers Scripts: Edit が必要なので、プレビュー専用トークンに分けても防げない。共同作業者が増えたら本番だけに切り替える。

Dependabot の PR ではプレビューを動かさない。Cloudflare のシークレットを Dependabot secrets に追加しない。

名前と値:

| 名前 | 値 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 下記の権限で作った Cloudflare API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare ダッシュボードの Workers & Pages の概要に表示されるアカウント ID |

どちらかが未設定のとき、`deploy` と `preview` は Cloudflare の手順を飛ばし、`::warning::` とジョブサマリーに「secrets が未設定のためスキップした」と書く。テストは通常どおり実行し、デプロイの条件として扱う。

## API トークンの権限

Cloudflare ダッシュボードの My Profile → API Tokens → Create Token で Custom token を作る。

1. まず Account の **Workers Scripts: Edit** だけを付ける。Account Resources は対象アカウントに限る。
2. `main` に push して `deploy` ジョブを実行する。権限不足で失敗したら、エラーに出た権限だけを足す（候補は Account Settings: Read、User Details: Read など）。
3. 最終的に必要だった権限を SPEC §12 に記録する。

トークンとアカウント ID はコード、ログ、PR、Issue に書かない。

## ローカルからのデプロイ

```sh
npm ci
SITE_URL=https://poteto-skills.<subdomain>.workers.dev npm run build
npx wrangler deploy
```

`SITE_URL` はワークフローの `env` と同じ値にする。`deploy` ジョブは `SITE_URL` が仮の `*.example.workers.dev` のままなら失敗する。canonical・hreflang・`og:url`・`og:image` の絶対 URL はこの値から作る。

## ロールバック

```sh
npx wrangler deployments list
npx wrangler rollback [<version-id>]
```

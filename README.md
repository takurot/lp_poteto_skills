# lp_poteto_skills

[poteto-skills](https://github.com/takurot/poteto-skills) のランディングページ。英語版（`/`）と日本語版（`/ja/`）の 1 ページ構成で、Cloudflare Workers Static Assets から配信する。

公開 URL: https://poteto-skills.void-technology.workers.dev

- 生成系は依存ゼロの Node スクリプト。`dependencies` は空で、`devDependencies` はテストと検証用だけ。
- デザインは [VoiceBox](docs/voicebox-DESIGN.md)（角丸 0、影なし、赤は限られた場所だけ）。
- 外部ドメインへのリクエスト、外部 JS、解析タグ、Cookie は使わない。フォントは自前配信する。

仕様は [docs/SPEC.md](docs/SPEC.md) が正。

## 必要なもの

- Node.js 22.22 以上（`.nvmrc` は `22`）。`package.json` の `engines` は `^22.22.0 || >=24.8.0`。
- E2E を実行するときは Playwright の Chromium（`npx playwright install chromium`）。

## 使い方

```sh
npm ci
npm run build      # build/ に出力
npm test           # ビルド出力と content の検査（node --test）
npm run validate   # build/ の HTML を html-validate で検証
npm run e2e        # build してから Playwright（360px / 1280px、リンク、言語切替、404、デザイン規則）
npm run size       # HTML と CSS の gzip 合計が 50KB 未満かを検査
npm run lighthouse # Lighthouse CI（モバイル。Performance・Accessibility・SEO が 95 以上）
```

`npm run lighthouse` は `wrangler dev` を起動して計測する。

### ビルドの環境変数

| 変数 | 既定値 | 内容 |
|---|---|---|
| `SITE_URL` | `https://poteto-skills.example.workers.dev`（仮） | canonical、hreflang、`og:url`、`og:image` の絶対 URL に使う origin。パスは含めない |
| `CONTENT_DIR` | `site/content` | 文言の JSON |
| `STATIC_DIR` | `site/static` | CSS、フォント、`_headers` などをそのままコピーするディレクトリ |
| `OUT_DIR` | `build` | 出力先。リポジトリ内では `build/` か `temp/` の下だけを許す |

本番と同じ URL でビルドするには、次のようにする。

```sh
SITE_URL=https://poteto-skills.void-technology.workers.dev npm run build
```

ビルドは出力先に `.build-output` マーカーを書く。マーカーのない空でないディレクトリは削除せずに拒否する。古い `build/` を拒否されたら、一度手で削除する。

## ディレクトリ構成

```
docs/        SPEC.md（仕様）、deploy.md（デプロイ手順）、voicebox-DESIGN.md
site/
  content/   en.json、ja.json、schema.mjs（スキーマと検証）
  templates/ page.mjs、not-found.mjs、escape.mjs（純関数のテンプレート）
  static/    style.css、copy.js、fonts/、og.png、favicon.svg、_headers、robots.txt
scripts/     build.mjs ほか（ビルド、サイズ検査、README 照合、OGP 画像の生成）
tests/
  build/     node --test（出力物と content の検査）
  e2e/       Playwright
.github/workflows/  deploy.yml、readme-check.yml
wrangler.jsonc      Workers Static Assets の設定
```

`site/static/og.png`（OGP 画像、1200×630）はビルドでは作らず、コミット済みのファイルをコピーする。画像の文言やデザインを変えたら `node scripts/generate-og.mjs` で作り直し、PNG をコミットする（Playwright の Chromium が必要。`npx playwright install chromium`）。

文言は `site/content/{en,ja}.json` に置く。英語版と日本語版はキー集合が一致していなければならず、スキーマに合わないとビルドは非ゼロで終了して何も書かない。テンプレートの補間はすべて `esc()` を通す。

## デプロイ

`main` への push と PR のたびに GitHub Actions がテスト一式を実行する。`main` への push では、テストが通ったときだけ `wrangler deploy` で本番に公開する。API トークンのシークレットが未設定のあいだは、デプロイとプレビューは警告を出してスキップする。

ローカルからもデプロイできる（Wrangler にログインしている場合）。

```sh
SITE_URL=https://poteto-skills.void-technology.workers.dev npm run build
npx wrangler deploy
```

ロールバックは次のとおり。静的アセットも前のバージョンに戻ることを確認済み。

```sh
npx wrangler deployments list
npx wrangler rollback [<version-id>]
```

シークレットの設定とトークンの権限は [docs/deploy.md](docs/deploy.md) を参照する。

## 数値の照合

LP に載せる数値（Skill 数、プラグイン数など）は [takurot/poteto-skills](https://github.com/takurot/poteto-skills) の内容と照合する。`readme-check` ワークフローが週 1 回（月曜 03:17 UTC）と手動で実行し、差分があれば Issue を立てる。デプロイの条件には含めない。

## 開発の進め方

[CLAUDE.md](CLAUDE.md)（と同じ内容の [AGENTS.md](AGENTS.md)）に、仕様・TDD・品質ゲート・PR の流れを定めている。`CLAUDE.md` と `AGENTS.md` は同じ内容を保つ。

## ライセンスとクレジット

フォント（Archivo Black、Work Sans、Space Mono）は SIL Open Font License で、ライセンス全文は [site/static/fonts/](site/static/fonts/) にある。ページ内で言及する Cursor、Claude Code、Codex などの製品名はテキストでのみ使い、公式のロゴやブランド画像は使わない。

このリポジトリのコード、テンプレート、文言、ドキュメントは [MIT ライセンス](LICENSE)。フォントは上記のとおり別のライセンス（OFL）で、MIT の対象外。

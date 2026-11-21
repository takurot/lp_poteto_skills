# poteto-skills ランディングページ 仕様書

- 対象: https://github.com/takurot/poteto-skills
- 作成日: 2026-11-20
- デザイン: [VoiceBox](./voicebox-DESIGN.md)
- 生成系: 依存ゼロの Node スクリプト（Astryx は Phase 0 で不採用。[astryx-spike.md](./astryx-spike.md)）
- ホスティング: Cloudflare Workers Static Assets

## 1. 目的

poteto-skills が何であり、どうインストールするかを 1 ページで伝え、GitHub リポジトリへ誘導する。

成功の基準:

1. 初見の開発者が 10 秒以内に「Cursor の公式プラグインの Skill を Claude Code と Codex で使えるようにする配布物」だと理解できる。
2. ファーストビューからインストールコマンドにスクロールなしで、またはワンスクロールで到達できる。
3. 主要 CTA は「View on GitHub」の 1 つ。

対象読者: Claude Code または Codex を使う開発者で、pstack などの Cursor プラグイン由来の Skill を使いたい人。

## 2. 前提事実（LP に載せる数値の出典）

README（2026-11-20 時点）から取る。数値はハードコードし、更新手順を §9 に定める。

| 項目 | 値 | 出典 |
|---|---|---|
| 対応ホスト | Claude Code, Codex | README「Contents」 |
| 生成 Skill 数 | 各ホスト 110（デフォルトインストールは 109） | README |
| Codex プラグイン数 | 22（＋任意の `codex-hooks`） | `.agents/plugins/marketplace.json` |
| 同梱 pstack | 0.15.46 | README |
| ライセンス | MIT（変換済み Skill は上流の MIT 表記を保持） | LICENSE, README「License」 |

## 3. 情報設計

1 ページ構成。英語版を `/`、日本語版を `/ja/` に置く（リポジトリに README と README_JP があるため）。両ページのヘッダーに言語切替リンクを置く。

| # | セクション | 内容 | 主要要素 |
|---|---|---|---|
| 0 | Header | ワードマーク「POTETO-SKILLS」、言語切替、GitHub リンク | Ghost ボタン |
| 1 | Hero | Overline「CURSOR PLUGINS → CLAUDE CODE & CODEX」、見出し `pstack for Codex`（決定済み。英日とも同じ）、1 文のリード、CTA | Display 見出し、Primary ボタン（GitHub） |
| 2 | Numbers | 110 Skills / 2 Hosts / 22 Codex plugins / pstack 0.15.46 | 4 列（モバイルでは 2×2）の罫線グリッド |
| 3 | Install | `git clone` → `./install.sh`。`--target`、`--scope project`、`--skill` の例 | コードブロック（Space Mono） |
| 4 | Codex plugins | `codex plugin marketplace add takurot/poteto-skills` ほか 3 コマンドと、22 プラグイン名の一覧 | コードブロック、Filter Chip 風の静的ラベル |
| 5 | How it converts | README の変換ポリシー表を要約（6 行以内） | 罫線テーブル |
| 6 | Boundaries | 互換性の制約を 4〜5 項目の箇条書き（hooks は手動フォールバック、MCP は別途設定など） | Default List Item |
| 7 | Pull quote | プロジェクトの立場を示す 1 文 | 左 4px 赤ボーダー、Body Large italic |
| 8 | Footer | ライセンス表記、上流（cursor/plugins, pstack）へのクレジット、GitHub リンク | Caption |

コピーの規則:

- README の事実だけを書く。性能や採用実績などの誇張はしない。
- 上流の著作権者（Cursor, Lauren Tan, Anysphere, Inc.）を Footer に明記する。
- 公式の Cursor / Anthropic / OpenAI のロゴやブランドは使わない。製品名はテキストでのみ言及する。

## 4. デザイン適用（VoiceBox）

[voicebox-DESIGN.md](./voicebox-DESIGN.md) のトークンをそのまま CSS カスタムプロパティにする。

```css
:root {
  --c-primary: #0A0A0A;   --c-accent: #EF4444;  --c-accent-active: #DC2626;
  --c-bg: #FAFAFA;        --c-surface: #F5F5F5; --c-surface-raised: #E5E5E5;
  --c-text: #0A0A0A;      --c-text-2: #525252;  --c-text-3: #A3A3A3;
  --c-border-subtle: #E5E5E5; --c-border-medium: #D4D4D4; --c-border-strong: #0A0A0A;
  --f-display: "Archivo Black", Impact, "Arial Black", sans-serif;
  --f-body: "Work Sans", -apple-system, "Segoe UI", Helvetica, sans-serif;
  --f-mono: "Space Mono", "Courier New", Consolas, monospace;
  --focus-ring: 0 0 0 2px #FAFAFA, 0 0 0 4px #0A0A0A;
}
```

適用ルール:

- 角丸は全要素 0、影はなし。階層は罫線、ウェイト、サイズで表す。
- 赤（`--c-accent`）は静止状態で 1 ビューポートに 1 要素まで。静止状態の割り当ては Hero の見出し下の 3px アンダーラインと、Pull quote の左ボーダーの 2 か所で、同じビューポートに入らない配置にする。ホバー・アクティブ時の赤（Primary ボタン、Ghost ボタン、リンク）は操作中の 1 要素だけに現れるため、この上限の対象外とする。
- 赤の使用箇所は許可リスト方式で管理する。`style.css` で `--c-accent` / `--c-accent-active` を参照してよいセレクタを §8 のテストに列挙し、リストにないセレクタが参照したら失敗させる。
- 赤のホバー配色は文字として読ませない用途に限る。`#FAFAFA` on `#EF4444` と `#EF4444` on `#FAFAFA` は 3.61:1 で、14px の文字では WCAG AA（4.5:1）を満たさない。そのため Primary ボタンのホバーは VoiceBox の指定どおり背景を赤にするが、文字は 16px 太字（Large 相当で 3:1 を満たす）にそろえる。Ghost ボタンのホバーは文字色を赤にせず、`2px` の赤い下線で示す。
- 補助文字 `#A3A3A3`（2.42:1）は本文や操作要素に使わない。プレースホルダーと無効状態に限る。
- タイプサイズは VoiceBox の型スケールをそのまま使い、「3 段」ルールは採用しない（実際には 56/40・24・20・16・14・12・11 を使う）。ただし、見出しは H1 を Display、H2 を Subhead の 1 種ずつに限り、本文は 16px を基準にする。モバイル（< 640px）では Display を 40px に縮める。
- セクション間の余白は 48px（モバイル）、64px（タブレット）、96px（デスクトップ）。
- コンテンツ最大幅は 1080px、本文の段落は最大 68ch。左右のガターは 16px 以上。
- コードブロックは背景 `#0A0A0A`、文字 `#FAFAFA`、Space Mono 14px、2px 罫線で、横スクロールはブロック内に閉じる。
- フォーカスは全インタラクティブ要素に `--focus-ring` を付ける。
- 画像や装飾は使わない（Do's and Don'ts #9）。OGP 画像だけはタイポグラフィのみで作る（黒地に白の Archivo Black と赤の 1 本線）。
- フォントは自前配信する（Archivo Black, Work Sans, Space Mono はいずれも OFL）。使うウェイトだけを `woff2` にして `static/fonts/` に置き、`@font-face` で `font-display: swap` を指定する。これにより外部ドメインへのリクエストをなくし、CSP を単純にする。
- ダークモード: VoiceBox は定義していないため対象外。`color-scheme: light` を明示する。

## 5. 技術構成

### 5.1 生成系の方針

Astryx は Phase 0 で不採用とした（詳細は [astryx-spike.md](./astryx-spike.md)）。出力が `<body>` を `<head>` の中に入れるなど構造的に壊れており、doctype の欠落、不要な閉じタグ、エスケープなしと合わせて、ポストビルドで出力を再構成する必要があるため。

代わりに、**依存ゼロの Node スクリプト**で生成する。

- 実行環境: Node 22 LTS の 22.22 以上（`package.json` の `engines` は `^22.22.0 || >=24.8.0`、`.nvmrc` は `22` で最新の 22.x を指す）。生成スクリプトは組み込みモジュール（`node:fs`、`node:path`）だけを使う。`package.json` の `dependencies` は空にし、`devDependencies` はテストと検証（`wrangler`、`@playwright/test`、`html-validate`、Lighthouse CI）だけにする。
- 内容: `site/content/en.json` と `ja.json`。JSON なので数値と配列を使える。コマンド列は文字列の配列、プラグイン名の一覧も配列にする。両ファイルを `site/content/schema.mjs` の 1 つのスキーマ（`string`・`number`・`array`・`object` の宣言的な木）で検証する。
- テンプレート: `site/templates/page.mjs` が `(content, locale, ctx) => string` を返す純関数（`ctx` は `{ siteUrl }`）。ページの一覧（locale、出力ファイル、パス）は `site/pages.mjs` の `PAGES` が唯一の定義で、canonical・hreflang・`og:url` はここから組み立てる。英語版と日本語版は同じテンプレートに別の `content` を渡すため、マークアップは重複しない。
- エスケープ: テンプレート内の補間はすべて `esc()`（`& < > " '` を置換）を通す。生の HTML を埋め込む場所は作らない。
- 出力は `build/` に書く。入力が同じなら出力は同じバイト列になる（現在時刻や乱数を使わない）。ビルドは 2 段で、`renderSite()` が全ファイルをメモリ上に作り、`writeSite()` だけが書き込む。`writeSite()` は隣の `build.staging/` に書き、`build/` を `build.previous/` へ退避し、`build.staging/` を `build/` へ rename してから `build.previous/` を消す。2 回目の rename が失敗したら退避した `build/` を戻す。そのため staging への書き込みまでの失敗では既存の `build/` は変更されず、入れ替えの失敗でも元の `build/` に戻る（rename 2 回の間にプロセスが落ちた場合は `build/` が無く `build.previous/` が残る）。
- `scripts/build.mjs` は環境変数 `CONTENT_DIR`、`STATIC_DIR`、`OUT_DIR`、`SITE_URL` を読む（未設定ならリポジトリの既定値）。テストはこれを使い、子プロセスとして一時ディレクトリにビルドする。`OUT_DIR` はリポジトリ内なら `build/` そのものか `temp/` より下のディレクトリに限る（共有の作業領域である `temp/` 自体は不可）。入力ディレクトリと重なってもならない（`writeSite()` が丸ごと置き換えるため）。
- `writeSite()` は出力に空のマーカーファイル `.build-output` を書き、`OUT_DIR`・`<OUT_DIR>.staging`・`<OUT_DIR>.previous` は、存在しない・空・マーカーありのいずれかでなければ消さずに非ゼロ終了する。リポジトリ外の `OUT_DIR` も同じ規則で守る。マーカー導入前の `build/` は一度だけ手で消す。`writeSite()` は同時に `.assetsignore`（中身は `.build-output` の 1 行）を書き、Wrangler がマーカーをアップロードしないようにする。`.assetsignore` がないと `wrangler dev` は `/.build-output` を 200 で返すことを確認した（2026-11-21）。

### 5.2 生成系の要件

| ID | 要件 | 確認方法 |
|---|---|---|
| G1 | 出力は `<!doctype html>`、`<html lang>`、`<meta charset>`、viewport、description、OGP、`<title>` を持つ | `node --test` で出力 HTML を検査する |
| G2 | 全文言が HTML エスケープされる | `<`、`&`、`"`、`'` を含む文言を入れ、出力に生の記号が残らないことを検査する |
| G3 | 英語版と日本語版でキー集合が一致する | `en.json` と `ja.json` の全キーを再帰的に比較する |
| G4 | 出力が決定的である | 2 回ビルドして `build/` 全体のハッシュが一致することを検査する |
| G5 | 必須キーの欠落や未知のキーがあれば非ゼロ終了し、出力を書かない | 欠落させた JSON でビルドし、終了コードを検査する |
| G6 | 出力 HTML が `html-validate` でエラー 0 | CI で実行する |
| G7 | `build/404.html` を直接出力する（`not_found_handling: "404-page"` が参照する場所） | 出力の存在を検査する |

### 5.3 ディレクトリ構成

```
lp_poteto_skills/
├── docs/
│   ├── SPEC.md
│   ├── astryx-spike.md      # Phase 0 の結果
│   ├── deploy.md            # GitHub Secrets・トークン権限・ローカルデプロイ
│   └── voicebox-DESIGN.md
├── site/
│   ├── content/
│   │   ├── en.json          # 全文言。数値と配列を使える
│   │   ├── ja.json
│   │   └── schema.mjs       # 両言語共通のスキーマと validate()
│   ├── templates/
│   │   ├── page.mjs         # (content, locale, ctx) => HTML。/ と /ja/ で共用
│   │   ├── not-found.mjs    # 404 ページ
│   │   ├── layout.mjs       # <head> と文書の外枠
│   │   └── escape.mjs       # esc()
│   ├── pages.mjs            # PAGES（locale・出力ファイル・パス）の唯一の定義
│   └── static/
│       ├── style.css        # §4 のトークンとコンポーネント
│       ├── fonts/           # woff2（Archivo Black, Work Sans, Space Mono）
│       ├── og.png           # 1200×630。scripts/generate-og.mjs が生成し、コミットする
│       ├── favicon.svg      # 黒の正方形と赤の横棒 1 本。文字は使わない
│       ├── robots.txt
│       └── _headers
├── scripts/
│   ├── build.mjs            # 環境変数を読み、site.mjs の各段を順に呼ぶ
│   ├── generate-og.mjs      # og.png を Playwright Chromium と自前フォントで描画する。文言を変えたら手で再実行する
│   └── site.mjs             # loadContents（検証）→ renderSite（メモリ上で生成）→ writeSite（build/ に出力）
├── tests/
│   ├── build/               # node --test。出力物と content の検査
│   └── e2e/                 # Playwright
├── wrangler.jsonc
├── package.json             # devDependencies のみ（wrangler, playwright, html-validate）
└── .github/workflows/deploy.yml
```

### 5.4 Cloudflare ホスティング

Workers Static Assets を使う（Cloudflare は新規の静的サイトにこちらを推奨している）。Worker スクリプトは置かず、アセットだけで配信する。

```jsonc
// wrangler.jsonc
{
  "name": "poteto-skills",
  "compatibility_date": "2026-11-01",
  "workers_dev": true,
  "preview_urls": true,
  "assets": {
    "directory": "./build",
    "not_found_handling": "404-page",
    "html_handling": "auto-trailing-slash"
  }
}
```

- ビルドは GitHub Actions で行い、`actions/setup-node`（`.nvmrc` の Node 22、22.22 以上）で `scripts/build.mjs` を実行してから `wrangler deploy` する。Cloudflare 側のビルド環境は使わない（ビルド環境の差異を避け、テストを通した成果物だけをデプロイするため）。このプロジェクトには `wrangler.jsonc` があるため、デプロイ操作は Wrangler で行う（`cf` CLI は Wrangler 設定のないプロジェクト向け）。
- 認証は `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を GitHub Secrets に置く。権限は Workers Scripts: Edit から始め、デプロイが権限不足で失敗したら必要な権限（Account Settings: Read など）を足して記録する。リポジトリに秘密情報は置かない。設定手順は [deploy.md](./deploy.md)。シークレットが未設定の間、`deploy` と `preview` ジョブは警告とジョブサマリーを出して Cloudflare の手順を飛ばす（テストは常に実行する）。
- `main` への push で本番にデプロイする。PR では `wrangler versions upload` でバージョンを作る。プレビュー URL は `workers_dev` の設定に従い、本番の設定を使う点に注意する。PR コメントの投稿には `permissions: pull-requests: write` が必要。フォークからの PR にはシークレットが渡らないため、プレビューは同一リポジトリのブランチからの PR だけに限る。
- ドメインは `poteto-skills.<subdomain>.workers.dev` で公開する。独自ドメインは使わない（決定済み）。初回デプロイで `https://poteto-skills.lp-poteto-skills.workers.dev` が割り当てられ、その後ユーザーがダッシュボードでサブドメインを `void-technology` に変更した。公開 URL は `https://poteto-skills.void-technology.workers.dev`（§12）。
- ロールバックは `wrangler rollback` を使う。静的アセットも前のバージョンに戻ることを確認済み（§12）。
- 404 ページ: `not_found_handling: "404-page"` は最も近い `404.html` を探す。`scripts/build.mjs` が `build/404.html` を直接出力する（`404/index.html` にはしない）。

`_headers`（フォントを自前配信するため外部ドメインは不要。`markdown()` のコードフェンスを使わないのでインライン `style=` も出ない）:

```
/*
  Content-Security-Policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy: same-origin
/*.css
  Cache-Control: public, max-age=3600
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
```

`connect-src 'self'` はサイト自身は使わないが、Lighthouse の robots-txt 監査がページ内から `/robots.txt` を fetch するため必要（`default-src 'none'` のままでは本番で SEO が 0.92 になった。2026-11-21）。`Cross-Origin-Opener-Policy: same-origin` はセキュリティレビューの提案で追加した。

CSS のハッシュ付け（`style.<hash>.css`）は任意とする。ファイルが 1 つで小さいため、ハッシュなしの `style.css` に `max-age=3600` を付ける（`immutable` にすると更新後も古い CSS が最大 1 年残るため）。ハッシュ付けをするなら `scripts/build.mjs` で行い、HTML 内の参照も同時に生成する。HTML は Cloudflare のデフォルト（再検証）に任せる。

ローカル確認: `npm run e2e` の `cloudflare` プロジェクトが `wrangler dev` で `build/` を配信し、`/`・`/ja/`・404 の CSP・nosniff・Referrer-Policy・COOP、CSP 違反とコンソールエラーが 0 件であること、フォントと CSS の Cache-Control、`/ja` → `/ja/` の 307、`.build-output`・`.assetsignore`・`_headers` が 404 になることを検査する。

### 5.5 不採用とした代替案

- **Astryx**: Phase 0 で不採用（§5.1）。リポジトリの最終コミットが 2021 年で、出力の欠陥を修正する担い手もいないため、再検討しない。
- **既存の静的サイトジェネレーター（Astro、Eleventy など）**: 1 ページ 2 言語に対して依存が過大になるため採用しない。ページ数や言語が増えた場合に再検討する。

## 6. 機能要件

| ID | 要件 |
|---|---|
| F1 | `/` に英語版、`/ja/` に日本語版を表示する。`<html lang>` を正しく設定する |
| F2 | 両ページに `hreflang` の相互リンクと canonical を置く。URL は絶対 URL にする。ベース URL は環境変数 `SITE_URL`（`https://poteto-skills.<account>.workers.dev`。Phase 3 で設定するまでの既定値は仮の `https://poteto-skills.example.workers.dev`）からビルド時に差し込む（`scripts/build.mjs`） |
| F3 | GitHub CTA は `https://github.com/takurot/poteto-skills` へリンクする |
| F4 | インストールコマンドはテキストとして選択、コピーできる。各コマンドにコピーボタンを付ける（決定済み）。JS は外部ファイル 1 つ（`/copy.js`）、1KB 未満、`script-src 'self'` の範囲で動かす。JS が無効でもコマンドは選択・コピーでき、その場合ボタンは表示しない（`hidden` 属性を JS で外す） |
| F5 | 404 ページを VoiceBox のスタイルで用意する |
| F6 | OGP / Twitter Card（タイトル、説明、`og:url`、`og:image`、`og:image:width`・`og:image:height`・`og:image:alt`）を設定する。`og:url` と `og:image` は絶対 URL（F2 の `SITE_URL`）。画像は `/og.png`（1200×630、英語のみで両言語共通）、代替テキストは `meta.og.imageAlt`。`twitter:image` は置かない（X のカード仕様では `twitter:image` がないと `og:image` を使う。実機のカードでは未確認、§12）。全ページ（404 を含む）の `<head>` に `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` を置く |
| F7 | 外部ドメインへのリクエスト（フォント含む）、外部 JS、解析タグ、Cookie は使わない |

## 7. 非機能要件

| 項目 | 基準 |
|---|---|
| パフォーマンス | Lighthouse（モバイル）Performance 95 以上。HTML と CSS の転送量は合計 50KB 未満（gzip、フォント除く） |
| フォント | 自前配信の `woff2`、`font-display: swap`。使うウェイトだけ含める（Archivo Black 400, Work Sans 400/500/700, Space Mono 400）。ファーストビューで使う 2 ファイルだけ `<link rel="preload">` する |
| アクセシビリティ | Lighthouse Accessibility 95 以上。操作要素と本文のコントラストは WCAG AA 以上（`#525252` on `#FAFAFA` は 7.49:1）。赤のホバー配色は §4 の例外条件（16px 太字相当、3:1）で扱う。キーボードだけで全リンクに到達できる |
| SEO | Lighthouse SEO 95 以上。`description` は 160 字以内 |
| レスポンシブ | 360px〜1440px で横スクロールが発生しない |
| 対応ブラウザ | 最新 2 バージョンの Chrome, Safari, Firefox, Edge |

## 8. テストと検証

TDD の対象はビルドの出力物である。先にテストを書き、出力がそれを満たすまで実装する。

| 層 | ツール | 検証内容 |
|---|---|---|
| ビルド出力 | `node --test` | G1〜G7 の検査（doctype、F1・F2・F6 の各タグ、エスケープ、`en.json` と `ja.json` のキー一致、決定的出力、必須キー欠落時の非ゼロ終了、`build/404.html` の存在） |
| HTML 検証 | `html-validate` | 生成した出力でエラー 0 |
| E2E | Playwright | 360px と 1280px で横スクロールなし、CTA のリンク先、言語切替、404、キーボードでのフォーカス移動 |
| デザイン規則 | Playwright と CSS の検査 | 角丸 0、`box-shadow: none`（フォーカス時を除く）。静止状態で 1 ビューポートに赤い要素が 1 つ以下。`style.css` で `--c-accent` を参照するセレクタが許可リスト（Hero の下線、Pull quote、各ボタンのホバー／アクティブ状態）に収まっていること |
| 品質 | Lighthouse CI（`lighthouserc.json`）、`scripts/check-size.mjs` | §7 の閾値。Lighthouse は `wrangler dev` で `build/` を本番と同じ `_headers` 付きで配信し、`/` と `/ja/` をモバイル設定で各 3 回計測する（`minScore` は 3 回の最高値で判定される）。静的サーバーでは CSP が付かず、本番だけで robots-txt 監査が落ちた（§5.4）ため。404 ページは対象外（SEO 監査が非 2xx のステータスを減点する設計で、404 は索引させないページのため。表示とデザイン規則は E2E で検査する）。サイズ検査は `build/` の全 `.html` と `.css` の gzip 合計で、1 ページの転送量より厳しい |
| README 照合 | 定期実行（週 1 回の scheduled workflow） | §2 の数値を README と `marketplace.json` から取得して照合する。README の文面ではなく `marketplace.json` のプラグイン数（`codex-hooks` を除いて 22）や `skills/manifest.json` のような構造化データを優先して読む。差分は Issue として通知し、デプロイは止めない |

デプロイの条件は、ビルド出力、HTML 検証、E2E、デザイン規則、Lighthouse CI の全テストが通ったときだけとする。README 照合は他リポジトリの変更でデプロイが止まらないよう、この条件に含めない。

## 9. 運用

- 数値の更新: §8 の定期照合（`.github/workflows/readme-check.yml`、毎週月曜 03:17 UTC と手動実行）が差分を検知したら Issue を立てる。`site/content/*.json` を直して再デプロイする。
  - 照合は `scripts/readme-check.mjs`（入出力なしの純関数、`tests/build/readme-check.test.mjs`）が行い、`scripts/readme-check-run.mjs` が上流を 1 つのコミットに固定して取得し、Issue を操作する。上流の値は `skills/manifest.json`（Skill 数、既定インストール数、pstack のバージョン）、`marketplace.json`（`codex-hooks` を除くプラグイン名）、README の Contents の「Skills for <host>」行（ホスト数）から取る。各言語の Numbers、プラグイン一覧、数値を繰り返す文（`install.defaultSetNote`、`codex.intro`、`codex.pluginsLabel`、`meta.description`）と比べる。
  - Issue はラベル `readme-drift` で 1 件に保つ。差分が初めて出たら作成し、差分が変わったら本文を更新してコメントし、同じ差分なら何もしない。差分がなくなったらコメントして閉じる。ラベル付きの一覧は作成直後の数秒間は新しい Issue を返さないため、連続実行で重複した場合は最古の 1 件を残して他を閉じる（workflow にも concurrency を設定）。対象は本文に照合の fingerprint を持つ Issue だけで、人がラベルを付けた別の Issue は変更しない。上流の値は形式（整数、`x.y.z`、小文字のケバブケース）を検査してから使い、表のセルはコードスパンに入れてメンションやリンクを無効にする。Issue の操作は `scripts/readme-issue.mjs`（`tests/build/readme-issue.test.mjs` で偽の API を使って検査）。
  - ローカル実行: `GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=takurot/lp_poteto_skills node scripts/readme-check-run.mjs`（`CONTENT_DIR` で別の content を指定できる）。
- 生成系の更新: 依存がないため、Node の LTS 更新に追従するだけでよい。
- ロールバック: `wrangler rollback` で直前のバージョンに戻す（静的アセットの復元は未確認、§12）。確認手順: 変更したアセット（例: `robots.txt` に 1 行足したもの）をコミットせずにビルドしてデプロイし、本番で取得してハッシュを記録する。`npx wrangler rollback` を実行し、同じアセットのハッシュが元に戻ることを確かめる。最後に `main` のビルドを再デプロイする。

## 10. 実装フェーズ

| Phase | 内容 | 完了条件 |
|---|---|---|
| 0 | 完了（2026-11-20）。Astryx スパイクの結果、生成系を Node スクリプトに変更 | [astryx-spike.md](./astryx-spike.md) に記録済み |
| 1 | 骨組み: `build.mjs`、`page.mjs`、`escape.mjs`、`style.css`、`content/*.json`、ビルド出力のテスト（先にテストを書く） | `/` と `/ja/` がローカルで表示され、G1〜G7 のテストが通る |
| 2 | セクション 0〜8 の実装と英日の文言 | E2E とデザイン規則のテストが通る |
| 3 | Cloudflare 設定、`_headers`、GitHub Actions、PR プレビュー、ロールバックの確認 | workers.dev で公開され、Lighthouse CI が通る。`wrangler rollback` で静的アセットも戻ることを確認して記録する |
| 4 | 仕上げ: OGP 画像、404、文言の推敲 | 全受け入れ基準（§6〜§8）を満たす |

## 11. 決定事項

未決事項はない。

1. 独自ドメインは使わない。Cloudflare が割り当てる `poteto-skills.<account>.workers.dev` で公開する（#22）。
2. Hero の見出しは `pstack for Codex`（#23）。ただし README は Claude Code と Codex の両方を対象にしているため、Overline とリード文で Claude Code にも対応することを明記し、見出しだけで対象を Codex に限定しない。
3. コピーボタンを入れる（#24）。`copy.js` を追加し、`site/static/` に置く。

## 12. 確認状況

Phase 0 で確認済み（2026-11-20、詳細は [astryx-spike.md](./astryx-spike.md)）:

1. Astryx は `lexical-core` の更新でビルドできるが、出力 HTML の構造が壊れている。生成系を依存ゼロの Node スクリプトに切り替えることをユーザーが承認した。

Phase 3 で確認済み（2026-11-21）:

1. 初回デプロイ。同名の Worker `poteto-skills` がアカウントにないこと（`wrangler deployments list` が code 10007）を確かめてから、ローカルの OAuth ログインで `wrangler deploy` を 1 回実行した。公開 URL は `https://poteto-skills.lp-poteto-skills.workers.dev`。TLS が有効になるまで約 80 秒かかった。
2. 本番の配信。`/`・`/ja/` が 200、`/ja` が `/ja/` への 307、未知のパスが 404 で 404 ページ、`/robots.txt` が 200。全レスポンスに CSP・nosniff・Referrer-Policy が付き、フォントは `max-age=31536000, immutable`、CSS は `max-age=3600`、HTML は Cloudflare 既定の `max-age=0, must-revalidate`。`/.build-output`・`/.assetsignore`・`_headers` は 404（`.assetsignore` と `_headers` の扱いが本番でも効いている）。`wrangler dev` と同じ結果だった。
3. 本番の Lighthouse（モバイル、各 3 回）で SEO が 0.92 だった。原因は CSP の `default-src 'none'` が robots-txt 監査の fetch を止めたこと。`connect-src 'self'` を追加し、Lighthouse CI を `wrangler dev` 経由に変えた（§5.4、§8）。Accessibility は全回 1.00。Performance は 0.73〜0.98 で、遅い回は TBT が長い（同じマシンで別の処理が動いていた時間帯）。

4. `SITE_URL` の更新と再デプロイ（2026-11-21）。ユーザーがダッシュボードでサブドメインを `void-technology` に変更した。`main` の `7ec505e` からビルドして `wrangler deploy` を実行し、本番は `https://poteto-skills.void-technology.workers.dev`。`/`・`/ja/` が 200、canonical・hreflang・`og:url`・`og:image` が新しい URL になり、CSP に `connect-src 'self'`、`Cross-Origin-Opener-Policy: same-origin` が付いた。`og:image` が指す `/og.png` は 404（Phase 4）。
5. `wrangler rollback` による静的アセットの復元（2026-11-21）。確認用ファイル `rollback-probe.txt` だけを足した 2 つ目のバージョン（`a28bb0bb`）を出すと `/rollback-probe.txt` が 200、直前のバージョン（`edf39fd7`）へ `wrangler rollback` すると 404 に戻った。**静的アセットも前のバージョンに戻る**。反映までの待ちは 8 秒以内だった。確認後の本番は `edf39fd7` で、`main` と同じビルド。

Phase 4 で確認済み（2026-11-21、#20）:

1. `og.png` の生成。`node scripts/generate-og.mjs` が Playwright Chromium で 1200×630 の HTML を描画してスクリーンショットを撮り、`site/static/og.png` に書く。フォントは `site/static/fonts/` の woff2 を data URL で埋め込み、総称フォントへのフォールバックを置かない。フォントが読み込めない場合、文字が画像からはみ出す場合、赤の横棒の外に彩度のある画素がある場合は、PNG を書かずに非ゼロで終了する（文字の色を緑にした試行で 8465 画素を検出して失敗し、PNG は変わらなかった）。新しい依存はない。
2. 画像の中身。黒 `#0A0A0A` の地に `#FAFAFA` の Archivo Black でワードマーク `POTETO-SKILLS` と見出し `pstack for Codex`（2 行に折り返す）、赤 `#EF4444` の横棒 1 本（192×12px）、Work Sans 500 で `Skills for Claude Code & Codex`。画素を数えると、彩度のある画素は 2304 個（192×12）ですべて横棒の範囲にあり、色は `#EF4444` だけだった。文字の切れはない。
3. 配信。`wrangler dev` 上で `/og.png` が 200 `image/png`、`/favicon.svg` が 200 `image/svg+xml`。`/`・`/ja/`・404 の `<link rel="icon">` と、`/`・`/ja/` の `og:image` のパスがどちらも 200（E2E）。HTML+CSS の gzip 合計は 9514 バイト。

Phase 4 のデプロイ確認（2026-11-21）。`main` の `81797e3` からビルドして `wrangler deploy` を実行し、バージョンは `95773df0-b192-4f39-bf97-b50134bfb0c6`。本番で `/`・`/ja/` が 200、`/og.png` が 200 `image/png`（38826 バイトで、ビルドしたファイルとハッシュが一致）、`/favicon.svg` が 200 `image/svg+xml`、未知のパスが 404。`/` の HTML に `<link rel="icon">`、`og:image`（絶対 URL）、`og:image:width`・`height`・`alt` が出ている。これで `og:image` の 404 は解消した。

Phase 4 の受け入れ確認（2026-11-21、#21）。結果は `main` の `c4aadca` に #20、#21 の変更を載せたビルドで取った。

1. 文言の推敲。上流の `README.md`・`README_JP.md`・`skills/manifest.json`・`marketplace.json` と全文を突き合わせた。数値、コマンド、フラグ、プラグイン名、ライセンス表記に誤りはなかった。直したのは、README が言っていないことを言っていた 3 点（既定のインストールを「全 Skill」とした、Canvas のフォールバックを実行時の動作として書いた、codex-hooks の有効化手順が抜けていた）と、日本語の言い回し（「Skills」と「Skill」の混在、「upstream」と「上流」の混在、リード文）。`og:title` は Hero 見出しに合わせたままにした。`meta.description` は英語 136 字、日本語 101 字。
2. §1 の成功基準。(1) 10 秒で分かるかは、Overline「CURSOR PLUGINS → CLAUDE CODE & CODEX」とリード文を読んだ判断で、計測していない。(2) インストールへの到達は Playwright で計測した。最初のコマンドの下端は 360×640 で 1012px、360×800 で 1012px、1280×800 で 952px。360×640 でも最初のコマンドまでのスクロールは 372px で、1 画面の高さ（640px）より短い。最後のコマンドまででも 489px で 1 画面に収まる。(3) 主要 CTA は両ページとも `btn-primary` が 1 つ（「View on GitHub」「GitHub で見る」）。ヘッダーとフッターの GitHub リンクは Ghost ボタン。
3. §6 の F1〜F7 は、`npm test`（139 件）と `npm run e2e`（49 件）が全件通っている。F2・F6 は `SITE_URL` から作った絶対 URL を `output.test.mjs` が検査する。
4. §7。Lighthouse（モバイル、`wrangler dev` 経由、`/` と `/ja/` を各 3 回）は Performance、Accessibility、SEO、Best Practices がすべて 1.00。HTML+CSS の gzip 合計は 9372 バイト（上限 51200）。`html-validate` はエラー 0。
5. §8 の README 照合（`readme-check-run.mjs`、上流 `17e42df`）は差分 0。

Phase 4 でも未確認の項目:

1. 対応ブラウザ（Safari、Firefox、Edge）での表示。Chromium だけで検査している。
2. 日本語文言のネイティブによる確認。上流 README_JP との突き合わせと機械的な検査まで。

Phase 4 で未確認:

1. SNS のカード表示（X、Facebook、Slack などのプレビュー）。本番へのデプロイ前で、外部のカード確認ツールからこの環境の成果物を読めないため確認していない。デプロイ後に `https://poteto-skills.void-technology.workers.dev/` をカード確認ツールに通し、ここに記録する。

Phase 3 で未確認（ユーザーの判断待ち）:

1. API トークンの必要最小権限。トークンが存在せず、作成もしていない。ユーザーが Workers Scripts: Edit だけのトークンを作り、[deploy.md](./deploy.md) のとおり GitHub Secrets に入れて `main` に push し、`deploy` ジョブが失敗したらエラーに出た権限を足して、ここに記録する。
2. PR プレビュー（`wrangler versions upload` とコメント）。シークレットが入るまで実行されない。

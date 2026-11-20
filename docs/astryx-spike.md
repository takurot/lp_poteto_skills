# Astryx スパイク結果（Phase 0）

- 実施日: 2026-11-20
- 対象: `monomadic/astryx` コミット `89f7302`、rustc 1.92.0（macOS）
- 作業場所: セッションのスクラッチパッド（プロジェクトには含めない）

## 結論

**A1〜A3 は満たせるが、出力 HTML の構造が壊れている（`<body>` が `<head>` の中に入る）。ポストビルドで直すには出力の再構成が必要で、SPEC §5.2 の判定ルールに従い、フォールバック（素の静的 HTML 生成）を推奨する。** 切り替えはユーザーの承認待ち。

## 要件ごとの結果

| ID | 結果 | 根拠 |
|---|---|---|
| A1 ビルド | 条件付きで合格 | `cargo build --release --locked` は失敗する（`lexical-core 0.7.4` が `usize`/`u32` の型不一致で 27 件のエラー）。`cargo update -p lexical-core`（0.7.6）後は成功（10.8 秒）。`nom-indent` は git 依存で、取得には `CARGO_NET_GIT_FETCH_WITH_CLI=true` が必要だった |
| A2 `/` と `/ja/` | 合格（条件付き） | 英語版を単一のトップレベル `%html`、日本語版を `for` の中の `@route path=meta.route` にすると `build/index.html` と `build/ja/index.html` が出る。`path` はリテラル（`path="ja"` / `path=ja`）では `variable path not found` になり、frontmatter 経由の変数でのみ動く |
| A3 head 内の要素 | 部分合格 | `%meta { charset: "utf-8" }`、`%title`、`%link` は書ける。ただし下記の構造バグがある |
| A4 エスケープ | 不合格 | `%h1 Hello & <b>` が `<h1>Hello & <b></h1>` とそのまま出力される |
| A5 `pre`/`code` | 合格 | `<pre><code>git clone x</code></pre>` |
| A6 frontmatter | 合格（文字列のみ） | `meta.title`、`meta.route` を読めた。数値・配列は未対応（ソースで確認済み） |
| A7 HTML 検証 | 未実施（不合格が確実） | 下記の出力欠陥のため |

## 出力の欠陥（実測）

最小サイトの出力:

```html
<html><head><meta charset="utf-8"></meta><title>poteto</title><body><h1>Hello & <b></h1><pre><code>git clone x</code></pre></body></head></html>
```

1. `<head>` が閉じられず、`<body>` が `<head>` の子になる（`</head>` が末尾に出る）。upstream の blog 例の出力でも同じ。
2. `<!doctype html>` がない。
3. `<meta>` に `</meta>`、`<link>` に `</link>` が付く。
4. テキストと属性値がエスケープされない。
5. upstream の blog 例では `<h1>second post<h1>second page</h1>…</h1>` のように、`meta.title` の後で `h1` が壊れる。
6. 失敗時も終了コードは 0（パースエラー、`variable path not found`、出力ディレクトリ欠落のいずれでも）。
7. `-o` に絶対パスを渡すと、出力ディレクトリが作られず書き込みに失敗する。相対パスでは動く。
8. `for` の対象は `./dir/*.md` のようなグロブのみ。単一ファイルを指定すると `Unexpected` でパースエラーになる。

## ポストビルドで補う項目（判定ルール §5.2 の適用）

doctype の付与、void 要素の閉じタグ削除、`<head>`/`<body>` の再構成、エスケープの検査、属性順の整列、`data-*`/`aria-*` の差し込み、404 の配置。**3 項目を超え、`<head>`/`<body>` の再構成は出力の意味を書き換える処理**になるため、「補うコードが 100 行を超える、または出力の意味を書き換える処理が必要な場合はフォールバックを推奨」に該当する。

## 次の判断

- 推奨: フォールバック。`site/content/*.md`、`style.css`、ホスティング、テストは SPEC のまま、生成系だけ小さな Node スクリプトにする。
- Astryx を続ける場合: `postbuild.mjs` で HTML を再構成する。ただしこの出力を正としてテストを書くと、Astryx のバグを仕様として固定することになる。

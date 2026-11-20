# 実装ルール

対象は poteto-skills のランディングページ（静的サイト、Cloudflare Workers Static Assets で配信）。
仕様は [docs/SPEC.md](docs/SPEC.md)、デザインは [docs/voicebox-DESIGN.md](docs/voicebox-DESIGN.md) が正。

Claude Code / Codex は、以下の6ステージで作業する。
`AGENTS.md` と `CLAUDE.md` は同じ内容を保ち、変更時は両方を更新する。
通常の実装依頼はPR作成とレビュー・改善まで進める。ユーザーが作業範囲を限定した場合は、その指定を優先する。

## 技術スタック

- 生成系は依存ゼロの Node スクリプト（Node 22、`node:fs` / `node:path` のみ）。Astryx は Phase 0 で不採用（[docs/astryx-spike.md](docs/astryx-spike.md)）。再検討しない。
- `dependencies` は空に保つ。`devDependencies` はテストと検証（`wrangler`、`@playwright/test`、`html-validate`、Lighthouse CI）だけにする。
- コンテンツは `site/content/{en,ja}.json`、テンプレートは `site/templates/` の純関数、出力は `build/`（コミットしない）。
- 補間はすべて `esc()` を通す。生HTMLを埋め込む場所を作らない。出力は決定的にする（現在時刻・乱数を使わない）。
- デザインは VoiceBox（角丸0、`box-shadow: none`、アクセント赤は静止状態で1ビューポートに1要素以下）。規則はテストで検査する。
- SPEC §5.4 のとおり `wrangler.jsonc` を置くため、Cloudflare の操作は Wrangler で行う（`cf` CLI は Wrangler 設定のないプロジェクト向け）。

## 作業の共通ルール

- `git status` で既存差分を確認し、他の作業を保持する。1タスクにつき1ブランチ・1 worktree を基本とする。
- 通常の新規作業は、このforkの最新 `main` を基点にする。remote名だけで対象を判断せず、接続先を確認する。
- Scheduler管理のworktreeでは、用意されたブランチで作業し、main同期やブランチ切り替えを行わない。
- 既存の固定ツールチェーンとlockfileを使い、無関係な依存更新を混ぜない。
- 一時的な作業スペースは /Volumes/Storage/private を使うこと。/private はディスクスペースを逼迫させるので使わない。
- LPに載せる数値（プラグイン数など）は SPEC §2 の出典に従う。出典のない数値を書かない。

## 1. 仕様プランニング

- Issue・依頼、README、`docs/SPEC.md`、実装、テストを読み、要件と矛盾を確認する。矛盾は推測で解消しない。
- 変更範囲・対象外・依存関係・設計・受け入れ条件・テスト方針を、既存の仕様文書または作業計画にまとめる。
- 複雑な計画は planner、設計判断は architect のサブエージェントを活用し、実装を小さな手順に分ける。

## 2. サブエージェントによる仕様レビュー

- 仕様の作成者とは別のサブエージェントに、要件の漏れ・設計の妥当性・安全性・テスト可能性をレビューさせる。
- 妥当な指摘を仕様へ反映し、再レビューする。不採用の指摘には根拠を残す。
- 妥当な未解決指摘がなくなってから、TDD実装へ進む。

## 3. TDD実装（Red → Green → Refactor）

- tdd-guide と進め、受け入れ条件を示すテストを先に書き、意図した理由で失敗することを確認する（Red）。
- テストを通す最小限の実装を行う（Green）。責務・重複・命名を整理し、再度テストを通す（Refactor）。
- TDDの対象はビルド出力物。ビルド出力（`node --test`）、HTML検証、E2E（Playwright）、デザイン規則の該当層で正常系と重要な異常系を検証する。
- 入力（`site/content/*.json`）は境界で検証し、欠落・未知のキーは非ゼロ終了にして出力を書かない。更新は新しい値として組み立てる。
- 秘密情報（APIトークン、アカウントID）をコード・ログ・fixture・workflowへ残さない。CI の資格情報は GitHub Secrets から渡す。
- 部分成功・検証不能を成功扱いしない。デプロイ後はURLへ実際にアクセスして結果を確認する。
- 挙動変更と同時に関連文書（SPEC、README）を更新する。文書のみの変更では実行時テストを増やさず、内容・リンク・差分を確認する。

## 4. 検証・品質ゲート

- まず対象テストを実行し、コード変更のPR前には以下と、変更領域に対応するCIチェックを実行する。未導入のツールは導入フェーズ（SPEC §10）に従い、未実行を成功扱いしない。

```sh
npm test                   # node --test: ビルド出力・content検査
npm run build              # build/ を生成
npx html-validate build/   # 出力HTMLのエラー0
npx playwright test        # 360px / 1280px、リンク、言語切替、404、デザイン規則
npx lhci autorun           # Lighthouse CI（SPEC §7 の閾値）
```

- Lighthouse（モバイル）は Performance・Accessibility・SEO 95以上、HTML+CSS は gzip で50KB未満を維持する。計測結果を記録し、未計測を達成済みと表現しない。
- 依存変更ではlockfileの差分と脆弱性（`npm audit`）を確認する。デプロイ設定の変更は `wrangler deploy --dry-run` で検証する。
- 失敗は修正して再検証する。実行できない検証は理由と未確認範囲を記録し、skipや環境制約による失敗をPASSと報告しない。

## 5. コミット・push・PR作成

- `git diff --check` と差分レビューを行い、秘密情報や無関係な変更（`build/`、`node_modules/`、`.wrangler/`）がないことを確認する。
- 対象ファイルだけをstageし、`<type>: <description>` 形式でコミットする。
- 接続先・作業ブランチ・送信する差分を確認してpushする。mainへの直接pushやforce pushは行わない。
- 必要な検証が成功してからPRを作成する。環境依存の未検証事項が残る場合はdraftとし、完了扱いしない。
- PRには対応Issue、変更内容と理由、受け入れ条件の充足、検証結果、デザイン規則・公開内容への影響、未検証事項を記載する。

## 6. サブエージェントによるPRレビュー・改善ループ

- 実装者とは別の code-reviewer サブエージェントに、最新PR headの差分・仕様・受け入れ条件・検証結果をレビューさせる。
- セキュリティに関わる変更（workflow、シークレット、`_headers`、CSP、外部リンク）は security-reviewer にも依頼する。サブエージェントのレビューはGitHub上の承認や必須CIの代わりにしない。
- 指摘を仕様・再現手順・テストで確かめ、妥当な指摘を修正する。不採用の指摘には根拠を残す。
- 修正 → 必要なテスト・品質ゲートの再実行 → コミット・push → 最新headの再レビューを繰り返す。仕様が変わる場合はステージ1・2へ戻る。
- 妥当な未解決指摘がなく、最新headで必要な品質ゲートと必須CIが成功したら、レビュー待ちの成果としてPRと検証結果を報告する。
- merge・release・deployはこのフローに含めず、別途明示された場合だけ行う。`main` へのmergeは本番デプロイを起動するため、特に区別する。PR作成とmerge完了も区別する。

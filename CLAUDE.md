# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 共通ルール

このリポジトリは `allhyper/ai-rules` の共通ルールに従う：
https://github.com/allhyper/ai-rules/blob/main/CLAUDE_RULES.md

特に守ること（共通ルールの要点）：

- 目的達成を優先し、問題が起きても原因調査 → 仮説 → 検証 → 修正で自分で前に進める
- 削除・本番変更・外部サービスへの書き込み・`git push` は事前にオーナーへ確認する
- 削除より隔離を優先する。README / CLAUDE.md / docs は削除しない
- API キーなどの秘密情報はファイルに書かない（`.env` に置き、Git に入れない）
- 報告は結論から。オーナーに求めるのは方針・優先順位・公開・予算・リスクの判断だけ


## Project Overview

LimitBreaker is a mobile-first Progressive Web App (PWA) for tracking weightlifting sessions and body composition. The UI is in Japanese. There is no build step — the entire app lives in a single HTML file.

## Running Locally

The app files live at the repository root (`index.html`, `sw.js`, `manifest.json`, `icons/`, `sounds/`). Serve the root over HTTP (HTTPS required in production for Service Worker):

```bash
python -m http.server 8000
# Then open http://localhost:8000
```

Production is GitHub Pages at path `/limitbreaker/`.

## Architecture

The entire app is `index.html` (~3600 lines). It is a zero-dependency SPA with three conceptual layers all in that one file:

**Data layer** — a LocalStorage wrapper using the `il11_` key prefix. All persistence goes through this. Key storage objects:
- `il11_settings` — unit (kg/lb), equipment weights, timer preferences, height
- `il11_masterDB` — exercise library (array of exercise objects)
- `il11_routines` — workout templates
- `il11_records` — completed workout sessions
- `il11_bodyData` — body composition entries
- `il11_goalText` — goal text
- `il11_schemaVer` — schema version (see データ保護ルール)

**UI rendering layer** — each screen is rendered by a dedicated function:
- `renderHome()`, `renderSession()`, `renderStats()`, `renderBody()`, `renderCal()`, `renderDBList()`, `renderSettings()`

**Interaction layer** — event handlers for session lifecycle, timers, CSV export/import, and navigation.

Navigation is tab-based. Screens are HTML elements with IDs like `sc-home`, `sc-session`, `sc-stats`, etc.

## Key Data Shapes

```js
// Exercise in masterDB
{ id: 'm1', n: 'ベンチプレス', m: 'Chest', sets: 4, reps: '6–8', weight: 80, restSec: 120, i: 'high', equip: 'barbell' }

// Completed workout record
{ _id: 'r<random>', date: ISO, name: 'Push Day', start: timestamp, elapsed: minutes, totalVol: kg,
  exercises: [{ id, n, m, sets: [{ kg, reps, cheat, assist, note, posNeg }], equip, note }] }

// Body composition entry
{ date: ISO, wt: 75.5, bf: 15.2, mm: 65, waist: 82, memo: '' }
```

## Service Worker & Caching

`sw.js` uses a network-first strategy. The cache version is `CACHE_VERSION` (currently `lb-v30`). When updating the app, bump this version string so clients pick up new files.

## Deployment

The app is deployed at path `/limitbreaker/` (set in `manifest.json` `start_url` and `scope`). When deploying an update, increment `CACHE_VERSION` in `sw.js`.

## Calculations

- **1RM estimate**: `weight × (1 + reps / 30)`
- **Recommended load**: Hypertrophy = 80% 1RM, Strength = 85% 1RM
- **Total volume**: sum of `weight × reps` across all sets (configurable to include/exclude cheat and assist reps)
- **Unit conversion**: 1 kg = 2.20462 lb

## 運用ポリシー
- Claude=設計・原因分析・レビュー担当
- Codex=実装担当
- フロー：Codexで作る→Claudeで点検→Codexで修正→人間が採用判断

## Codexへの指示テンプレート

```
現在のmainブランチのindex.htmlを必ず最初に全文読み込んでください。
過去の変更内容や以前のブランチは使わず、今のmainを基準に修正してください。
修正は今回の指示範囲だけに限定してください。
---
【修正内容】
【制約】
- 単一HTMLファイル構成を維持すること
- テンプレートリテラル内の文字列はダブルクォートのみ（シングルクォート不可）
- 修正後にJSの構文チェックを実施し、エラーがないことを確認
- 上記以外の変更は一切行わないこと
```

## データ保護ルール（最重要 / 既存ユーザーのデータを守る）

本アプリはGitHub Pagesで公開済みで実ユーザーが存在する。更新でユーザーのLocalStorageデータを失わせないため、以下を厳守する。

### 絶対にやってはいけない4点
1. `il11_` プレフィックスを変更しない（変更すると既存データが全て参照不能＝実質消失）
2. 保存キー名（`settings`/`masterDB`/`routines`/`records`/`bodyData`/`goalText`/`schemaVer`）をリネームしない
3. 起動時にユーザーデータを無条件で上書きしない（読み込みは必ず `S.get(k) || default` 形式を維持）
4. データ構造に新フィールドを追加する際、旧データに当該フィールドが無い前提のコードを書かない（必ずデフォルト補完する）

### データ安全層（実装済み・index.html 先頭の STORAGE 直後）
- `SCHEMA_VER`：スキーマ版番号。**データ構造を変更したら必ずインクリメントする。**
- `_dataSafety()`：起動時に「データ有り かつ 版が変わった」場合のみ、変換前の生データを `il11_backup_<timestamp>` に自動退避（最新3世代を保持）。削除は一切しない。
- 設定読み込みは `Object.assign({}, DEFAULT_SETTINGS, 保存値)`：既存値を優先しつつ新規フィールドのみ補完（非破壊）。
- 緊急復旧：ブラウザのコンソールで `LB_listBackups()` で一覧、`LB_restoreBackup("il11_backup_xxx")` で復元。

### スキーマ変更時の手順
1. データ構造を変更する前に `SCHEMA_VER` を +1。
2. 旧データを新構造へ変換する処理は「不足分を補完するのみ・既存値とレコードは削除しない」前方互換で書く。
3. 編集後は必ずJS構文チェック（`node --check`）と、新規ユーザー／既存ユーザー双方の起動シミュレーションで検証する。

### 編集方法に関する注意
- index.html は大きく特殊文字を含むため、**Python のバイト単位置換（`open` を `rb`/`wb`）が確実**。Edit系ツールは末尾切り詰めを起こした実績があるため、編集後は必ず行数・バイト数・末尾が `</html>` であることを確認する。

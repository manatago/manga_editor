---
name: electron-manga
description: 漫画野郎の Electron メイン・プリロード・画像パス・IPC・D&D を変更するとき。local-file とプロジェクト資産の安全な扱い。
---

# Electron / 資産 / IPC（漫画野郎）

## このスキルを使うとき

- `src/main/index.ts` / `src/preload/index.ts` を編集するとき
- 画像の読み込み・コピー・削除、`export-png`、`copy-file-to-project` など **IPC** を追加・変更するとき
- レンダラーで **`window.electron`** を呼ぶ処理（パス・ファイル選択）を触るとき

## local-file プロトコル

- ローカル画像は **ブラウザの `file://` 直読みに頼らず**、プリロードの `pathToUrl` が `local-file://` に変換する想定
- メインで `protocol.handle('local-file', ...)` が `net.fetch(pathToFileURL(...))` で応答する

### ルール

- 画像を表示するパスは、**プロジェクト内の `assets/` 配下にコピーした**後のパスを `manga.json` に保存する（`copyFileToProject`）
- **既定の取り込み先**は `assets/images/`（第3引数省略時）。参照キャラ・背景ライブラリは `assets/references/...`（詳細は `src/renderer/src/utils/assetsLayout.ts` とメインの `src/main/assetsLayoutRoot.ts`）
- 表示時は `resolveAssetPath(projectRoot, stored)` で実パスに解決し、続けて `window.electron.pathToUrl(...)` を通す（旧 `assets/workspace/` などは存在すればフォールバック）

## プロジェクトパス

- メインの IPC では **`trim()`** したパスを使う（末尾スペースで保存失敗するのを防ぐ）
- プロジェクトフォルダ構成: `manga.json`、`assets/`（**直下はフォルダのみ**）、`exports/`（作成時にメインが作る）
- **`assets/` 直下の3フォルダ**: `images`（＋ `images/composite`）、`dust`（整理退避）、`references`

## ドラッグ＆ドロップ

- ブラウザの `File.path` に依存しない。**Electron の `webUtils.getPathForFile(file)`**（プリロードで `getPathForFile` として公開）を使う
- ドロップ後は `copyFileToProject` で **`assets/images/`** に取り込み、JSON には**プロジェクトルートからの相対パス**（例 `assets/images/...`）を保存する

## 未使用整理と IPC 名

- UI 上は **`assets/dust/`** へ移動（削除しない）。IPC は歴史的に `move-asset-to-trash` のまま。メイン・文言を変えるときは `projectSlice` / `SidebarLeft` と揃える

## ログ

- プリロードで `console.error` / `console.warn` を IPC 経由でメインに送り、ターミナルに出す仕組みがある
- ユーザー通知は `alert` ではなく、`showMessage` / `confirmMessage` の IPC 経由で Electron ダイアログを使う方針

## 終了直前の保存 flush

- デバウンス保存だけでは終了直前に取りこぼすことがあるため、`beforeunload` から呼べる **同期保存 IPC**（`saveProjectSync`）を用意する。
- 同期保存は通常フローでは使わず、終了時の最終 flush に限定する。

## 新しい IPC を足すとき

- **preload の `contextBridge`** にメソッドを追加し、型は `src/renderer/src/env.d.ts`（または同等）で `Window` を拡張する
- メインで `ipcMain.handle`、レンダラーは `window.electron.xxx` 経由に統一する

## 既存プロジェクトのフォルダ移行

- **`scripts/migrate-assets-layout.mjs`** … `assets/workspace` の解体、`images` / `dust` / `references` への振り分けと `manga.json` のパス書き換え

## 配布ビルドと rembg 同梱

- **`npm run dist`** … rembg の venv は同梱しない（軽量）。ユーザが rembg を別途入れている必要がある。
- **`npm run dist:with-rembg`** … `bundle-rembg` 後にビルドし rembg を同梱（容量大）。
- ユーザーが「ビルド」「dist」とだけ言った場合のエージェント手順は **`.cursorrules` の「配布ビルド（dist）」** に従い、**どちらでビルドするか確認してから**実行する。

## 参照

- IPC 一覧・保存形式: `.spec/manga-editor.md` の「ファイル・IPC」
- 定数の単一ソース: レンダラー `utils/assetsLayout.ts`、メイン `main/assetsLayoutRoot.ts`（renderer を main から import しない）
- 配布コマンドの使い分け: ルートの `.cursorrules`（配布ビルド）

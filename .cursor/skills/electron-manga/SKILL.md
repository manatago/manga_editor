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

- 画像を表示するパスは、**プロジェクト内の `assets/` にコピーした**後のパスを `manga.json` に保存する（`copyFileToProject`）
- 表示時は `window.electron.pathToUrl(path)` を通す（既存コンポーネントのパターンに合わせる）

## プロジェクトパス

- メインの IPC では **`trim()`** したパスを使う（末尾スペースで保存失敗するのを防ぐ）
- プロジェクトフォルダ構成: `manga.json`、`assets/`、`exports/`（作成時にメインが作る）

## ドラッグ＆ドロップ

- ブラウザの `File.path` に依存しない。**Electron の `webUtils.getPathForFile(file)`**（プリロードで `getPathForFile` として公開）を使う
- ドロップ後は `copyFileToProject` で `assets/` に取り込み、JSON にはその**絶対パス**を保存

## ログ

- プリロードで `console.error` / `console.warn` を IPC 経由でメインに送り、ターミナルに出す仕組みがある
- デバッグ時は重要な失敗を `console.error` または `alert`（既存のユーザー向け）で残す

## 新しい IPC を足すとき

- **preload の `contextBridge`** にメソッドを追加し、型は `src/renderer/src/env.d.ts`（または同等）で `Window` を拡張する
- メインで `ipcMain.handle`、レンダラーは `window.electron.xxx` 経由に統一する

## 参照

- IPC 一覧・保存形式: `.spec/manga-editor.md` の「ファイル・IPC」

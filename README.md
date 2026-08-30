# askdkc.github.io

Astroで生成する、Markdown中心の個人ブログです。公開サイトは
<https://askdkc.github.io> です。

## 開発

Node.js 22.12.0以上を用意してから依存関係をインストールします。

```sh
npm ci
npm run dev
```

ブラウザで`http://localhost:4321`を開くと開発サーバーを確認できます。

```sh
npm test
npm run check
npm run build
npm run verify:build
npm run preview
```

`npm run content:convert`はOrg-modeのソースをAstro用Markdownへ変換します。
変換元は`content/org/`、生成先は`src/content/posts/org/`で、生成先はGit管理しません。

## 記事を書く

通常の記事は`src/content/posts/`にMarkdownファイルとして追加します。
frontmatterでは少なくとも`title`、`pubDate`、`slug`を指定します。

```yaml
---
title: "記事のタイトル"
description: "記事の概要"
pubDate: 2026-08-30
tags: [notes]
draft: false
slug: "notes/example"
---
本文。
```

`draft: true`の記事はローカル開発中は表示されますが、本番サイトとRSSには含まれません。

Org-modeを使う場合は`content/org/**/*.org`に置き、`#+TITLE`と`#+DATE`を必ず指定します。
対応するメタデータは`#+TITLE`、`#+DATE`、`#+DESCRIPTION`、`#+AUTHOR`、
`#+FILETAGS`、`#+KEYWORDS`、`#+SLUG`、`#+DRAFT`です。見出し、リンク、リスト、
強調、画像リンク、`#+BEGIN_SRC`コードブロックを限定的に変換します。

## 公開

`main`へのpushで`.github/workflows/deploy.yml`がテスト、型検査、静的ビルド、
生成物検査を実行し、成功時にGitHub Pagesへデプロイします。Pull Requestでは
デプロイせず、検証だけを実行します。

リポジトリのGitHub Pages設定で、Sourceを**GitHub Actions**に変更してください。

## サポート

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/X7X8O7KCU)

[![](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86)](https://github.com/sponsors/askdkc)

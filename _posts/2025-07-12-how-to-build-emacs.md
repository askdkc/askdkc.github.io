---
layout: post
title: "How to build Emacs from source"
categories: 
- emacs
author:
- dkc
---

Emacsをソースからビルドする方法

## まずはソースのダウンロード

まずは[Gnu Emacs](https://www.gnu.org/software/emacs/download.html)からソースをダウンロード

## ソースからビルド
コメント部分はmacOS向け
```bash
  tar zxvf emacs-xx.tar.gz

  cd emacs-xx

  ./autogen.sh

  ./configure \
      -with-pgtk \
      -with-cairo \
      -with-modules \
      -with-harfbuzz \
      -with-compress-install \
      -with-threads \
      -with-included-regex \
      -with-zlib \
      -with-imagemagick \
      -with-mailutils \
      -prefix=/usr/local

  make -j$(nproc)
  # if it fails use
  # make bootstrap -j$(nproc)

  sudo make install

  ## This is only for macOS
  ## cp -a nextstep/Emacs.app /Applications/
```

簡単🎉

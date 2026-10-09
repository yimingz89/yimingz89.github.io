# Vendored pinyin support

`pinyin-pro-3.29.4.mjs` is a minified browser ESM bundle of the `pinyin` export
from [pinyin-pro 3.29.4](https://github.com/zh-lx/pinyin-pro), by zh-lx.
Its [MIT license](./pinyin-pro-LICENSE.txt) is included beside it.
It is served from this site; the reader makes no CDN or remote pinyin request.

- Package: `https://registry.npmjs.org/pinyin-pro/-/pinyin-pro-3.29.4.tgz`
- Package integrity: `sha512-SPXpDT2cHEy+d26V1RXYMlVzXN42hotFAak1fzyWPi4o2dKXb61UqD4pzxDJHwk6gbv8vQ6EfErd+hYX0Qhzug==`
- Bundler: esbuild 0.28.2
- Bundle SHA-256: `b63a6e051ea848ff0645068da13c5f8e45578ec50ab6dd65c35998760b10b8e3`
- Bundle size: 302,241 bytes before compression

To reproduce, install exact versions `pinyin-pro@3.29.4` and `esbuild@0.28.2`
in a temporary directory (not the application), then run its esbuild binary
against `node_modules/pinyin-pro/dist/esm/core/pinyin/index.mjs` with:

```text
--bundle --format=esm --minify --charset=utf8 --target=es2020
--banner:js=/*! pinyin-pro 3.29.4 | MIT | Copyright (c) 2022-present zh-lx | See pinyin-pro-LICENSE.txt */
--outfile=reader/vendor/pinyin-pro-3.29.4.mjs
```

Quote the entire banner option when using a shell. The bundle has not otherwise
been modified. App-specific corrections for 身处/身處 and 方便地 followed by
an explicitly listed common verb (for example, 办理 or 使用) are documented in
`reader/pinyin.mjs`, not patched into this vendor file. The latter corrects the
adverbial particle to `de`, without rewriting noun readings such as 地方 or 地理.
It deliberately does not guess from 方便地 alone or an arbitrary following Han
character, which could cross a noun boundary.

The wrapper uses the full article before slicing the requested selection,
enabling phrase-level polyphone choices even when just one character is selected.
It uses lexical tones (`toneSandhi: false`), retaining `yī` and `bù` rather than
their spoken tone-sandhi variants. This is phrase-dictionary disambiguation,
not general semantic reasoning; unfamiliar names and ambiguous wording may
still need a dictionary check. Unknown characters remain visible without a
guessed pronunciation.

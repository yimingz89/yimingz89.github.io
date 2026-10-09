import { pinyin } from './vendor/pinyin-pro-3.29.4.mjs';

const MAX_CONTEXT_LENGTH = 30000;
const HAN = /\p{Script=Han}/u;
const CONVENIENTLY_VERBS = new Set(['办理', '使用', '获取', '访问', '了解', '查询', '找到', '完成', '进行', '阅读']);
let cachedText = null;
let cachedCharacters = [];

const isBoundary = (text, offset) => !(offset > 0 && offset < text.length &&
  /[\uD800-\uDBFF]/u.test(text[offset - 1]) && /[\uDC00-\uDFFF]/u.test(text[offset]));

function readArticle(text) {
  if (text === cachedText) return cachedCharacters;
  const characters = [];
  let offset = 0;
  // Resolve phrases in the complete article before cropping a selection. Keep
  // dictionary (lexical) tones for 一/不, as in the reader's dictionary panel.
  for (const item of pinyin(text, { type: 'all', toneType: 'symbol', toneSandhi: false, nonZh: 'spaced' })) {
    const end = offset + item.origin.length;
    let pronunciation = item.isZh && HAN.test(item.origin) ? item.pinyin : '';
    // The bundled phrase list misses 身处. Its verb is chǔ, not the default
    // place-noun chù. Verified against this app's CC-CEDICT entry and MDBG:
    // https://www.mdbg.net/chinese/dictionary?page=worddict&wdqb=身处
    if ((item.origin === '处' || item.origin === '處') && text[offset - 1] === '身') pronunciation = 'chǔ';
    // The default also misses the adverbial marker in 方便地办理, etc. Limit
    // this correction to known verb continuations: 地 must stay dì in nouns
    // like 地方/地理, including the ambiguous substring 方便地方. This is not
    // a global grammatical rule for 地 or a guess from an isolated character.
    if (item.origin === '地' && text.slice(offset - 2, offset) === '方便' &&
      CONVENIENTLY_VERBS.has(text.slice(end, end + 2))) pronunciation = 'de';
    characters.push({ start: offset, end, text: item.origin, pinyin: pronunciation });
    offset = end;
  }
  cachedText = text;
  cachedCharacters = characters;
  return characters;
}

/**
 * One entry per source code point, with absolute UTF-16 offsets and a contextual
 * syllable. Punctuation, Latin text, and unknown Han keep their text with empty
 * pinyin. Whole-article lexical phrase matching is local, not semantic/LLM
 * understanding; names and genuinely ambiguous sentences may need checking.
 *
 * Only the last article is cached, bounded by the reader's 30,000-character
 * limit. Returned entries are copies so callers cannot corrupt that cache.
 */
export function getContextPinyin(text, start = 0, end = typeof text === 'string' ? text.length : 0) {
  if (typeof text !== 'string' || text.length > MAX_CONTEXT_LENGTH ||
    !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > text.length ||
    !isBoundary(text, start) || !isBoundary(text, end) || start === end) return [];
  return readArticle(text).filter((character) => character.start >= start && character.end <= end)
    .map((character) => ({ ...character }));
}

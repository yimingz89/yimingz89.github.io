export const MAX_TEXT_LENGTH = 30000;
export const MAX_SELECTION_LENGTH = 120;
export const hasHan = (text) => /\p{Script=Han}/u.test(text);

export function pinyinMarks(text) {
  const tones = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
  return text.replace(/u:|v/gi, (x) => x === x.toUpperCase() ? 'Ü' : 'ü')
    .replace(/([a-zü]+)([0-5])/gi, (_, syllable, number) => {
      const tone = Number(number);
      if (!tone || tone === 5) return syllable;
      const lower = syllable.toLowerCase();
      let index = lower.indexOf('a');
      if (index < 0) index = lower.indexOf('e');
      if (index < 0 && lower.includes('ou')) index = lower.indexOf('o');
      if (index < 0) for (let i = lower.length - 1; i >= 0; i--) if (tones[lower[i]]) { index = i; break; }
      if (index < 0) return syllable + ['', '\u0304', '\u0301', '\u030c', '\u0300'][tone];
      let vowel = tones[lower[index]][tone - 1];
      if (syllable[index] !== lower[index]) vowel = vowel.toUpperCase();
      return syllable.slice(0, index) + vowel + syllable.slice(index + 1);
    }).normalize('NFC');
}

export class Dictionary {
  constructor(rows, { useSegmenter = true } = {}) {
    this.words = new Map();
    this.maxLength = 1;
    for (const [simplified, numbered, meanings, traditional] of rows) {
      const entry = { pinyin: pinyinMarks(numbered), numbered, meanings: meanings.split('/'), traditional };
      if (!this.words.has(simplified)) this.words.set(simplified, []);
      this.words.get(simplified).push(entry);
      this.maxLength = Math.max(this.maxLength, simplified.length);
    }
    // Prefer a general lexical reading over a surname-only entry; keep all readings.
    for (const entries of this.words.values()) entries.sort((a, b) => Number(/^[A-Z]/.test(a.numbered)) - Number(/^[A-Z]/.test(b.numbered)));
    this.segmenter = useSegmenter && typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('zh-CN', { granularity: 'word' }) : null;
  }
  lookup(text) { return this.words.get(text) || []; }
  fallback(text, offset = 0) {
    const result = [];
    for (let i = 0; i < text.length;) {
      let word = '';
      for (let n = Math.min(this.maxLength, text.length - i); n > 0; n--) {
        const candidate = text.slice(i, i + n);
        if (this.words.has(candidate)) { word = candidate; break; }
      }
      if (!word) word = String.fromCodePoint(text.codePointAt(i));
      result.push({ text: word, start: offset + i, end: offset + i + word.length, interactive: hasHan(word) || this.words.has(word) });
      i += word.length;
    }
    return result;
  }
  segment(text, offset = 0) {
    if (!this.segmenter) return this.fallback(text, offset);
    const result = [];
    for (const { segment, index } of this.segmenter.segment(text)) {
      if (hasHan(segment) && !this.words.has(segment)) result.push(...this.fallback(segment, offset + index));
      else result.push({ text: segment, start: offset + index, end: offset + index + segment.length, interactive: hasHan(segment) || this.words.has(segment) });
    }
    return result;
  }
  selection(text, start = 0) {
    const exact = this.lookup(text);
    return { text, start, end: start + text.length, exact,
      parts: exact.length ? [] : this.segment(text, start).filter((part) => part.interactive) };
  }
}

export function normalizeText(text) { return text.replace(/\r\n?/g, '\n'); }

export function validSavedState(value) {
  if (!value || typeof value.text !== 'string' || value.text.length > MAX_TEXT_LENGTH) return null;
  const pins = Array.isArray(value.pins) ? value.pins.filter((pin) =>
    Number.isInteger(pin.start) && Number.isInteger(pin.end) && pin.start >= 0 && pin.end > pin.start &&
    pin.end <= value.text.length && pin.end - pin.start <= 24 &&
    typeof pin.pinyin === 'string' && pin.pinyin.length <= 200).slice(0, 1000) : [];
  const nonoverlapping = [];
  for (const pin of pins.sort((a, b) => a.start - b.start)) {
    if (!nonoverlapping.length || nonoverlapping.at(-1).end <= pin.start) nonoverlapping.push(pin);
  }
  return { text: value.text, title: typeof value.title === 'string' ? value.title.slice(0, 120) : '',
    fontSize: [22, 26, 30, 34].includes(value.fontSize) ? value.fontSize : 26,
    pins: nonoverlapping, showPins: value.showPins !== false };
}

export function tokensWithOverrides(text, dictionary, ranges) {
  const result = [];
  let cursor = 0;
  for (const range of ranges.slice().sort((a, b) => a.start - b.start)) {
    if (range.start < cursor) continue;
    result.push(...dictionary.segment(text.slice(cursor, range.start), cursor));
    result.push({ text: text.slice(range.start, range.end), start: range.start, end: range.end, interactive: true });
    cursor = range.end;
  }
  result.push(...dictionary.segment(text.slice(cursor), cursor));
  return result;
}

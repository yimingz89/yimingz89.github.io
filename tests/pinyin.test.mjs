import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getContextPinyin } from '../reader/pinyin.mjs';

const syllables = (text, start = 0, end = text.length) => getContextPinyin(text, start, end)
  .map((character) => character.pinyin).filter(Boolean).join(' ');

test('phrase context disambiguates common polyphonic characters', () => {
  for (const [text, expected] of [
    ['银行行走', 'yín háng xíng zǒu'],
    ['音乐快乐', 'yīn yuè kuài lè'],
    ['长大长短', 'zhǎng dà cháng duǎn'],
    ['重庆重要', 'chóng qìng zhòng yào'],
    ['这些工人身处的环境', 'zhè xiē gōng rén shēn chǔ de huán jìng'],
    ['身處困境', 'shēn chǔ kùn jìng'],
  ]) assert.equal(syllables(text), expected, text);
});

test('single-character selections retain the context outside their boundaries', () => {
  const text = '我去银行，然后步行回家，听音乐很快乐。';
  for (const [phrase, within, expected] of [
    ['银行', 1, 'háng'], ['步行', 1, 'xíng'], ['音乐', 1, 'yuè'], ['快乐', 1, 'lè'],
  ]) {
    const start = text.indexOf(phrase) + within;
    assert.equal(syllables(text, start, start + 1), expected);
    assert.deepEqual(getContextPinyin(text, start, start + 1), [{ start, end: start + 1, text: text[start], pinyin: expected }]);
  }
  const originalExample = '这些工人身处的环境“有辱人格”。';
  const start = originalExample.indexOf('处');
  assert.equal(syllables(originalExample, start, start + 1), 'chǔ');
});

test('punctuation, whitespace, Latin text and astral characters preserve exact offsets', () => {
  const text = '😀AI 𠮷 银行，\n音乐。';
  const result = getContextPinyin(text);
  assert.equal(result.map((character) => character.text).join(''), text);
  assert.equal(result.length, [...text].length);
  for (const character of result) assert.equal(text.slice(character.start, character.end), character.text);
  assert.deepEqual(result[0], { start: 0, end: 2, text: '😀', pinyin: '' });
  assert.deepEqual(result.find((character) => character.text === '𠮷'), { start: 5, end: 7, text: '𠮷', pinyin: '' });
  for (const character of result.filter((item) => /[AI，。\s😀]/u.test(item.text))) assert.equal(character.pinyin, '');
  const start = text.indexOf('银行');
  assert.equal(syllables(text, start, start + 2), 'yín háng');
});

test('lexical tones stay consistent with dictionary tone marks', () => {
  assert.equal(syllables('一个不对很好。'), 'yī gè bù duì hěn hǎo');
  assert.equal(syllables('绿色女儿'), 'lǜ sè nǚ ér');
});

test('adverbial 方便地 uses neutral de before supported verbs, with full sentence context', () => {
  for (const text of [
    '银行出台了新的措施，帮助人们更方便地办理业务。',
    '大家可以方便地使用新工具，也能方便地获取信息。',
  ]) {
    const characters = getContextPinyin(text);
    for (const character of characters.filter((item) => item.text === '地')) {
      assert.equal(character.pinyin, 'de');
      assert.equal(syllables(text, character.start, character.end), 'de');
    }
  }
});

test('the narrow adverbial correction preserves dì in nouns and ambiguous word boundaries', () => {
  for (const text of ['地方', '土地', '地址', '地理', '方便地方', '方便地理研究', '方便地面交通', '方便地']) {
    const start = text.indexOf('地');
    assert.equal(syllables(text, start, start + 1), 'dì', text);
  }
});

test('malformed, unbounded, or half-surrogate ranges are rejected safely', () => {
  for (const args of [
    [null], [undefined], [5], [''], ['银行', -1, 1], ['银行', 0, 3], ['银行', 1, 0],
    ['银行', 0.5, 1], ['银行', 0, NaN], ['银行', 0, Infinity], ['😀行', 1, 2], ['😀行', 0, 1],
    ['行'.repeat(30001)], ['银行', 1, 1],
  ]) assert.deepEqual(getContextPinyin(...args), []);
});

test('cached context returns independent objects and follows article changes', () => {
  const result = getContextPinyin('银行');
  result[1].pinyin = 'wrong'; result[0].text = 'bad'; result.pop();
  assert.equal(syllables('银行'), 'yín háng');
  assert.equal(syllables('行走'), 'xíng zǒu');
  assert.equal(syllables('银行'), 'yín háng');
});

test('full-size articles remain bounded and selected offsets stay exact', () => {
  const text = '阅读学习。'.repeat(5999) + '音乐银行。';
  assert.equal(text.length, 30000);
  assert.equal(syllables(text, 29998, 29999), 'háng');
  assert.deepEqual(getContextPinyin(text, 29999, 30000), [{ start: 29999, end: 30000, text: '。', pinyin: '' }]);
});

// Mechanical conversion of the official, downloadable CC-CEDICT v1 export.
// Usage: node reader/build-dictionary.mjs /path/to/cedict.txt.gz
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const source = readFileSync(process.argv[2]);
const raw = gunzipSync(source).toString('utf8');
const entries = [];
const comments = [];
for (const line of raw.split(/\r?\n/)) {
  if (!line.trim()) continue;
  if (line.startsWith('#')) { comments.push(line); continue; }
  const match = line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/$/);
  if (!match) throw new Error(`Unrecognized dictionary row: ${line.slice(0, 80)}`);
  entries.push([match[2], match[3], match[4], match[1]]);
}
if (entries.length < 100000) throw new Error('Unexpectedly small dictionary; refusing to overwrite');
const meta = {
  format: 1, name: 'CC-CEDICT', license: 'CC BY-SA 4.0',
  source: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  downloadedAt: new Date().toISOString(), sourceSha256: createHash('sha256').update(source).digest('hex'),
  entries: entries.length,
  changes: 'Reformatted as JSON tuples [simplified, numbered pinyin, slash-separated definitions, traditional]. No entries or definitions edited.',
  originalHeader: comments,
};
mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
writeFileSync(new URL('./data/dictionary.json', import.meta.url), JSON.stringify({ meta, entries }));
console.log(`Built ${entries.length.toLocaleString()} entries (${JSON.stringify({ meta, entries }).length.toLocaleString()} characters).`);

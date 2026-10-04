// Ratings describe exact spellings, not individual readings or character difficulty.
export class WordLevels {
  constructor(data) {
    if (data?.meta?.format !== 1 || data.meta.hskEdition !== 'HSK 3.0 (2021)' || !Array.isArray(data.entries) || !data.entries.length) throw new Error('Invalid word-level data');
    this.words = new Map();
    for (const row of data.entries) {
      if (!Array.isArray(row) || row.length !== 3) throw new Error('Invalid word-level row');
      const [text, hsk, zipf] = row;
      if (typeof text !== 'string' || !text || (hsk !== null && (!Number.isInteger(hsk) || hsk < 1 || hsk > 7)) ||
          (zipf !== null && (!Number.isFinite(zipf) || zipf < 1 || zipf > 9))) throw new Error('Invalid word-level values');
      this.words.set(text, { hsk, zipf });
    }
  }
  lookup(text) { return this.words.get(text) || { hsk: null, zipf: null }; }
}

export function frequencyBand(zipf) {
  if (!Number.isFinite(zipf) || zipf < 1 || zipf > 9) return null;
  if (zipf >= 6) return 'Extremely common';
  if (zipf >= 5) return 'Very common';
  if (zipf >= 4) return 'Common';
  if (zipf >= 3) return 'Less common';
  return 'Rare';
}

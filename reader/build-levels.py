"""Build static exact-word ratings. Developer-only: pip install wordfreq==3.1.1.

Usage: python reader/build-levels.py /path/to/complete.json /path/to/HSK-README.md
Download both HSK files at HSK_COMMIT below. No browser/API runtime dependency.
"""
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import sys

import regex
from wordfreq import get_frequency_dict
from wordfreq.preprocess import preprocess_text

HSK_COMMIT = "7ac65bf1a6387d35f1ade478906172a19311c7f9"
ROOT = Path(__file__).resolve().parent


def main():
    if importlib.metadata.version("wordfreq") != "3.1.1":
        raise ValueError("Build with wordfreq==3.1.1 for reproducible frequency data")
    raw = Path(sys.argv[1]).read_bytes()
    source = json.loads(raw)
    readme = Path(sys.argv[2]).read_text(encoding="utf-8")
    hsk_license = readme[readme.index("MIT License"):].strip()
    levels = {}
    for item in source:
        # 'new-' is the 2021 standard; 'newest-' is a DIFFERENT (2026) list.
        values = [int(tag[4:]) for tag in item["level"] if regex.fullmatch(r"new-[1-7]", tag)]
        if values:
            word = item["simplified"]
            levels[word] = min(min(values), levels.get(word, 7))
    if len(levels) < 10000:
        raise ValueError("Unexpected HSK coverage; refusing to replace ratings")
    dictionary = json.loads((ROOT / "data/dictionary.json").read_text(encoding="utf-8"))
    words = set(levels) | {row[0] for row in dictionary["entries"]}
    frequencies = get_frequency_dict("zh", wordlist="large")
    entries = []
    for word in sorted(words):
        if not regex.search(r"\p{Script=Han}", word):
            continue
        # Use wordfreq's own normalization, but require one exact corpus token.
        # Never estimate a phrase's frequency by combining its component words.
        frequency = frequencies.get(preprocess_text(word, "zh"))
        zipf = round(math.log10(frequency) + 9, 2) if frequency else None
        level = levels.get(word)
        if level is not None or zipf is not None:
            entries.append([word, level, zipf])
    wordfreq_readme = importlib.metadata.metadata("wordfreq").get_payload()
    meta = {
        "format": 1,
        "hskEdition": "HSK 3.0 (2021)",
        "entries": len(entries),
        "fields": ["exact simplified spelling", "HSK 3.0 (2021) level; 7 = 7–9; null = unlisted", "wordfreq Zipf frequency; null = no exact token"],
        "license": "CC BY-SA 4.0 (frequency data); HSK mapping retains MIT notice",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
        "hsk": {
            "source": "https://github.com/drkameleon/complete-hsk-vocabulary",
            "commit": HSK_COMMIT, "sourceSha256": hashlib.sha256(raw).hexdigest(),
            "changes": "Only simplified spellings and lowest new-1 through new-7 vocabulary levels extracted. old- and newest- tags excluded. No character levels inferred.",
            "license": hsk_license,
        },
        "frequency": {
            "source": "https://github.com/rspeer/wordfreq", "version": "3.1.1", "language": "zh", "wordlist": "large",
            "credit": "Robyn Speer. (2022). rspeer/wordfreq: v3.0. Zenodo. https://doi.org/10.5281/zenodo.7199437",
            "changes": "Restricted to dictionary/HSK spellings containing Han characters. Chinese normalization from wordfreq applied at build time; exact corpus tokens only. Converted frequency to Zipf rounded to two decimals. No multi-token estimates. JSON retains source attribution and license documentation.",
            "limitations": "Usage snapshot through approximately 2021. Scores combine readings and senses. Single-character token frequencies do not count occurrences inside compound words. Missing does not mean rare. Simplified and Traditional forms are normalized together by wordfreq.",
            "originalDocumentationAndAttribution": wordfreq_readme,
        },
    }
    output = ROOT / "data/levels.json"
    output.write_text(json.dumps({"meta": meta, "entries": entries}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Built {len(entries):,} ratings ({len(levels):,} HSK entries; {output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()

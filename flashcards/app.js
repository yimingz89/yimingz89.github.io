const DATA_URL = "./data/hanzi_top2000_cards.json";
const STORAGE_KEY = "hanzi-study-progress-v1";
const STAR_STORAGE_KEY = "hanzi-study-stars-v1";
const LEARNING_STORAGE_KEY = "hanzi-study-learning-v1";
// Preserve selections made before the second star was renamed to Learning.
const LEGACY_EASY_STORAGE_KEY = "hanzi-study-easy-v1";

const state = {
  coreCards: [],
  supplementCards: [],
  filteredCards: [],
  index: 0,
  revealed: false,
  shuffled: false,
  starredShuffled: false,
  fullDeck: "core",
  progress: loadProgress(),
  starred: loadStarred(),
  learning: loadLearning(),
  cloudEditable: true,
  cloudSignedIn: false,
};

const studyListeners = new Set();

function notifyStudyChanges(changes) {
  if (!Object.keys(changes).length) return;
  for (const listener of studyListeners) listener(changes);
}

function currentStarValue(id) {
  return state.learning.has(id) ? "learning" : state.starred.has(id) ? "keep-fresh" : "none";
}

const elements = {
  loading: document.querySelector("#loading-state"),
  error: document.querySelector("#error-state"),
  empty: document.querySelector("#empty-state"),
  emptyEyebrow: document.querySelector("#empty-eyebrow"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyCopy: document.querySelector("#empty-copy"),
  flashcard: document.querySelector("#flashcard"),
  navigation: document.querySelector("#card-navigation"),
  front: document.querySelector("#card-front"),
  back: document.querySelector("#card-back"),
  frontCharacter: document.querySelector("#front-character"),
  backCharacter: document.querySelector("#back-character"),
  gloss: document.querySelector("#card-gloss"),
  answerContent: document.querySelector("#answer-content"),
  rank: document.querySelector("#rank-label"),
  hsk: document.querySelector("#hsk-label"),
  count: document.querySelector("#card-count"),
  starButton: document.querySelector("#star-button"),
  starGlyph: document.querySelector("#star-glyph"),
  starLabel: document.querySelector("#star-label"),
  learningStarButton: document.querySelector("#learning-star-button"),
  learningStarGlyph: document.querySelector("#learning-star-glyph"),
  learningStarLabel: document.querySelector("#learning-star-label"),
  progressCopy: document.querySelector("#progress-copy"),
  progressBar: document.querySelector("#progress-bar"),
  deckSelect: document.querySelector("#deck-select"),
  starredOption: document.querySelector("#starred-option"),
  keepFreshOption: document.querySelector("#keep-fresh-option"),
  learningOption: document.querySelector("#learning-option"),
  levelSelect: document.querySelector("#level-select"),
  keepFreshFilter: document.querySelector("#filter-keep-fresh"),
  learningFilter: document.querySelector("#filter-learning"),
  keepFreshCount: document.querySelector("#keep-fresh-count"),
  learningCount: document.querySelector("#learning-count"),
  filterStatus: document.querySelector("#star-filter-status"),
  backToFullDeck: document.querySelector("#back-to-full-deck"),
  jumpForm: document.querySelector("#jump-form"),
  jumpInput: document.querySelector("#jump-input"),
  jumpMessage: document.querySelector("#jump-message"),
  revealButton: document.querySelector("#reveal-button"),
  hideButton: document.querySelector("#hide-button"),
  againButton: document.querySelector("#again-button"),
  gotItButton: document.querySelector("#got-it-button"),
  previousButton: document.querySelector("#previous-button"),
  nextButton: document.querySelector("#next-button"),
  shuffleButton: document.querySelector("#shuffle-button"),
  shuffleStarredButton: document.querySelector("#shuffle-starred-button"),
  resetButton: document.querySelector("#reset-button"),
  exportButton: document.querySelector("#export-progress"),
  importButton: document.querySelector("#import-progress"),
  importFile: document.querySelector("#import-file"),
  backupStatus: document.querySelector("#backup-status"),
};

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function loadStarred() {
  try {
    const stored = JSON.parse(localStorage.getItem(STAR_STORAGE_KEY));
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

function saveStarred() {
  localStorage.setItem(STAR_STORAGE_KEY, JSON.stringify([...state.starred]));
}

function loadLearning() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(LEARNING_STORAGE_KEY) ?? localStorage.getItem(LEGACY_EASY_STORAGE_KEY),
    );
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

function saveLearning() {
  localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify([...state.learning]));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatHsk(level) {
  if (level === null || level === undefined) return "Not in HSK";
  return level === 7 ? "HSK 7–9" : `HSK ${level}`;
}

function cardId(card) {
  return `${card.rank}:${card.character}`;
}

function isStarred(card) {
  return state.starred.has(cardId(card));
}

function isLearning(card) {
  return state.learning.has(cardId(card));
}

function isInStarredDeck(card) {
  return isStarred(card) || isLearning(card);
}

function isSpecialDeck() {
  return ["starred", "keep-fresh", "learning"].includes(elements.deckSelect.value);
}

function readingMarkup(reading) {
  const definitions = (reading.definitions || [])
    .slice(0, 5)
    .map((definition) => `<li>${escapeHtml(definition)}</li>`)
    .join("");

  const patterns = (reading.patterns || [])
    .slice(0, 3)
    .map(
      (pattern) => `
        <div class="pattern">
          <strong>${escapeHtml(pattern.usage)}</strong>
          <p><span class="example" lang="zh-Hans">${escapeHtml(pattern.example)}</span> · ${escapeHtml(pattern.pinyin)}</p>
          <p>${escapeHtml(pattern.translation)}</p>
        </div>`,
    )
    .join("");

  const words = (reading.words || [])
    .slice(0, 6)
    .map(
      (word) => `
        <div class="word-card">
          <div class="word-line">
            <span class="word" lang="zh-Hans">${escapeHtml(word.word)}</span>
            <span class="word-pinyin">${escapeHtml(word.pinyin)}</span>
          </div>
          <p class="word-definition">${escapeHtml((word.definitions || [""])[0])}</p>
          <div class="word-meta">
            ${word.hsk ? `<span class="mini-badge">${formatHsk(word.hsk)}</span>` : ""}
            ${word.zipf ? `<span class="mini-badge">Freq. ${escapeHtml(word.zipf)}</span>` : ""}
          </div>
        </div>`,
    )
    .join("");

  return `
    <section class="reading-block">
      <div class="reading-heading">
        <span class="pinyin">${escapeHtml(reading.pinyin)}</span>
        ${reading.bound_form ? '<span class="bound-badge">Bound form</span>' : ""}
      </div>
      <ol class="definitions">${definitions}</ol>
      ${patterns ? `<p class="section-label">In a sentence</p><div class="patterns">${patterns}</div>` : ""}
      ${words ? `<p class="section-label">Common words</p><div class="word-grid">${words}</div>` : ""}
    </section>`;
}

function renderCard() {
  const card = state.filteredCards[state.index];

  elements.loading.classList.add("hidden");
  elements.error.classList.add("hidden");

  if (!card) {
    elements.flashcard.classList.add("hidden");
    elements.navigation.classList.add("hidden");
    elements.empty.classList.remove("hidden");
    state.revealed = false;
    const deck = elements.deckSelect.value;
    if (isSpecialDeck()) {
      const category = deck === "learning" ? "Learning" : deck === "keep-fresh" ? "Keep fresh" : "starred";
      const hasSavedCards = deck === "learning"
        ? state.learning.size > 0
        : deck === "keep-fresh"
          ? state.starred.size > 0
          : state.starred.size + state.learning.size > 0;
      elements.emptyEyebrow.textContent = `${category} cards`;
      elements.emptyTitle.textContent = hasSavedCards
        ? `No ${category} cards at this level.`
        : `No ${category} cards yet.`;
      elements.emptyCopy.textContent = hasSavedCards
        ? "Choose another HSK level to see the rest of your saved deck."
        : "Mark cards Keep fresh or Learning to save them for study.";
    } else {
      elements.emptyEyebrow.textContent = "No cards here";
      elements.emptyTitle.textContent = "Try a different HSK level.";
      elements.emptyCopy.textContent = "";
    }
    updateProgress();
    return;
  }

  elements.empty.classList.add("hidden");
  elements.flashcard.classList.remove("hidden");
  elements.navigation.classList.remove("hidden");
  elements.frontCharacter.textContent = card.character;
  elements.backCharacter.textContent = card.character;
  elements.gloss.textContent = card.gloss || "No short gloss available";
  elements.rank.textContent = `Rank #${card.rank.toLocaleString()}`;
  elements.hsk.textContent = formatHsk(card.hsk_level);
  elements.count.textContent = `${(state.index + 1).toLocaleString()} / ${state.filteredCards.length.toLocaleString()}`;
  elements.answerContent.innerHTML = (card.readings || []).map(readingMarkup).join("");
  updateStarButton(card);
  elements.previousButton.disabled = state.index === 0;
  elements.nextButton.disabled = state.index === state.filteredCards.length - 1;
  setRevealed(false);
  updateProgress();
}

function updateStarButton(card) {
  const starred = isStarred(card);
  const learning = isLearning(card);
  elements.starButton.classList.toggle("is-starred", starred);
  elements.starButton.setAttribute("aria-pressed", String(starred));
  elements.starButton.setAttribute(
    "aria-label",
    starred ? "Remove the keep-fresh star" : "Mark this card to keep fresh",
  );
  elements.starGlyph.textContent = starred ? "★" : "☆";
  elements.starLabel.textContent = starred ? "Keep fresh ✓" : "Keep fresh";
  elements.learningStarButton.classList.toggle("is-starred", learning);
  elements.learningStarButton.setAttribute("aria-pressed", String(learning));
  elements.learningStarButton.setAttribute(
    "aria-label",
    learning ? "Remove the learning star" : "Mark this card as learning",
  );
  elements.learningStarGlyph.textContent = learning ? "★" : "☆";
  elements.learningStarLabel.textContent = learning ? "Learning ✓" : "Learning";
}

function toggleStar() {
  if (!state.cloudEditable) return;
  const card = state.filteredCards[state.index];
  if (!card) return;

  const id = cardId(card);
  if (state.starred.has(id)) {
    state.starred.delete(id);
  } else {
    state.starred.add(id);
    state.learning.delete(id);
  }
  saveStarred();
  saveLearning();
  notifyStudyChanges({ [id]: { star: currentStarValue(id) } });
  refreshAfterCategoryChange(card);
}

function toggleLearning() {
  if (!state.cloudEditable) return;
  const card = state.filteredCards[state.index];
  if (!card) return;

  const id = cardId(card);
  if (state.learning.has(id)) {
    state.learning.delete(id);
  } else {
    state.learning.add(id);
    state.starred.delete(id);
  }
  saveLearning();
  saveStarred();
  notifyStudyChanges({ [id]: { star: currentStarValue(id) } });
  refreshAfterCategoryChange(card);
}

function refreshAfterCategoryChange(card) {
  const deck = elements.deckSelect.value;
  const stillBelongs =
    (deck === "starred" && isInStarredDeck(card)) ||
    (deck === "keep-fresh" && isStarred(card)) ||
    (deck === "learning" && isLearning(card)) ||
    deck === "core" || deck === "complete";

  if (!stillBelongs) {
    state.filteredCards.splice(state.index, 1);
    state.index = Math.min(state.index, Math.max(state.filteredCards.length - 1, 0));
    renderCard();
  } else {
    updateStarButton(card);
    updateProgress();
  }
}

function setRevealed(revealed) {
  state.revealed = revealed;
  elements.front.classList.toggle("hidden", revealed);
  elements.back.classList.toggle("hidden", !revealed);
  if (revealed) {
    elements.answerContent.scrollTop = 0;
    window.setTimeout(() => elements.hideButton.focus({ preventScroll: true }), 0);
  }
}

function moveCard(direction) {
  const nextIndex = Math.min(
    Math.max(state.index + direction, 0),
    Math.max(state.filteredCards.length - 1, 0),
  );
  if (nextIndex !== state.index) {
    state.index = nextIndex;
    setJumpMessage("");
    renderCard();
  }
}

function rateCard(rating) {
  if (!state.cloudEditable) return;
  const card = state.filteredCards[state.index];
  if (!card) return;
  state.progress[cardId(card)] = rating;
  saveProgress();
  notifyStudyChanges({ [cardId(card)]: { rating } });
  updateProgress();

  if (state.index < state.filteredCards.length - 1) {
    moveCard(1);
  } else {
    setRevealed(false);
  }
}

function updateProgress() {
  const deck = [...state.coreCards, ...state.supplementCards];
  const learned = deck.reduce(
    (total, card) => total + (state.progress[cardId(card)] === "learned" ? 1 : 0),
    0,
  );
  const starred = deck.reduce(
    (total, card) => total + (state.starred.has(cardId(card)) ? 1 : 0),
    0,
  );
  const learning = deck.reduce(
    (total, card) => total + (isLearning(card) ? 1 : 0),
    0,
  );
  const allStarred = deck.filter(isInStarredDeck).length;
  const total = deck.length || 1;
  elements.progressCopy.textContent = `${learned.toLocaleString()} learned · ${allStarred.toLocaleString()} starred`;
  elements.keepFreshCount.textContent = starred.toLocaleString();
  elements.learningCount.textContent = learning.toLocaleString();
  elements.starredOption.textContent = `All starred cards (${allStarred.toLocaleString()})`;
  elements.keepFreshOption.textContent = `Keep fresh (${starred.toLocaleString()})`;
  elements.learningOption.textContent = `Learning (${learning.toLocaleString()})`;
  elements.progressBar.style.width = `${(learned / total) * 100}%`;
}

function applyFilters({ resetIndex = true } = {}) {
  const allCards = [...state.coreCards, ...state.supplementCards];
  const deck = elements.deckSelect.value;
  if (!isSpecialDeck()) state.fullDeck = deck;
  let source = [...state.coreCards];
  if (deck === "complete") source = allCards;
  if (deck === "starred") source = allCards.filter(isInStarredDeck);
  if (deck === "keep-fresh") source = allCards.filter(isStarred);
  if (deck === "learning") source = allCards.filter(isLearning);
  const level = elements.levelSelect.value;

  state.filteredCards = source.filter((card) => {
    if (level === "all") return true;
    if (level === "none") return card.hsk_level === null || card.hsk_level === undefined;
    return String(card.hsk_level) === level;
  });

  const shuffled = isSpecialDeck() ? state.starredShuffled : state.shuffled;
  if (shuffled) shuffleInPlace(state.filteredCards);
  elements.shuffleButton.textContent = shuffled ? "Restore rank order" : "Shuffle deck";
  if (resetIndex) state.index = 0;
  if (!resetIndex) {
    state.index = Math.min(state.index, Math.max(state.filteredCards.length - 1, 0));
  }
  elements.keepFreshFilter.setAttribute("aria-pressed", String(deck === "keep-fresh" || deck === "starred"));
  elements.learningFilter.setAttribute("aria-pressed", String(deck === "learning" || deck === "starred"));
  elements.backToFullDeck.classList.toggle("hidden", !isSpecialDeck());
  const selection = deck === "keep-fresh" ? "Keep fresh only"
    : deck === "learning" ? "Learning only"
      : deck === "starred" ? "Keep fresh + Learning" : "the full deck";
  const levelDescription = level === "all" ? ""
    : level === "none" ? " · Not in HSK" : ` · ${formatHsk(Number(level))}`;
  elements.filterStatus.textContent = `Showing ${selection}${levelDescription}${shuffled ? " · Shuffled" : ""}`;
  renderCard();
}

function toggleStarFilter(category) {
  const deck = elements.deckSelect.value;
  let keepFresh = deck === "keep-fresh" || deck === "starred";
  let learning = deck === "learning" || deck === "starred";
  if (category === "keep-fresh") keepFresh = !keepFresh;
  if (category === "learning") learning = !learning;
  elements.deckSelect.value = keepFresh && learning ? "starred"
    : keepFresh ? "keep-fresh" : learning ? "learning" : state.fullDeck;
  setJumpMessage("");
  applyFilters();
}

function backToFullDeck() {
  elements.deckSelect.value = state.fullDeck;
  elements.levelSelect.value = "all";
  setJumpMessage("");
  applyFilters();
}

function setJumpMessage(message, isError = false) {
  elements.jumpMessage.textContent = message;
  elements.jumpMessage.classList.toggle("is-error", isError);
}

function jumpToRank(rawRank) {
  const rank = Number(rawRank);
  if (!Number.isInteger(rank) || rank < 1) {
    throw new Error("Enter a whole card number greater than zero.");
  }

  const allCards = [...state.coreCards, ...state.supplementCards];
  const target = allCards.find((card) => card.rank === rank);
  if (!target) {
    throw new Error(`There is no card numbered ${rank.toLocaleString()}.`);
  }

  state.shuffled = false;
  elements.shuffleButton.textContent = "Shuffle deck";
  elements.deckSelect.value = state.coreCards.includes(target) ? "core" : "complete";
  elements.levelSelect.value = "all";
  applyFilters();

  const targetIndex = state.filteredCards.findIndex((card) => cardId(card) === cardId(target));
  if (targetIndex < 0) throw new Error("That card could not be opened.");
  state.index = targetIndex;
  renderCard();
  elements.jumpInput.value = String(rank);
  setJumpMessage(`Showing card #${rank.toLocaleString()}: ${target.character}`);
  return target;
}

function handleJump(event) {
  event.preventDefault();
  try {
    jumpToRank(elements.jumpInput.value);
  } catch (error) {
    setJumpMessage(error.message, true);
    elements.jumpInput.focus();
  }
}

function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function toggleShuffle() {
  if (isSpecialDeck()) {
    state.starredShuffled = !state.starredShuffled;
  } else {
    state.shuffled = !state.shuffled;
  }
  setJumpMessage("");
  applyFilters();
}

function shuffleStarredCards() {
  // Keep the full deck's ordering preference independent of starred study.
  if (!isSpecialDeck()) elements.deckSelect.value = "starred";
  state.starredShuffled = true;
  setJumpMessage("");
  applyFilters();
}

function resetProgress() {
  if (!state.cloudEditable) return;
  const scope = state.cloudSignedIn ? "your cloud account and signed-in devices" : "this device";
  if (!window.confirm(`Reset all learned and review marks on ${scope}? Stars are kept.`)) return;
  const changes = Object.fromEntries(Object.keys(state.progress).map((id) => [id, { rating: "unrated" }]));
  state.progress = {};
  saveProgress();
  notifyStudyChanges(changes);
  updateProgress();
}

function setBackupStatus(message, isError = false) {
  elements.backupStatus.textContent = message;
  elements.backupStatus.classList.toggle("is-error", isError);
}

function createBackup() {
  return {
    app: "hanzi-study",
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: { ...state.progress },
    keepFresh: [...state.starred],
    learning: [...state.learning],
  };
}

function exportProgress() {
  const blob = new Blob([JSON.stringify(createBackup(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hanzi-study-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setBackupStatus("Backup downloaded. Open the other app and choose Import progress.");
}

function validateBackup(backup) {
  const knownIds = new Set([...state.coreCards, ...state.supplementCards].map(cardId));
  const validList = (list) => Array.isArray(list) && list.length <= knownIds.size
    && list.every((id) => typeof id === "string" && knownIds.has(id));
  if (!backup || backup.app !== "hanzi-study" || backup.version !== 1
    || !backup.progress || typeof backup.progress !== "object" || Array.isArray(backup.progress)
    || !Object.entries(backup.progress).every(([id, rating]) => knownIds.has(id) && ["learned", "review"].includes(rating))
    || !validList(backup.keepFresh) || !validList(backup.learning)) {
    throw new Error("Choose a valid Hanzi Study progress backup exported from this app.");
  }
  const learning = new Set(backup.learning);
  if (backup.keepFresh.some((id) => learning.has(id))) {
    throw new Error("This backup places a card in both star categories. No changes were made.");
  }
  return backup;
}

function mergeBackup(backup) {
  if (!state.cloudEditable) throw new Error("Wait for cloud sync to connect, or sign out to import locally.");
  validateBackup(backup);
  const progress = { ...state.progress, ...backup.progress };
  const starred = new Set(state.starred);
  const learning = new Set(state.learning);
  for (const id of backup.keepFresh) {
    starred.add(id);
    learning.delete(id);
  }
  for (const id of backup.learning) {
    learning.add(id);
    starred.delete(id);
  }

  // Leave the current session untouched if the browser cannot save the import.
  const updates = [
    [STORAGE_KEY, JSON.stringify(progress)],
    [STAR_STORAGE_KEY, JSON.stringify([...starred])],
    [LEARNING_STORAGE_KEY, JSON.stringify([...learning])],
  ];
  const previous = updates.map(([key]) => [key, localStorage.getItem(key)]);
  try {
    for (const [key, value] of updates) localStorage.setItem(key, value);
  } catch (error) {
    for (const [key, value] of previous) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch { /* Storage may be disabled entirely. */ }
    }
    throw new Error("Your browser couldn’t save the import. Check its storage settings and try again.", { cause: error });
  }
  state.progress = progress;
  state.starred = starred;
  state.learning = learning;
  const changes = {};
  for (const id of [...backup.keepFresh, ...backup.learning]) changes[id] = { star: currentStarValue(id) };
  for (const [id, rating] of Object.entries(backup.progress)) changes[id] = { ...changes[id], rating };
  notifyStudyChanges(changes);
  applyFilters({ resetIndex: false });
}

async function importProgress() {
  const file = elements.importFile.files?.[0];
  if (!file) return;
  elements.importButton.disabled = true;
  try {
    if (file.size > 1024 * 1024) throw new Error("That file is too large. Choose a Hanzi Study progress backup, not the card dataset.");
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      throw new Error("That file couldn’t be read as JSON. Choose a Hanzi Study progress backup.");
    }
    validateBackup(backup);
    const starCount = backup.keepFresh.length + backup.learning.length;
    const destination = state.cloudSignedIn ? "your cloud account (and all signed-in devices)" : "this browser";
    if (!window.confirm(`Merge ${starCount} stars and ${Object.keys(backup.progress).length} progress marks into ${destination}? Imported marks win for matching cards; all other saved cards are kept.`)) {
      setBackupStatus("Import canceled. Your saved cards are unchanged.");
      return;
    }
    mergeBackup(backup);
    setBackupStatus(state.cloudSignedIn
      ? "Imported successfully. Changes are queued for cloud sync; check the sync status above."
      : "Imported successfully. Your stars and progress are saved in this browser.");
  } catch (error) {
    setBackupStatus(error.message, true);
  } finally {
    elements.importFile.value = "";
    elements.importButton.disabled = !state.cloudEditable;
  }
}

function bindEvents() {
  elements.revealButton.addEventListener("click", () => setRevealed(true));
  elements.hideButton.addEventListener("click", () => setRevealed(false));
  elements.againButton.addEventListener("click", () => rateCard("review"));
  elements.gotItButton.addEventListener("click", () => rateCard("learned"));
  elements.previousButton.addEventListener("click", () => moveCard(-1));
  elements.nextButton.addEventListener("click", () => moveCard(1));
  elements.starButton.addEventListener("click", toggleStar);
  elements.learningStarButton.addEventListener("click", toggleLearning);
  elements.keepFreshFilter.addEventListener("click", () => toggleStarFilter("keep-fresh"));
  elements.learningFilter.addEventListener("click", () => toggleStarFilter("learning"));
  elements.backToFullDeck.addEventListener("click", backToFullDeck);
  elements.jumpForm.addEventListener("submit", handleJump);
  elements.deckSelect.addEventListener("change", () => {
    setJumpMessage("");
    applyFilters();
  });
  elements.levelSelect.addEventListener("change", () => {
    setJumpMessage("");
    applyFilters();
  });
  elements.shuffleButton.addEventListener("click", toggleShuffle);
  elements.shuffleStarredButton.addEventListener("click", shuffleStarredCards);
  elements.resetButton.addEventListener("click", resetProgress);
  elements.exportButton.addEventListener("click", exportProgress);
  elements.importButton.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", importProgress);

  document.addEventListener("keydown", (event) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === "SELECT" || activeTag === "INPUT" || activeTag === "SUMMARY" || activeTag === "A") return;

    if (document.activeElement?.closest?.("#cloud-panel")) return;

    if (document.activeElement === elements.exportButton || document.activeElement === elements.importButton) return;

    if (event.code === "Space" && [elements.keepFreshFilter, elements.learningFilter, elements.backToFullDeck, elements.shuffleStarredButton, elements.shuffleButton].includes(document.activeElement)) return;

    if (event.code === "Space") {
      event.preventDefault();
      setRevealed(!state.revealed);
    } else if (event.key === "1" && state.revealed) {
      rateCard("review");
    } else if (event.key === "2" && state.revealed) {
      rateCard("learned");
    } else if (event.key === "ArrowLeft") {
      moveCard(-1);
    } else if (event.key === "ArrowRight") {
      moveCard(1);
    }
  });
}

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  const tools = [
    {
      name: "read_current_hanzi_card",
      title: "Read current hanzi card",
      description: "Return the character, rank, HSK level, and whether its answer is revealed.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        const card = state.filteredCards[state.index];
        if (!card) throw new Error("No card is available in the current deck.");
        return {
          character: card.character,
          rank: card.rank,
          hskLevel: card.hsk_level,
          revealed: state.revealed,
          starred: isInStarredDeck(card),
          keepFresh: isStarred(card),
          learning: isLearning(card),
        };
      },
    },
    {
      name: "jump_to_hanzi_rank",
      title: "Jump to hanzi rank",
      description: "Open the character card with the requested frequency rank.",
      inputSchema: {
        type: "object",
        properties: { rank: { type: "integer", minimum: 1 } },
        required: ["rank"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const target = jumpToRank(input?.rank);
        return { character: target.character, rank: target.rank, opened: true };
      },
    },
    {
      name: "toggle_star_current_hanzi_card",
      title: "Toggle Keep fresh on current hanzi card",
      description: "Add or remove the Keep fresh star. Adding it clears any Learning star.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        const card = state.filteredCards[state.index];
        if (!card) throw new Error("No card is available in the current deck.");
        if (!state.cloudEditable) throw new Error("Wait for cloud sync to connect, or sign out to edit locally.");
        toggleStar();
        return { character: card.character, keepFresh: isStarred(card), learning: isLearning(card), saved: true };
      },
    },
    {
      name: "toggle_learning_current_hanzi_card",
      title: "Toggle Learning on current hanzi card",
      description: "Add or remove the Learning star. Adding it clears any Keep fresh star. Full decks include all cards.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        const card = state.filteredCards[state.index];
        if (!card) throw new Error("No card is available in the current deck.");
        if (!state.cloudEditable) throw new Error("Wait for cloud sync to connect, or sign out to edit locally.");
        toggleLearning();
        return { character: card.character, learning: isLearning(card), keepFresh: isStarred(card), saved: true };
      },
    },
    {
      name: "reveal_current_hanzi_card",
      title: "Reveal current hanzi card",
      description: "Reveal the answer for the currently visible character card.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        const card = state.filteredCards[state.index];
        if (!card) throw new Error("No card is available in the current deck.");
        setRevealed(true);
        return { character: card.character, revealed: true };
      },
    },
    {
      name: "rate_current_hanzi_card",
      title: "Rate current hanzi card",
      description: "Mark the current card as needing review or learned, then advance to the next card.",
      inputSchema: {
        type: "object",
        properties: { rating: { type: "string", enum: ["review", "learned"] } },
        required: ["rating"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || !["review", "learned"].includes(input.rating)) {
          throw new Error('rating must be either "review" or "learned".');
        }
        const card = state.filteredCards[state.index];
        if (!card) throw new Error("No card is available in the current deck.");
        if (!state.cloudEditable) throw new Error("Wait for cloud sync to connect, or sign out to edit locally.");
        rateCard(input.rating);
        return { character: card.character, rating: input.rating, saved: true };
      },
    },
  ];

  for (const tool of tools) {
    try {
      Promise.resolve(context.registerTool(tool)).catch(() => {});
    } catch {
      // The app works normally in browsers without WebMCP support.
    }
  }
}

async function init() {
  bindEvents();
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    const data = await response.json();
    state.coreCards = Array.isArray(data.cards) ? data.cards : [];
    state.supplementCards = Array.isArray(data.supplement) ? data.supplement : [];
    const availableRanks = [...state.coreCards, ...state.supplementCards].map((card) => card.rank);
    elements.jumpInput.max = String(Math.max(...availableRanks));
    applyFilters();
    elements.exportButton.disabled = false;
    elements.importButton.disabled = false;
    registerWebMcpTools();
    return true;
  } catch (error) {
    console.error(error);
    elements.loading.classList.add("hidden");
    elements.flashcard.classList.add("hidden");
    elements.navigation.classList.add("hidden");
    elements.error.classList.remove("hidden");
    return false;
  }
}

function setCloudEditable(editable) {
  state.cloudEditable = editable;
  for (const element of [elements.starButton, elements.learningStarButton, elements.againButton, elements.gotItButton, elements.resetButton, elements.importButton]) {
    element.disabled = !editable;
  }
}

function applyCloudBackup(backup) {
  validateBackup(backup);
  const current = state.filteredCards[state.index];
  const revealed = state.revealed;
  const order = new Map(state.filteredCards.map((card, index) => [cardId(card), index]));
  // Keep legacy local keys as a cache, so local use and exports continue working.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.progress));
  localStorage.setItem(STAR_STORAGE_KEY, JSON.stringify(backup.keepFresh));
  localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(backup.learning));
  state.progress = { ...backup.progress };
  state.starred = new Set(backup.keepFresh);
  state.learning = new Set(backup.learning);
  applyFilters({ resetIndex: false });
  if (isSpecialDeck() ? state.starredShuffled : state.shuffled) {
    state.filteredCards.sort((a, b) => (order.get(cardId(a)) ?? Infinity) - (order.get(cardId(b)) ?? Infinity));
  }
  const index = current ? state.filteredCards.findIndex((card) => cardId(card) === cardId(current)) : -1;
  if (index !== -1) state.index = index;
  renderCard();
  if (index !== -1 && revealed) {
    state.revealed = true;
    elements.front.classList.add("hidden");
    elements.back.classList.remove("hidden");
  }
}

window.hanziStudy = {
  ready: init(),
  getBackup: createBackup,
  getCardIds: () => [...state.coreCards, ...state.supplementCards].map(cardId),
  applyCloudBackup,
  mergeBackup,
  setCloudEditable,
  setCloudSignedIn: (signedIn) => { state.cloudSignedIn = signedIn; },
  subscribe: (listener) => { studyListeners.add(listener); return () => studyListeners.delete(listener); },
};

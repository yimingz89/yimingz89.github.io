// Browser-independent merge/queue logic. No Firebase credentials or network calls.
const choices = { star: ['none', 'keep-fresh', 'learning'], rating: ['unrated', 'review', 'learned'] };

export function cleanRecord(value) {
  const result = {};
  for (const field of Object.keys(choices)) {
    if (choices[field].includes(value?.[field])) result[field] = value[field];
  }
  return result;
}

export function backupToRecords(backup) {
  const records = {};
  for (const id of backup.keepFresh || []) records[id] = { star: 'keep-fresh' };
  for (const id of backup.learning || []) records[id] = { star: 'learning' };
  for (const [id, rating] of Object.entries(backup.progress || {})) {
    if (choices.rating.includes(rating)) records[id] = { ...records[id], rating };
  }
  return records;
}

export function recordsToBackup(records) {
  const backup = { app: 'hanzi-study', version: 1, progress: {}, keepFresh: [], learning: [] };
  for (const [id, record] of Object.entries(records)) {
    if (record.star === 'keep-fresh') backup.keepFresh.push(id);
    if (record.star === 'learning') backup.learning.push(id);
    if (record.rating === 'learned' || record.rating === 'review') backup.progress[id] = record.rating;
  }
  return backup;
}

export class SyncState {
  constructor({ storage, uid, validIds, token = () => crypto.randomUUID() }) {
    this.storage = storage;
    this.key = `hanzi-cloud-outbox-v1:${uid}`;
    this.validIds = new Set(validIds);
    this.token = token;
    this.remote = {};
  }

  readPending() {
    // Fail closed on corrupt storage instead of silently dropping unsaved edits.
    const pending = JSON.parse(this.storage.getItem(this.key) || '{}');
    if (!pending || typeof pending !== 'object' || Array.isArray(pending)) throw new Error('Invalid saved sync queue');
    for (const [id, record] of Object.entries(pending)) {
      if (!this.validIds.has(id) || !record || typeof record !== 'object') throw new Error('Invalid saved sync queue');
      for (const [field, entry] of Object.entries(record)) {
        if (!choices[field]?.includes(entry?.value) || typeof entry?.token !== 'string') throw new Error('Invalid saved sync queue');
      }
    }
    return pending;
  }

  enqueue(changes) {
    const pending = this.readPending();
    for (const [id, patch] of Object.entries(changes)) {
      if (!this.validIds.has(id)) throw new Error('Unknown card in sync update');
      const fields = cleanRecord(patch);
      if (!Object.keys(fields).length || Object.keys(fields).length !== Object.keys(patch).length) throw new Error('Invalid sync update');
      pending[id] ||= {};
      for (const [field, value] of Object.entries(fields)) pending[id][field] = { value, token: this.token() };
    }
    this.storage.setItem(this.key, JSON.stringify(pending));
  }

  acceptRemote(records) {
    this.remote = {};
    for (const [id, value] of Object.entries(records)) {
      if (this.validIds.has(id)) this.remote[id] = cleanRecord(value);
    }
    return this.view();
  }

  view() {
    const result = structuredClone(this.remote);
    for (const [id, fields] of Object.entries(this.readPending())) {
      result[id] ||= {};
      for (const [field, entry] of Object.entries(fields)) result[id][field] = entry.value;
    }
    return result;
  }

  nextBatch(limit = 400) {
    return Object.entries(this.readPending()).slice(0, limit).map(([id, fields]) => ({
      id, fields,
      patch: Object.fromEntries(Object.entries(fields).map(([field, entry]) => [field, entry.value])),
    }));
  }

  acknowledge(batch) {
    const pending = this.readPending();
    for (const { id, fields, patch } of batch) {
      this.remote[id] = { ...this.remote[id], ...patch };
      for (const [field, sent] of Object.entries(fields)) {
        // An old acknowledgement must not erase an edit made while the request was in flight.
        if (pending[id]?.[field]?.token === sent.token) delete pending[id][field];
      }
      if (pending[id] && !Object.keys(pending[id]).length) delete pending[id];
    }
    this.storage.setItem(this.key, JSON.stringify(pending));
  }

  get pendingCount() { return Object.keys(this.readPending()).length; }
}

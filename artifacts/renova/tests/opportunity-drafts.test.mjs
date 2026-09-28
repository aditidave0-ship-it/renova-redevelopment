import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyBrief, validateBrief, saveDraft, readDrafts, removeDraft, briefText, DRAFT_KEY } from '../src/data/opportunity-drafts.ts';
const valid = { ...emptyBrief, name: 'Test Society', location: 'Andheri West', homes: '42', stage: 'Exploring redevelopment', services: ['PMC'], requirements: 'Help prepare a feasibility study and tender.' };
const storage = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
test('required details reject empty, fractional or invalid values but optional facts can stay unknown', () => {
  assert.deepEqual(validateBrief(valid), {});
  assert.ok(validateBrief(emptyBrief).name);
  for (const homes of ['0', '-1', '1.5', 'NaN', '10001']) assert.ok(validateBrief({ ...valid, homes }).homes);
  assert.ok(validateBrief({ ...valid, age: '301' }).age);
  assert.ok(validateBrief({ ...valid, plotArea: '-1' }).plotArea);
  assert.ok(validateBrief({ ...valid, services: [] }).services);
  assert.ok(validateBrief({ ...valid, requirements: 'too short' }).requirements);
});
test('saved drafts survive reload, edits replace the same record, delete preserves other drafts', () => {
  const store = storage();
  const draft = { id: 'one', brief: valid, updatedAt: '2026-09-28T10:00:00Z' };
  saveDraft(store, draft);
  saveDraft(store, { ...draft, id: 'two' });
  saveDraft(store, { ...draft, brief: { ...valid, homes: '50' } });
  assert.equal(readDrafts(store).length, 2);
  assert.equal(readDrafts(store)[0].brief.homes, '50');
  removeDraft(store, 'one');
  assert.equal(readDrafts(store)[0].id, 'two');
});
test('unreadable storage is never overwritten and quota failures propagate', () => {
  const store = storage();
  store.setItem(DRAFT_KEY, '{bad');
  assert.throws(() => saveDraft(store, { id: 'one', brief: valid, updatedAt: '2026-09-28T10:00:00Z' }));
  assert.equal(store.getItem(DRAFT_KEY), '{bad');
  store.setItem(DRAFT_KEY, JSON.stringify({ version: 1, drafts: [{ id: 'x', brief: {}, updatedAt: 'bad' }] }));
  assert.throws(() => readDrafts(store));
  assert.throws(() => saveDraft({ getItem: () => null, setItem: () => { throw Error('quota'); } }, { id: 'one', brief: valid, updatedAt: '2026-09-28T10:00:00Z' }));
});
test('export preserves supplied facts, marks missing fields and cannot imply publication', () => {
  const text = briefText(valid);
  assert.ok(text.includes('Not published or verified'));
  assert.ok(text.includes('Number of homes: 42'));
  assert.ok(text.includes('Approximate plot area (sq m): Information not yet provided'));
  assert.ok(text.includes('Professionals required: PMC'));
});

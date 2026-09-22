import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load-ts.mjs';
globalThis.window = {};
const { RecallDB } = load('src/lib/db.ts');
const { saveDeck, removeDeck, restoreDeck, permanentlyDeleteDeck } = load('src/data/decks.ts');
const { synchronize } = load('src/data/sync/syncEngine.ts');
const { applyRemote } = load('src/data/sync/localRepository.ts');
const { mergeEnvelopes } = load('src/data/sync/model.ts');
const { commitAttempts, newHistory } = load('src/data/history.ts');
const { createBackup, validateBackup, restoreBackup } = load('src/data/backup.ts');
const input = { title: 'Biology', subject: 'Science', description: '', cards: [{term: 'Cell', definition: 'Unit of life'}, {term: 'DNA', definition: 'Genetic material'}] };
function cloud() {
  const rows = new Map(); let offline = false;
  return { rows, set offline(value) { offline = value; }, async pull() { if (offline) throw new Error('Network unavailable'); return structuredClone([...rows.values()]); }, async push(incoming) {
    if (offline) throw new Error('Network unavailable');
    const id = `${incoming.entityType}:${incoming.entityId}`, old = rows.get(id);
    let merged = old ? mergeEnvelopes(old, incoming) : structuredClone(incoming);
    const parent = merged.fields.deckId?.value;
    if (parent && rows.get(`decks:${parent}`)?.purged) merged = {entityType: incoming.entityType, entityId: incoming.entityId, fields: {}, versions: {}, purged: true};
    rows.set(id, merged);
    if (merged.entityType === 'decks' && merged.purged) for (const [key, row] of rows) if (row.fields.deckId?.value === merged.entityId) rows.set(key, {entityType: row.entityType, entityId: row.entityId, fields: {}, versions: {}, purged: true});
    return structuredClone(merged);
  }};
}
async function devices(fn) { const a = new RecallDB(crypto.randomUUID()), b = new RecallDB(crypto.randomUUID()); try { await fn(a,b,cloud()); } finally { await a.delete(); await b.delete(); } }

test('edits, reorders, omitted cards, stars, metadata and outbox survive close/reopen', () => devices(async a => {
  const id = await saveDeck(input, undefined, a); const cards = await a.cards.toArray();
  await a.cards.update(cards[0].id, {termStarred:true, mastery:60, reviewCount:8});
  await saveDeck({...input,title:'Renamed',cards:[{...cards[1],definition:'Edited'}]},id,a);
  a.close(); await a.open();
  assert.equal(await a.cards.count(),2); assert.equal((await a.cards.get(cards[0].id)).mastery,60); assert.equal((await a.cards.get(cards[0].id)).termStarred,true);
  await saveDeck({...input,cards:cards.toReversed()},id,a);
  assert.equal(await a.cards.count(),2); assert.equal((await a.cards.get(cards[1].id)).position,0);
  assert.equal(await a.syncQueue.count(),3); assert.equal((await a.decks.get(id)).id,id);
  await assert.rejects(a.cards.delete(cards[0].id), /tombstone/);
}));

test('queue and local mutation commit atomically and both roll back on failure', () => devices(async a => {
  await assert.rejects(a.transaction('rw',a.decks, async () => { await a.decks.put({id:'rollback',title:'No'}); throw new Error('abort'); }),/abort/);
  assert.equal(await a.decks.count(),0); assert.equal(await a.syncQueue.count(),0);
}));

test('first login requires consent, network errors retain local data, reconnect delivers same IDs', () => devices(async(a,b,server) => {
  const id = await saveDeck(input,undefined,a);
  assert.equal((await synchronize(a,server,'account')).needsConsent,true); assert.equal(server.rows.size,0);
  server.offline=true; await assert.rejects(synchronize(a,server,'account',true),/Network/);
  assert.equal(await a.cards.count(),2); assert.equal(await a.syncQueue.count(),3);
  server.offline=false; await synchronize(a,server,'account'); await synchronize(b,server,'account');
  assert.equal((await b.decks.get(id)).title,'Biology'); assert.deepEqual((await b.cards.toArray()).map(c=>c.id),(await a.cards.toArray()).map(c=>c.id)); assert.equal(await a.syncQueue.count(),0);
  await applyRemote(a,[]); assert.equal(await a.cards.count(),2);
  await assert.rejects(synchronize(a,server,'other-account',true),/another account/); assert.equal(await a.cards.count(),2);
}));

test('two devices merge term edits, legacy star fields and additive offline study without duplicates', () => devices(async(a,b,server) => {
  const id=await saveDeck(input,undefined,a); await synchronize(a,server,'u',true); await synchronize(b,server,'u');
  const card=(await b.cards.toArray())[0]; await b.cards.update(card.id,{definitionStarred:true}); await synchronize(b,server,'u'); await synchronize(a,server,'u');
  assert.equal((await a.cards.get(card.id)).definitionStarred,true);
  await a.cards.update(card.id,{term:'Edited on A',termStarred:true,updatedAt:Date.now()});
  const hb=newHistory(id,'Biology','learn'); await commitAttempts(hb,[{id:'event-b',cardId:card.id,correct:true}],false,b);
  const ha=newHistory(id,'Biology','learn'); await commitAttempts(ha,[{id:'event-a',cardId:card.id,correct:true}],false,a);
  await synchronize(a,server,'u'); await synchronize(b,server,'u'); await synchronize(a,server,'u'); await synchronize(b,server,'u');
  for (const db of [a,b]) { const result=await db.cards.get(card.id); assert.equal(result.term,'Edited on A'); assert.equal(result.termStarred,true); assert.equal(result.definitionStarred,true); assert.equal(result.reviewCount,2); assert.equal(result.mastery,20); assert.equal(await db.events.count(),2); }
  await synchronize(a,server,'u'); assert.equal(await a.events.count(),2);
}));

test('Trash restores full content; permanent deletion reaches offline device and cannot resurrect', () => devices(async(a,b,server) => {
  const id=await saveDeck(input,undefined,a); await synchronize(a,server,'u',true); await synchronize(b,server,'u');
  await removeDeck(id,a); assert.ok((await a.decks.get(id)).deletedAt); assert.equal(await a.cards.count(),2);
  await synchronize(a,server,'u'); await synchronize(b,server,'u'); assert.ok((await b.decks.get(id)).deletedAt);
  await restoreDeck(id,a); await synchronize(a,server,'u'); await synchronize(b,server,'u'); assert.equal((await b.decks.get(id)).deletedAt,null);
  const card=(await b.cards.toArray())[0]; await b.cards.update(card.id,{term:'Stale offline content'});
  await removeDeck(id,a); await permanentlyDeleteDeck(id,a); await synchronize(a,server,'u'); await synchronize(b,server,'u'); await synchronize(a,server,'u');
  for (const db of [a,b]) { assert.ok((await db.decks.get(id)).purgedAt); assert.equal((await db.decks.get(id)).title,undefined); for (const row of await db.cards.toArray()) { assert.ok(row.purgedAt); assert.equal(row.term,undefined); } }
  await assert.rejects(restoreDeck(id,b),/permanently/);
}));

test('acknowledging an in-flight old write cannot discard a newer local change', () => devices(async(a,b,server) => {
  const id=await saveDeck(input,undefined,a); await synchronize(a,server,'u',true);
  await a.decks.update(id,{title:'First'}); const original=server.push;
  server.push=async envelope=>{ await a.decks.update(id,{title:'Second'}); return original(envelope); };
  await synchronize(a,server,'u'); assert.equal((await a.decks.get(id)).title,'Second'); assert.ok(await a.syncQueue.count());
  server.push=original; await synchronize(a,server,'u'); await synchronize(b,server,'u'); assert.equal((await b.decks.get(id)).title,'Second');
}));

test('conflicting text converges deterministically and retains both revisions', () => devices(async(a,b,server) => {
  await saveDeck(input,undefined,a); await synchronize(a,server,'u',true); await synchronize(b,server,'u');
  const card=(await a.cards.toArray())[0]; await a.cards.update(card.id,{term:'Alpha'}); await b.cards.update(card.id,{term:'Beta'});
  await synchronize(a,server,'u'); await synchronize(b,server,'u'); await synchronize(a,server,'u');
  const left=await a.cards.get(card.id),right=await b.cards.get(card.id); assert.equal(left.term,right.term);
  const revisions=Object.values(left._sync.versions.term); assert.ok(revisions.includes('Alpha')); assert.ok(revisions.includes('Beta'));
}));

test('backup validates before writing, merges all durable fields and replaces locally with safety copy', () => devices(async(a,b,server) => {
  const id=await saveDeck({...input,cards:[{...input.cards[0],acceptedAnswers:['Cell unit']}]},undefined,a);
  const card=(await a.cards.toArray())[0]; await a.cards.update(card.id,{termStarred:true,definitionStarred:true});
  await commitAttempts(newHistory(id,'Biology','learn'),[{id:'backup-event',cardId:card.id,correct:true}],true,a);
  await a.prefs.put({id:'local',dailyGoal:42,displayName:'Student',theme:'dark'});
  const backup=await createBackup(a); validateBackup(backup);
  const malformed=structuredClone(backup); malformed.data.cards.push({...malformed.data.cards[0]});
  await assert.rejects(restoreBackup(malformed,'replace',a),/duplicate/); assert.equal(await a.cards.count(),1);
  await restoreBackup(backup,'merge',b); assert.equal((await b.cards.get(card.id)).reviewCount,1); assert.equal((await b.cards.get(card.id)).termStarred,true); assert.deepEqual((await b.cards.get(card.id)).acceptedAnswers,['Cell unit']); assert.equal((await b.prefs.get('local')).dailyGoal,42);
  await synchronize(b,server,'u',true); const extra=await saveDeck({...input,title:'Keep in cloud'},undefined,b); await synchronize(b,server,'u');
  await restoreBackup(backup,'replace',b); assert.equal(await b.decks.get(extra),undefined); assert.ok(await b.syncMeta.get('beforeRestore'));
  await synchronize(b,server,'u'); assert.equal((await b.decks.get(extra)).title,'Keep in cloud');
}));

test('saving an old editor snapshot does not overwrite untouched cloud edits', () => devices(async a => {
  const id=await saveDeck(input,undefined,a),cards=await a.cards.toArray();
  const stale={...input,original:{title:input.title,description:input.description,subject:input.subject},cards:cards.map(card=>({...card,original:{term:card.term,definition:card.definition,position:card.position}}))};
  await a.cards.update(cards[0].id,{definition:'Changed on another device'});await a.decks.update(id,{subject:'Remote subject'});
  stale.title='Local title edit';await saveDeck(stale,id,a);
  assert.equal((await a.cards.get(cards[0].id)).definition,'Changed on another device');assert.equal((await a.decks.get(id)).subject,'Remote subject');assert.equal((await a.decks.get(id)).title,'Local title edit');
}));

test('failed upload increments retry count without dropping content, then reconnect converges', () => devices(async(a,b,server) => {
  await saveDeck(input,undefined,a); const original=server.push;
  server.push=async()=>{throw new Error('Upload failed');};await assert.rejects(synchronize(a,server,'u',true),/Upload failed/);
  assert.equal(await a.cards.count(),2);assert.equal(await a.syncQueue.count(),3);assert.ok((await a.syncQueue.toArray()).some(row=>row.attemptCount===1));
  server.push=original;await synchronize(a,server,'u');await synchronize(b,server,'u');assert.equal(await b.cards.count(),2);assert.equal(await a.syncQueue.count(),0);
}));

test('malformed backups leave all data untouched and old backups cannot revive terminal IDs', () => devices(async a => {
  const id=await saveDeck(input,undefined,a),backup=await createBackup(a);
  for (const mutate of [b=>{b.data.cards[0].term=42;},b=>{b.data.cards[0].acceptedAnswers=[42];},b=>{b.data.cards[0].reviewCount='many';},b=>{b.data.cards[0]._sync.fields.term.stamp='invalid';},b=>{b.data.cards[0].deckId='missing';},b=>{b.data.cards[0]._reviewBase={card:{mastery:'bad'},eventIds:[]};}]) {
    const malformed=structuredClone(backup);mutate(malformed);await assert.rejects(restoreBackup(malformed,'replace',a),/Invalid BrainBo backup/);assert.equal(await a.cards.count(),2);assert.equal((await a.decks.get(id)).title,'Biology');
  }
  await removeDeck(id,a);await permanentlyDeleteDeck(id,a);await restoreBackup(backup,'replace',a);assert.ok((await a.decks.get(id)).purgedAt);assert.equal((await a.decks.get(id)).title,undefined);
}));

test('optional fields remain valid after cloud round trips and full backup restore', () => devices(async(a,b,server) => {
  await saveDeck(input,undefined,a);await synchronize(a,server,'u',true);await synchronize(b,server,'u');
  const backup=await createBackup(b);assert.doesNotThrow(()=>validateBackup(backup));
  for (const card of backup.data.cards) assert.equal(card.acceptedAnswers,undefined);
  await restoreBackup(backup,'merge',a);assert.equal(await a.cards.count(),2);
}));

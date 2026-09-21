import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { load } from './load-ts.mjs';
const { mergeEnvelopes } = load('src/data/sync/model.ts');
const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
const envelope = (type,id,values,stamp='0000000000000001:a') => ({entityType:type,entityId:id,fields:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{stamp,value}])),versions:{}});
async function database(fn) {
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${a}'),('${b}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
    await db.exec(readFileSync('supabase/migrations/202609210001_bolet_durability.sql','utf8'));
    const login=async id=>{ await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); };
    const push=async item=>(await db.query('select public.bolet_merge_record($1::jsonb) as payload',[JSON.stringify(item)])).rows[0].payload;
    await fn(db,login,push);
  } finally {await db.close();}
}
test('actual PostgreSQL RLS isolates users, rejects anonymous writes and disallows direct mutation',()=>database(async(db,login,push)=>{
  await login(a); await push(envelope('decks','same-id',{id:'same-id',title:'Account A'}));
  await assert.rejects(db.exec("update public.bolet_records set payload='{}'"),/permission denied/);
  await assert.rejects(db.exec('delete from public.bolet_records'),/permission denied/);
  await login(b); assert.equal((await db.query('select * from public.bolet_records')).rows.length,0);
  await push(envelope('decks','same-id',{id:'same-id',title:'Account B'}));
  assert.equal((await db.query('select payload from public.bolet_records')).rows[0].payload.fields.title.value,'Account B');
  await login(a); assert.equal((await db.query('select payload from public.bolet_records')).rows[0].payload.fields.title.value,'Account A');
  await db.exec('reset role; set role anon'); await assert.rejects(push(envelope('decks','bad',{id:'bad'})),/permission denied/);
}));
test('actual SQL merge matches local field merge and enforces terminal parent/child deletion',()=>database(async(db,login,push)=>{
  await login(a);
  const first=envelope('cards','card',{id:'card',deckId:'deck',term:'Original',definitionStarred:false});
  const left=structuredClone(first),right=structuredClone(first);
  left.fields.term={stamp:'0000000000000002:a',value:'Edited'};right.fields.definitionStarred={stamp:'0000000000000003:b',value:true};
  await push(first);await push(left);const result=await push(right);assert.deepEqual(result,mergeEnvelopes(mergeEnvelopes(first,left),right));
  await push(envelope('decks','deck',{id:'deck',title:'Delete me'}));
  await push({entityType:'decks',entityId:'deck',fields:{},versions:{},purged:true});
  const stale=await push(right);assert.equal(stale.purged,true);assert.deepEqual(stale.fields,{});
  const unknown=await push(envelope('cards','new-offline-card',{id:'new-offline-card',deckId:'deck',term:'Stale new card'}));assert.equal(unknown.purged,true);
  const deck=await push(envelope('decks','deck',{id:'deck',title:'Resurrection'},'9999999999999999:z'));assert.equal(deck.purged,true);
  const rows=(await db.query('select payload from public.bolet_records')).rows;assert.ok(rows.every(row=>row.payload.purged));
}));

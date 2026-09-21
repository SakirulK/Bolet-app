import { test, expect } from '@playwright/test';
import { seedStudy, records } from './helpers';
import type { Card, DeckRecord } from '../../src/types';

test('deck editing, explicit card removal, Trash and restore survive reload with metadata', async ({ page }) => {
  await seedStudy(page,3); await page.goto('/library/learn-deck');
  const initial=await records<Card>(page,'cards');
  await page.getByRole('button',{name:'Edit deck',exact:true}).click();
  await page.getByRole('textbox',{name:'Title',exact:true}).fill('Durable Biology');
  await page.getByRole('button',{name:'Move card 1 down',exact:true}).click();
  await page.getByRole('textbox',{name:/^term$/i}).nth(0).fill('Updated organelle');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await page.reload();
  await expect(page.getByRole('heading',{name:'Durable Biology',exact:true})).toBeVisible();
  const edited=await records<Card>(page,'cards');expect(edited).toHaveLength(3);expect(edited.map(c=>c.id).sort()).toEqual(initial.map(c=>c.id).sort());
  expect(edited.find(c=>c.id==='c0')?.termStarred).toBe(true);expect(edited.find(c=>c.id==='c1')?.definitionStarred).toBe(true);
  await page.getByRole('button',{name:'Edit deck',exact:true}).click();await page.getByRole('button',{name:'Delete card 3',exact:true}).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const removed=await records<Card>(page,'cards');expect(removed).toHaveLength(3);expect(removed.find(c=>c.id==='c2')?.deletedAt).toBeTruthy();
  await page.getByRole('button',{name:'Delete deck',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Trash is never emptied automatically');await page.getByRole('button',{name:'Move to Trash',exact:true}).click();
  await expect(page).toHaveURL(/library$/);await page.goto('/settings');await expect(page.getByText('Durable Biology',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Restore',exact:true}).click();await page.goto('/library/learn-deck');await expect(page.getByRole('heading',{name:'Durable Biology'})).toBeVisible();
  expect((await records<Card>(page,'cards')).filter(c=>!c.deletedAt)).toHaveLength(2);
  await page.getByRole('button',{name:'Delete deck',exact:true}).click();await page.getByRole('button',{name:'Move to Trash',exact:true}).click();await expect(page).toHaveURL(/library$/);await page.goto('/settings');await page.getByRole('button',{name:'Delete Permanently',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Keep in Trash'}).click();expect((await records<DeckRecord>(page,'decks'))[0].title).toBe('Durable Biology');
  await page.getByRole('button',{name:'Delete Permanently',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete Permanently',exact:true}).click();await expect(page.getByText('Trash is empty.')).toBeVisible();await page.reload();
  const tombstones=await records<DeckRecord>(page,'decks');expect(tombstones[0].purgedAt).toBeTruthy();expect(tombstones[0].title).toBeUndefined();
  expect((await records<Card>(page,'cards')).every(c=>c.purgedAt && !c.term)).toBe(true);
});

test('full backup exports, validates, previews and restores atomically', async ({ page }) => {
  await seedStudy(page,3);await page.goto('/settings');
  await expect(page.getByText('Local storage protection:',{exact:false})).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export BrainBo Backup'}).click();const file=await download;const path=await file.path();expect(path).toBeTruthy();
  const before=await records<Card>(page,'cards');
  await page.getByLabel('Restore BrainBo Backup',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"bolet-backup","version":999}')});
  await expect(page.getByText(/Invalid BrainBo backup/)).toBeVisible();expect(await records<Card>(page,'cards')).toEqual(before);
  await page.getByLabel('Restore BrainBo Backup',{exact:true}).setInputFiles(path!);await expect(page.getByRole('dialog')).toContainText('1 decks · 3 cards');
  await page.getByRole('combobox',{name:'Restore method'}).selectOption('replace');await expect(page.getByRole('dialog')).toContainText('does not delete unrelated cloud data');
  await page.getByRole('button',{name:'Confirm restore'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Export safety copy from before last replacement'})).toBeVisible();
  await page.reload();expect((await records<Card>(page,'cards')).map(c=>c.id)).toEqual(before.map(c=>c.id));await page.goto('/library/learn-deck');await expect(page.getByRole('heading',{name:'Biology & Computing'})).toBeVisible();
});

test('offline edit is durable across reload and has a pending outbox entry', async ({ page, context }) => {
  await seedStudy(page,3);await page.goto('/library/learn-deck');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();
  await context.setOffline(true);await page.getByRole('button',{name:'Edit deck',exact:true}).click();await page.getByRole('textbox',{name:'Title',exact:true}).fill('Saved offline');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();
  await expect(page.getByRole('heading',{name:'Saved offline',exact:true})).toBeVisible();expect((await records<Card>(page,'cards')).length).toBe(3);expect((await records(page,'syncQueue')).length).toBeGreaterThan(0);await context.setOffline(false);
});

test('Learn feedback and Test answers recover after refresh without duplicate grading',async({page})=>{
  await seedStudy(page,3);await page.goto('/practice?deck=learn-deck&mode=learn');await page.getByLabel('Shuffle',{exact:true}).uncheck();await page.getByLabel('Multiple Choice',{exact:true}).uncheck();await page.getByRole('button',{name:'Start Learning'}).click();await page.getByRole('textbox',{name:'Your answer',exact:true}).fill('Different');await page.getByRole('button',{name:'Check Answer'}).click();await expect(page.getByRole('button',{name:'I was correct'})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Resume saved Learn session'}).click();await expect(page.getByRole('textbox',{name:'Your answer',exact:true})).toHaveValue('Different');await page.getByRole('button',{name:'I was correct'}).click();await expect(page.getByRole('button',{name:'I was correct'})).toHaveCount(0);await page.reload();await page.getByRole('button',{name:'Resume saved Learn session'}).click();await expect(page.getByText('Correct',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Continue',exact:true}).click();await expect.poll(async()=>(await records(page,'events')).length).toBe(1);
  await page.goto('/practice?deck=learn-deck&mode=test');await page.getByLabel('Multiple Choice',{exact:true}).uncheck();await page.getByRole('button',{name:'Start Test'}).click();await page.getByRole('textbox',{name:'Your answer',exact:true}).fill('My saved answer');await expect.poll(async()=>(await records<{id:string;value:string}>(page,'syncMeta')).some(row=>row.id==='draft:test:learn-deck'&&row.value.includes('My saved answer'))).toBe(true);await page.reload();await page.getByRole('button',{name:'Resume saved Test'}).click();await expect(page.getByRole('textbox',{name:'Your answer',exact:true})).toHaveValue('My saved answer');expect((await records(page,'events')).length).toBe(1);
});

test('persistent storage is requested once and never described as a backup guarantee',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator.storage,'persisted',{value:async()=>false});
    Object.defineProperty(navigator.storage,'persist',{value:async()=>{localStorage.setItem('persist-count',String(Number(localStorage.getItem('persist-count')??0)+1));return false;}});
  });
  await page.goto('/settings');await expect(page.getByText('Browser managed',{exact:true})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('persist-count'))).toBe('1');await page.reload();await expect(page.getByText('Browser managed',{exact:true})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('persist-count'))).toBe('1');await expect(page.getByText(/not a backup/)).toBeVisible();
});

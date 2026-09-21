import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { seedStudy, records } from './helpers';
import { mergeEnvelopes, type Envelope } from '../../src/data/sync/model';
import type { Card } from '../../src/types';
const uid='00000000-0000-4000-8000-000000000001';
const user={id:uid,email:'student@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.test`;
async function mockCloud(context: BrowserContext, cloud: Map<string,Envelope>, available:()=>boolean) {
  await context.route('https://bolet-sync.test/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if (!available()) return route.fulfill({status:503,json:{message:'Temporarily unavailable'}});
    if (url.pathname.endsWith('/token')) return route.fulfill({json:{access_token:jwt,token_type:'bearer',expires_in:3600,refresh_token:'test-refresh',user}});
    if (url.pathname.endsWith('/user')) return route.fulfill({json:user});
    if (url.pathname.endsWith('/logout')) return route.fulfill({status:204});
    if (url.pathname.endsWith('/bolet_records')) return route.fulfill({json:[...cloud.values()].map(payload=>({payload}))});
    if (url.pathname.endsWith('/bolet_merge_record')) {
      const incoming=req.postDataJSON().incoming as Envelope,key=`${incoming.entityType}:${incoming.entityId}`;
      const merged=cloud.has(key)?mergeEnvelopes(cloud.get(key)!,incoming):incoming;cloud.set(key,merged);return route.fulfill({json:merged});
    }
    return route.fulfill({status:400,json:{message:'Unexpected test request'}});
  });
}
async function login(page: Page) {
  await page.goto('/settings');await page.getByRole('textbox',{name:'Email',exact:true}).fill('student@example.com');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
}
async function syncNow(page:Page) { await page.goto('/settings');await page.getByRole('button',{name:'Sync now'}).click();await expect(page.getByRole('status').filter({hasText:/^Synced$/})).toBeVisible(); }

test('real Auth client and sync engine: consent, two browsers, outage, sign out/in, clean-device recovery',async({page,context,browser})=>{
  test.setTimeout(90000);
  const cloud=new Map<string,Envelope>();let available=true;await mockCloud(context,cloud,()=>available);
  await seedStudy(page,3);await login(page);await expect(page.getByText('BrainBo found study data stored on this device.')).toBeVisible();expect(cloud.size).toBe(0);
  await page.getByRole('button',{name:'Add this data to my account'}).click();await expect(page.getByRole('status').filter({hasText:/^Synced$/})).toBeVisible();expect(cloud.has('decks:learn-deck')).toBe(true);
  const second=await browser.newContext({baseURL:'http://localhost:3101'});await mockCloud(second,cloud,()=>available);const other=await second.newPage();
  try {
    await login(other);await syncNow(other);await other.goto('/library/learn-deck');await expect(other.getByRole('heading',{name:'Biology & Computing'})).toBeVisible();expect((await records<Card>(other,'cards')).map(c=>c.id)).toEqual(['c0','c1','c2']);
    await other.getByRole('button',{name:'Star definition',exact:true}).first().click();await syncNow(other);await syncNow(page);expect((await records<Card>(page,'cards')).find(c=>c.id==='c0')?.definitionStarred).toBe(true);
    available=false;await page.goto('/library/learn-deck');await page.getByRole('button',{name:'Edit deck',exact:true}).click();await page.getByRole('textbox',{name:'Title',exact:true}).fill('Edited while cloud unavailable');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();await expect(page.getByRole('heading',{name:'Edited while cloud unavailable'})).toBeVisible();expect((await records(page,'syncQueue')).length).toBeGreaterThan(0);
    available=true;await syncNow(page);await syncNow(other);await other.goto('/library/learn-deck');await expect(other.getByRole('heading',{name:'Edited while cloud unavailable'})).toBeVisible();
    await page.goto('/settings');const count=cloud.size;await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();expect(cloud.size).toBe(count);expect((await records(page,'decks')).length).toBe(1);await login(page);await syncNow(page);expect((await records(page,'cards')).length).toBe(3);
    // A fresh origin storage context models clearing Safari/reinstalling/new hardware.
    const fresh=await browser.newContext({baseURL:'http://localhost:3101'});await mockCloud(fresh,cloud,()=>available);const recovered=await fresh.newPage();await login(recovered);await syncNow(recovered);await recovered.goto('/library/learn-deck');await expect(recovered.getByRole('heading',{name:'Edited while cloud unavailable'})).toBeVisible();await fresh.close();
  } finally {await second.close();}
});

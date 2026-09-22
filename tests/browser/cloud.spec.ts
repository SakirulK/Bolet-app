import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { seedStudy, records } from './helpers';
import { mergeEnvelopes, type Envelope } from '../../src/data/sync/model';
import type { Card, Prefs } from '../../src/types';

const uid='00000000-0000-4000-8000-000000000001';
const user={id:uid,email:'student@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},identities:[{id:uid,user_id:uid,identity_data:{email:'student@example.com'},provider:'email',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}],created_at:new Date().toISOString()};
const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.test`;
const session={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'test-refresh',user};

async function mockCloud(context: BrowserContext, cloud: Map<string,Envelope>, available:()=>boolean) {
  await context.route('https://bolet-sync.test/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if (!available()) return route.fulfill({status:503,json:{message:'Temporarily unavailable'}});
    if (url.pathname.endsWith('/token')) return route.fulfill({json:session});
    if (url.pathname.endsWith('/signup')) return route.fulfill({json:{user,session:null}});
    if (url.pathname.endsWith('/recover')) return route.fulfill({json:{}});
    if (url.pathname.endsWith('/user')) return req.method()==='PUT' ? route.fulfill({json:{user}}) : route.fulfill({json:user});
    if (url.pathname.endsWith('/logout')) return route.fulfill({status:204});
    if (url.pathname.endsWith('/bolet_records')) return route.fulfill({json:[...cloud.values()].map(payload=>({payload}))});
    if (url.pathname.endsWith('/bolet_merge_record')) {
      const incoming=req.postDataJSON().incoming as Envelope,key=`${incoming.entityType}:${incoming.entityId}`;
      const merged=cloud.has(key)?mergeEnvelopes(cloud.get(key)!,incoming):incoming;cloud.set(key,merged);return route.fulfill({json:merged});
    }
    return route.fulfill({status:400,json:{message:'Unexpected test request'}});
  });
}
async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByRole('textbox',{name:'Email',exact:true}).fill('student@example.com');
  await page.getByLabel('Password',{exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
}
async function completeProfile(page: Page) {
  await expect(page.getByRole('heading',{name:'Welcome to BrainBo'})).toBeVisible();
  await page.getByLabel('What should we call you?').fill('Sakirul');
  await page.getByLabel('Daily goal').fill('20');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:/Ready when you are, Sakirul/})).toBeVisible();
}
async function syncNow(page: Page) {
  await page.goto('/profile');await page.getByRole('button',{name:'Sync now'}).click();
  await expect(page.getByRole('status').filter({hasText:'Sync complete.'})).toBeVisible();
}

test('auth-first entry, forms, validation, confirmation and local-device continuation',async({page,context})=>{
  const cloud=new Map<string,Envelope>();await mockCloud(context,cloud,()=>true);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Study anywhere.'})).toBeVisible();
  await expect(page.getByText('Your decks',{exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:'Create Account'}).click();
  await page.getByLabel('Email').fill('student@example.com');await page.getByLabel('Password',{exact:true}).fill('password1');await page.getByLabel('Confirm password').fill('password2');
  await page.getByRole('button',{name:'Create Account',exact:true}).click();await expect(page.getByText('Passwords do not match.',{exact:true})).toBeVisible();
  await page.getByLabel('Confirm password').fill('password1');await page.getByRole('button',{name:'Create Account',exact:true}).click();
  await expect(page.getByText('Check your email to confirm your BrainBo account.')).toBeVisible();await page.getByRole('link',{name:'Return to Sign In'}).click();
  await page.getByRole('link',{name:'Forgot Password?'}).click();await expect(page.getByRole('heading',{name:'Reset your password'})).toBeVisible();await page.getByLabel('Email').fill('student@example.com');await page.getByRole('button',{name:'Send reset link'}).click();
  await expect(page.getByRole('status')).toHaveText('Check your email for a password reset link.');
  await page.goto('/reset-password');await page.getByLabel('New password').fill('new-password');await page.getByLabel('Confirm password').fill('different-password');await page.getByRole('button',{name:'Save new password'}).click();await expect(page.getByText('Passwords do not match.',{exact:true})).toBeVisible();
  await page.goto('/welcome');await page.getByRole('button',{name:'Continue on this device'}).click();await seedStudy(page,3);await page.goto('/welcome');
  await expect(page.getByText('BrainBo found study data saved on this device.')).toBeVisible();await page.getByRole('button',{name:'Continue on this device'}).click();
  await page.goto('/library/learn-deck');await expect(page.getByRole('heading',{name:'Biology & Computing'})).toBeVisible();
});

test('local migration, profile, persisted session, sign-out safety and new-device recovery',async({page,context,browser})=>{
  test.setTimeout(100000);const cloud=new Map<string,Envelope>();let available=true;await mockCloud(context,cloud,()=>available);
  await page.goto('/welcome');await page.getByRole('button',{name:'Continue on this device'}).click();await seedStudy(page,3);await signIn(page);
  await expect(page.getByRole('heading',{name:'BrainBo found study data on this device'})).toBeVisible();expect(cloud.size).toBe(0);
  await page.getByRole('button',{name:'Add this data to my account'}).click();await expect(page.getByRole('heading',{name:'Your BrainBo data is protected and synced.'})).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();await completeProfile(page);
  expect((await records<Prefs>(page,'prefs'))[0]).toMatchObject({displayName:'Sakirul',dailyGoal:20,profileConfigured:true});await syncNow(page);expect(cloud.has('decks:learn-deck')).toBe(true);await page.getByLabel('New password').fill('replacement-password');await page.getByRole('button',{name:'Update password'}).click();await expect(page.getByLabel('New password')).toHaveValue('');
  await page.reload();await expect(page.getByRole('heading',{name:'Sakirul'})).toBeVisible();await expect(page.getByRole('heading',{name:'Study anywhere.'})).toHaveCount(0);
  const fresh=await browser.newContext({baseURL:'http://localhost:3101'});await mockCloud(fresh,cloud,()=>available);const recovered=await fresh.newPage();
  try {await signIn(recovered);await expect(recovered.getByText('Getting your BrainBo library…')).toBeVisible();await expect(recovered.getByRole('heading',{name:/Ready when you are, Sakirul/})).toBeVisible();await recovered.goto('/library/learn-deck');await expect(recovered.getByRole('heading',{name:'Biology & Computing'})).toBeVisible();expect((await records<Card>(recovered,'cards')).map(card=>card.id)).toEqual(['c0','c1','c2']);} finally {await fresh.close();}
  await page.goto('/library');await page.getByRole('button',{name:'Import deck',exact:true}).click();
  await page.getByLabel('Choose BrainBo deck file').setInputFiles({name:'shared.brainbo-deck.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'brainbo-deck',version:1,exportedAt:new Date().toISOString(),deck:{title:'Shared deck',description:'Content only',subject:'Science',cards:[{term:'Synapse',definition:'Connection between neurons'}]}}))});
  await page.getByRole('button',{name:'Add to Library',exact:true}).click();await expect(page.getByRole('status')).toContainText('Shared deck added');
  const importedDeck=(await records<{id:string;title:string}>(page,'decks')).find(deck=>deck.title==='Shared deck')!;await syncNow(page);expect(cloud.has(`decks:${importedDeck.id}`)).toBe(true);expect(cloud.has(`cards:${(await records<Card>(page,'cards')).find(card=>card.deckId===importedDeck.id)!.id}`)).toBe(true);
  available=false;await page.goto('/library/learn-deck');await page.addInitScript(() => Object.defineProperty(Navigator.prototype,'onLine',{configurable:true,get:()=>false}));await page.reload();await expect(page.getByRole('heading',{name:'Biology & Computing'})).toBeVisible();await page.getByRole('button',{name:'Flashcards'}).click();await expect(page.getByTestId('flashcard')).toBeVisible();available=true;
  await page.goto('/profile');await page.getByRole('button',{name:'Sign out'}).click();await expect(page.getByRole('heading',{name:'Study anywhere.'})).toBeVisible();await expect(page.getByText('Study data is still stored on this device.')).toBeVisible();expect((await records(page,'decks')).length).toBe(2);
  await page.getByRole('button',{name:'Continue on this device'}).click();await page.goto('/library/learn-deck');await expect(page.getByRole('heading',{name:'Biology & Computing'})).toBeVisible();
});

test('upload consent can be deferred without deleting or uploading local data',async({page,context})=>{
  const cloud=new Map<string,Envelope>();await mockCloud(context,cloud,()=>true);
  await page.goto('/welcome');await page.getByRole('button',{name:'Continue on this device'}).click();await seedStudy(page,2);await signIn(page);
  await page.getByRole('button',{name:'Not now'}).click();await completeProfile(page);expect(cloud.size).toBe(0);expect((await records(page,'cards')).length).toBe(2);
  await page.goto('/profile');await expect(page.getByText('Local study data is waiting for your approval before it is added to this account.',{exact:true})).toBeVisible();
});

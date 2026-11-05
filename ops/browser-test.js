#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createServer } = require('./server');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wine-ops-browser-'));
  const shots = path.join(__dirname, '..', 'scratch', 'ops-preview');
  let browser, server;
  const write = async (name, value) => { const file = path.join(root, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, value); };
  try {
    const now = new Date().toISOString();
    await write('ops/STATUS.md',`updated: ${now}\nauthor: codex:coordinator\n\n# Startup verified; gameplay next\n\n## Needs attention\n- **Choose** the test version.\n\n## Next\n- Verify controls. <script>window.injected=true</script>\n`);
    await write('TODOS.md', '## Current work\n- [~] Fix startup\n  id: T-1\n  candidate: demo\n  owner: codex:one\n  started: ' + now + '\n  progress: ' + now + '\n- [ ] Verify gameplay\n  candidate: demo\n');
    await write('test/candidate-corpus/manifest.json', JSON.stringify({ candidates: [
      { id: 'demo', name: 'Demo <app>', version: '1.0', notes: '<script>window.injected=true</script>' },
      { id: 'other', name: 'Another candidate', version: '2.0' },
    ] }));
    await write('messageboard.txt', '2026-10-01 codex PROGRESS startup fault reproduced\n<script>window.injected=true</script>\n');
    await write('scratch/runs/R-1/result.json', JSON.stringify({ candidateId: 'demo', taskId: 'T-1', agentId: 'codex:one', startedAt: now, outcome: 'failed', route: 'startup', screenshot: 'screen.png', diagrams: ['flow.png'], command: 'node test/run.js --app=demo', summary: 'Fault before menu' }));
    await write('scratch/runs/R-1/screen.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=', 'base64'));
    await write('scratch/runs/R-1/flow.png', await fs.readFile(path.join(root, 'scratch/runs/R-1/screen.png')));
    await write('codex/one.jsonl', [
      { type: 'session_meta', timestamp: now, payload: { id: 'one', cwd: root } },
      { type: 'turn_context', timestamp: now, payload: { model: 'codex-fixture' } },
      { type: 'event_msg', timestamp: now, payload: { type: 'task_started' } },
      { type: 'event_msg', timestamp: now, payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 100, cached_input_tokens: 80, output_tokens: 10 }, model_context_window: 200 } } },
    ].map(JSON.stringify).join('\n') + '\n');
    await write('claude/two.jsonl', JSON.stringify({ type: 'assistant', cwd: root, sessionId: 'two', timestamp: now, message: { model: 'claude-fixture', stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'Bash' }], usage: { input_tokens: 10, cache_read_input_tokens: 80, cache_creation_input_tokens: 10, output_tokens: 5 } } }) + '\n');
    server = createServer({ root, codexRoot: path.join(root, 'codex'), claudeRoot: path.join(root, 'claude'), processProbe: async () => ({
      checkedAt: new Date().toISOString(), error: null, registry: [],
      processes: [{pid: 12345, ppid: 1, name: 'codex', state: 'S', elapsed: '01:02', started: 'Thu Oct 1 12:00:00 2026', cpuPercent:2.5,rssBytes:128*1024**2}, {pid:12346, ppid:12345, name:'node', state:'R', elapsed:'00:20', started:'Thu Oct 1 12:00:42 2026',cpuPercent:120,rssBytes:1024**3}],
      files: new Map([[path.join(root, 'codex/one.jsonl'), new Set([12345])]]),
    }) });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // The redesign lands on Home; check its four sections, then walk the classic views it keeps under More.
    await page.waitForSelector('#main .kpis');
    assert.equal(await page.$eval('#main .kpi', els => els.length), 4);
    assert.match(await page.$eval('#page-title', el => el.textContent), /Home/);
    await page.locator('a[data-view="games"]').click(); await page.waitForSelector('#main .games .game');
    await page.locator('a[data-view="tasks"]').click(); await page.waitForSelector('#main .board .col');
    // Retired classic routes redirect into the merged views.
    await page.evaluate(h => { location.hash = h; }, '#overview');
    await page.waitForFunction(() => location.hash === '#home' && document.querySelector('a.on[data-view="home"], a[aria-current][data-view="home"]'));
    await page.waitForSelector('.briefing-headline');
    assert.match(await page.$eval('.briefing-headline',el=>el.textContent),/Startup verified/);
    assert.match(await page.$eval('.briefing-meta',el=>el.textContent),/codex:coordinator/);
    assert.equal(await page.$$eval('.briefing-copy script',els=>els.length),0);
    assert.equal(await page.$eval('.briefing-copy strong',el=>el.textContent),'Choose');
    await page.evaluate(h => { location.hash = h; }, '#agentlist');
    await page.waitForFunction(() => location.hash === '#agents/list');
    await page.waitForSelector('.agent');
    assert.equal(await page.$$eval('.agent', els => els.length), 1);
    assert.match(await page.$eval('.agent:has([data-agent="codex:one"]) .process-line', el => el.textContent), /PID 12345/);
    assert.match(await page.$eval('.agent:has([data-agent="codex:one"]) .process-line', el => el.textContent), /2\.5% CPU · 128 MiB RSS/);
    assert.match(await page.$eval('.agent:has([data-agent="codex:one"]) .process-background', el => el.textContent), /Background 1 · 120\.0% CPU · 1\.0 GiB RSS/);
    await page.waitForSelector('.agent-history');
    assert.equal(await page.$eval('.agent-history',el=>el.open),false);
    await page.locator('.agent-history > summary').click();
    assert.match(await page.$eval('.agent:has([data-agent="claude:two"]) .process-line', el => el.textContent), /PID not matched/);
    await page.locator('[data-agent="codex:one"]').click();
    assert.match(await page.$eval('.process-table', el => el.textContent), /12346/);
    await page.locator('#close-detail').click();
    assert.equal(await page.$$eval('#main > .visual-grid .visual-card', els => els.length), 1);
    assert.equal(await page.$eval('.visual-kind', el => el.textContent), 'Diagram');
    assert.equal(await page.$$eval('.agent:has([data-agent="codex:one"]) .agent-preview', els => els.length), 1);
    assert.equal(await page.$$eval('.agent:has([data-agent="claude:two"]) .agent-preview', els => els.length), 0);
    assert.equal(await page.$$eval('.agent .metrics, .agent .visual-caption', els => els.length), 0);
    assert.ok(!await page.$eval('.agent', el => el.textContent.includes('unknown')));
    await page.locator('#main > .visual-grid .visual-card').click();
    await page.waitForFunction(() => [...document.querySelectorAll('.detail-shot')].length === 2 && [...document.querySelectorAll('.detail-shot')].every(img => img.naturalWidth > 0));
    await page.locator('#close-detail').click();
    assert.equal(await page.evaluate(() => window.injected), undefined);
    await fs.mkdir(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, 'overview.png'), fullPage: true });
    await page.evaluate(h => { location.hash = h; }, '#tasklist'); await page.waitForSelector('#filter');
    await page.locator('.queue-briefing > summary').click();
    await page.locator('[data-status-summary]').click();
    assert.match(await page.$eval('#detail-body .briefing-copy',el=>el.textContent),/Choose the test version/);
    await page.locator('#close-detail').click();
    assert.deepEqual(await page.$$eval('[data-task-group]', els => els.map(e => e.dataset.taskGroup)), ['active','ready']);
    assert.match(await page.$eval('.task-label-active', el => el.textContent), /Running/);
    assert.match(await page.$eval('.task-active .task-preview', el => el.textContent), /Task evidence/);
    assert.match(await page.$eval('.task-ready .task-preview', el => el.textContent), /Related app/);
    assert.match(await page.$eval('.task-active .task-owner', el => el.textContent), /Assigned to.*codex.*one/);
    assert.match(await page.$eval('.task-ready .task-owner', el => el.textContent), /Unassigned/);
    await page.locator('.task-active [data-agent="codex:one"]').click();
    assert.match(await page.$eval('#detail-body', el => el.textContent), /codex:one/);
    await page.locator('#close-detail').click();
    await page.locator('.task-active .task-preview').click();
    assert.match(await page.$eval('#detail-body', el => el.textContent), /Fault before menu/);
    await page.locator('#close-detail').click();
    await page.select('#filter', 'active');
    assert.equal(await page.$$eval('.task', els => els.length), 1);
    await page.locator('[data-task="T-1"]').click(); await page.waitForSelector('dialog[open]');
    assert.ok(await page.$eval('#detail-body', el => el.textContent.includes('Fix startup')));
    assert.match(await page.$eval('#detail-body .task-owner', el => el.textContent), /codex:one/);
    assert.match(await page.$eval('#detail-body .task-owner', el => el.textContent), /Terminal unavailable/);
    assert.equal(await page.$$eval('#detail-body .visual-card', els => els.length), 1);
    await page.locator('#close-detail').click();
    await write('TODOS.md', '## Queue\n- [x] Finished first in file\n- [ ] Later\n  status: backlog\n- [!] Claude paused\n  status: deferred\n  Next: Leave untouched\n- [!] Need fixture\n  blocker: Installer missing\n- [ ] Review result\n  status: review\n- [ ] Verify gameplay\n  Next: Run input probe\n- [~] Fix startup\n  id: T-1\n  Next: Compare <before> and after\n\n## Old notes\nHistorical prose\n');
    await page.select('#filter', 'all');
    await page.waitForSelector('[data-task-group="deferred"]', {timeout:15000});
    assert.deepEqual(await page.$$eval('[data-task-group]', els => els.map(e => e.dataset.taskGroup)), ['active','ready','review','blocked','backlog','deferred','done','unknown']);
    assert.equal(await page.$eval('[data-task-group="done"]', el => el.open), false);
    assert.equal(await page.$eval('[data-task-group="deferred"]', el => el.open), false);
    assert.match(await page.$eval('.task-active .task-next', el => el.textContent), /Compare <before> and after/);
    assert.equal(await page.$$eval('.task-ready .task-preview', els => els.length), 0);
    await page.locator('[data-task-group="done"] summary').click();
    await page.locator('#refresh').click();
    await page.waitForFunction(() => document.querySelector('[data-task-group="done"]')?.open);
    await page.screenshot({path:path.join(shots,'tasks.png'),fullPage:true});
    await page.locator('.subnav a[data-sub="ready"]').click(); await page.waitForFunction(() => location.hash === '#tasks/ready');
    assert.equal(await page.$$eval('[data-task-group]', els => els.length), 1);
    await page.locator('.subnav a[data-sub="all"]').click(); await page.waitForFunction(() => location.hash === '#tasks/all');
    await page.setViewport({width:390,height:844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({path:path.join(shots,'tasks-mobile.png'),fullPage:true});
    await page.setViewport({width:1440,height:1000});
    await page.locator('a[data-view="corpus"]').click(); await page.waitForSelector('.candidate');
    await page.type('#search', 'Demo');
    assert.equal(await page.$$eval('.candidate', els => els.length), 1);
    await page.locator('[data-candidate="demo"]').click();
    await page.waitForSelector('.detail-shot');
    await page.waitForFunction(() => document.querySelector('.detail-shot').naturalWidth > 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    await page.screenshot({ path: path.join(shots, 'candidate.png'), fullPage: true });
    await page.locator('[data-run="scratch/runs/R-1"]').click();
    assert.ok(await page.$eval('#detail-body', el => el.textContent.includes('Fault before menu')));
    await page.locator('#close-detail').click();
    await page.locator('a[data-view="agentlist"]').click(); await page.waitForSelector('[data-agent="claude:two"]');
    await page.locator('.agent:has([data-agent="codex:one"]) .agent-preview').click();
    assert.ok(await page.$eval('#detail-body', el => el.textContent.includes('flow.png')));
    await page.locator('#close-detail').click();
    await page.$eval('.agent-history',el=>{if(!el.open)el.querySelector('summary').click();});
    await page.locator('[data-agent="claude:two"]').click();
    assert.ok(await page.$eval('#detail-body', el => el.textContent.includes('Cache write')));
    await page.locator('#close-detail').click();
    await page.setViewport({ width: 390, height: 844 });
    await page.locator('a[data-view="overview"]').click();
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Operations console');
    await write('ops/STATUS.md','# Fresh TLDR from the agent\n\n## Next\n- Verify the latest evidence.\n');
    await page.waitForFunction(()=>document.querySelector('.briefing-headline')?.textContent==='Fresh TLDR from the agent',{timeout:15000});
    assert.match(await page.$eval('.briefing-meta',el=>el.textContent),/Update time not recorded/);
    await page.screenshot({ path: path.join(shots, 'mobile.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    // A real filesystem change must arrive through polling without navigation.
    await write('messageboard.txt', 'fresh-poll-marker\n');
    await page.locator('a[data-view="activity"]').click();
    await page.waitForFunction(() => document.querySelector('#main').textContent.includes('fresh-poll-marker'), { timeout: 15000 });
    assert.deepEqual(errors, []);
    await write('TODOS.md', '- [!] Obtain installer\n  id: B-1\n  blocker: Missing fixture\n  needs: Choose the test version\n  owner: codex:one\n');
    await page.setViewport({width:1440,height:1000});
    await page.evaluate(h => { location.hash = h; }, '#blockers');
    await page.waitForFunction(() => location.hash === '#tasks/blocked');
    await page.waitForSelector('[data-blocker="B-1"]', {timeout:15000});
    await page.locator('[data-blocker="B-1"]').click();
    await page.type('#reply-text','Use version 1.0; verify startup before resuming.');
    await page.locator('#blocker-reply button').click();
    await page.waitForFunction(() => document.querySelector('#reply-status')?.textContent.includes('Posted.'));
    assert.match(await fs.readFile(path.join(root,'messageboard.txt'),'utf8'),/\[OPS-REPLY B-1\] Use version 1.0/);
    assert.match(await fs.readFile(path.join(root,'TODOS.md'),'utf8'),/\[!\]/);
    await page.locator('#close-detail').click();
    await page.waitForFunction(() => document.querySelector('.blocker')?.textContent.includes('Reply posted'));
    await page.screenshot({path:path.join(shots,'blockers.png'),fullPage:true});
    await write('TODOS.md', '- [~] Work on Demo\n  id: T-1\n  candidate: demo\n- [ ] Queue another\n  candidate: other\n');
    await write('test/candidate-corpus/manifest.json', JSON.stringify({candidates:[
      {id:'passed',name:'A Passed'}, {id:'unknown',name:'B Unknown'},
      {id:'untested',name:'C Untested'}, {id:'failed',name:'D Failed'},
      {id:'other',name:'E Queued'}, {id:'demo',name:'Z Working'},
    ]}));
    for(const outcome of ['passed','unknown','failed']) await write(`scratch/runs/${outcome}/result.json`,JSON.stringify({candidateId:outcome,startedAt:now,outcome}));
    await page.locator('a[data-view="corpus"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.candidate').length === 6,{timeout:15000});
    assert.deepEqual(await page.$$eval('.candidate',els=>els.map(e=>e.dataset.candidate)),['demo','other','failed','unknown','passed','untested']);
    assert.match(await page.$eval('.candidate-working',el=>el.textContent),/In progress.*Work on Demo/s);
    await write('scratch/runs/R-new/result.json',JSON.stringify({candidateId:'demo',startedAt:new Date(Date.parse(now)+1000).toISOString(),outcome:'harness-error'}));
    await page.waitForFunction(()=>document.querySelector('[data-candidate="demo"]')?.textContent.includes('Earlier capture'),{timeout:15000});
    assert.match(await page.$eval('[data-candidate="demo"]',el=>el.textContent),/Latest run: harness-error/);
    assert.ok(await page.$eval('[data-candidate="demo"] img',el=>el.complete && el.naturalWidth>0));
    await page.locator('[data-candidate="demo"]').click();
    assert.match(await page.$eval('#detail-body',el=>el.textContent),/Earlier capture; latest attempt: harness-error/);
    assert.equal(await page.$eval('.detail-shot',el=>el.alt),'Earlier run capture');
    await page.locator('#close-detail').click();
    await page.select('#filter','working');
    assert.equal(await page.$$eval('.candidate',els=>els.length),1);
    await page.select('#filter','all');
    await page.screenshot({path:path.join(shots,'corpus-ranked.png'),fullPage:true});
    await page.setViewport({width:390,height:844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepEqual(errors, []);
    await page.setViewport({width:1440,height:1000});
    await page.evaluate(h => { location.hash = h; }, '#tasklist');await page.waitForSelector('#new-task');
    await page.locator('#new-task').click();
    await page.type('#task-title','Verify gameplay <safe>');
    await page.type('#task-done','Race starts and steering works');
    await page.select('#task-candidates','demo');
    await page.screenshot({path:path.join(shots,'task-create.png'),fullPage:true});
    await page.locator('#task-editor-form [type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#task-editor').open && document.querySelector('#detail-body h1')?.textContent==='Verify gameplay <safe>');
    assert.match(await page.$eval('#task-live-status',el=>el.textContent),/Awaiting pickup/);
    const createdId=await page.$eval('#task-note',el=>el.dataset.taskId);
    await page.type('#task-note-text','Please verify café 日本語 <script> stays text.');
    await page.locator('#task-note [type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#task-note-status')?.textContent.includes('Posted.'));
    await page.waitForFunction(()=>document.querySelector('#task-discussion')?.textContent.includes('café 日本語 <script>'));
    assert.match(await page.$eval('#task-discussion',el=>el.textContent),/café 日本語 <script>/);
    await page.locator('#detail-body [data-edit-task]').click();
    await page.$eval('#task-title',el=>el.value='Revised gameplay request');
    // A coordinator edit while the form is open must not get overwritten.
    const todoPath=path.join(root,'TODOS.md');
    await fs.appendFile(todoPath,'  accepted: '+now+'\n  accepted-by: codex:one\n  owner: codex:one\n');
    await page.locator('#task-editor-form [type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#task-editor-conflict').hidden);
    assert.equal(await page.$eval('#task-title',el=>el.value),'Revised gameplay request');
    await page.locator('#task-editor-reload').click();
    await page.waitForFunction(()=>!document.querySelector('#task-editor-latest').hidden);
    assert.match(await page.$eval('#task-editor-latest',el=>el.textContent),/accepted-by: codex:one/);
    await page.locator('#task-editor-form [type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#task-editor').open && document.querySelector('#detail-body h1')?.textContent==='Revised gameplay request');
    assert.match(await page.$eval('#task-live-status',el=>el.textContent),/Accepted/);
    assert.match(await page.$eval('#task-live-owner',el=>el.textContent),/codex:one/);
    await page.screenshot({path:path.join(shots,'task-detail.png'),fullPage:true});
    await page.locator('#detail-body [data-status="deferred"]').click();
    await page.waitForFunction(()=>document.querySelector('#task-live-status')?.textContent.includes('Deferred'));
    await page.locator('#detail-body [data-status="ready"]').click();
    await page.waitForFunction(()=>document.querySelector('#task-live-status')?.textContent.includes('Up next'));
    await page.locator('#close-detail').click();
    await page.locator('#new-task').click();await page.type('#task-title','Second request');await page.type('#task-done','Evidence recorded');
    await page.locator('#task-editor-form [type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#task-editor').open && document.querySelector('#detail-body h1')?.textContent==='Second request');
    const secondId=await page.$eval('#task-note',el=>el.dataset.taskId);
    await page.locator('#close-detail').click();
    await page.locator(`[data-move-task="${secondId}"][data-direction="up"]`).click();
    await page.waitForFunction(()=>document.querySelector('#task-queue-status')?.textContent==='Queue updated.');
    const taskOrder=await page.$$eval('.task-body > [data-task]',els=>els.map(el=>el.dataset.task));
    assert.ok(taskOrder.indexOf(secondId)<taskOrder.indexOf(createdId));
    await page.setViewport({width:390,height:844});
    await page.locator('#new-task').click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(shots,'task-create-mobile.png'),fullPage:true});
    await page.locator('#task-editor-cancel').click();
    await write('test/candidate-corpus/manifest.json', JSON.stringify({candidates:[
      {id:'generally',name:'GeneRally'}, {id:'dxball',name:'DX-Ball'},
      {id:'jardinains',name:'Jardinains'}, {id:'new-game',name:'New game'},
    ]}));
    await write('ops/corpus-status.json',JSON.stringify({reviewedAt:now,entries:[
      {id:'dxball',origin:'Freeware'}, {id:'jardinains',origin:'Demo'},
    ]}));
    await page.locator('a[data-view="corpus"]').click();
    await page.waitForSelector('[data-category="arcade"]',{timeout:15000});
    assert.deepEqual(await page.$$eval('.corpus-category',els=>els.map(e=>e.dataset.category)),['arcade','racing','unclassified']);
    await page.select('#corpus-category','arcade');
    assert.deepEqual(await page.$$eval('.candidate',els=>els.map(e=>e.dataset.candidate)),['dxball','jardinains']);
    await page.select('#corpus-group','Freeware');
    assert.equal(await page.$$eval('.candidate',els=>els.length),1);
    await page.select('#filter','with-shot');
    assert.equal(await page.$$eval('.candidate',els=>els.length),0);
    assert.match(await page.$eval('#main',el=>el.textContent),/No matching candidates/);
    await page.select('#filter','all');
    await page.select('#corpus-group','all');
    await page.select('#corpus-category','all');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(shots,'corpus-categories-mobile.png'),fullPage:true});
    await page.setViewport({width:1440,height:1000});
    await page.screenshot({path:path.join(shots,'corpus-categories.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log(`PASS dashboard navigation, evidence, task creation/edit conflicts/discussion/pickup/reorder/defer, mobile layout and live file refresh\nScreenshots: ${shots}`);
  } finally {
    if (browser) await browser.close();
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

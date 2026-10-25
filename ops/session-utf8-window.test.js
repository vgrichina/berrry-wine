'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {scanGoal, createReader} = require('./readers');
const MB = 1024 * 1024;
const stamp = '2026-10-25T12:00:00Z';
const line = e => JSON.stringify(e) + '\n';
const padding = n => line({type:'image', data:'x'.repeat(n)});

test('all internal UTF-8 splits preserve attachment and command goals through cached snapshots', async t => {
  const dir = await fs.mkdtemp(path.join(process.env.TMPDIR, 'utf8-splits-'));
  t.after(() => fs.rm(dir, {recursive:true, force:true}));
  await fs.mkdir(path.join(dir, 'logs'));
  const file = path.join(dir, 'logs/worker.jsonl');
  const head = Buffer.from(line({type:'assistant', cwd:dir, sessionId:'worker', timestamp:stamp,
    message:{content:[{type:'text',text:'hello'}], usage:{input_tokens:10, cache_read_input_tokens:0, cache_creation_input_tokens:0, output_tokens:5}}}) + padding(300*1024));
  for (const char of ['é','漢','😀']) for (let split = 1; split < Buffer.byteLength(char); split++) {
    for (const command of [false,true]) {
      const expected = `goal ${char} complete`;
      const goal = Buffer.from(line(command
        ? {type:'user', timestamp:stamp, message:{content:`<local-command-stdout>Goal set: ${expected}</local-command-stdout>`}}
        : {type:'attachment', timestamp:stamp, attachment:{type:'goal_status', condition:expected, met:true}}));
      const cut = goal.indexOf(Buffer.from(char)) + split;
      const suffixLength = MB - (goal.length-cut);
      const suffix = Buffer.from(padding(suffixLength-27));
      const bytes = Buffer.concat([head,goal,suffix,Buffer.alloc(suffixLength-suffix.length,32)]);
      assert.equal(bytes.length-MB, head.length+cut);
      assert.equal(JSON.parse(goal.toString('utf8')).type, command ? 'user' : 'attachment');
      await fs.writeFile(file, bytes);
      assert.equal((await scanGoal(file, bytes.length, 0)).condition, expected);
      const reader = createReader({root:dir, claudeRoot:path.join(dir,'logs'), codexRoot:false, processes:false});
      const initial = (await reader.analyticsSnapshot()).agents;
      assert.equal(initial[0].goal.condition, expected);
      assert.equal(initial[0].inputTokens, 10);
      assert.equal(initial[0].outputTokens, 5);
      const open = fs.open.bind(fs);
      let opens = 0;
      const mock = t.mock.method(fs, 'open', async (...args) => { if (args[0]===file) opens++; return open(...args); });
      for (let repeat=0; repeat<3; repeat++) assert.deepEqual((await reader.analyticsSnapshot()).agents, initial);
      mock.mock.restore();
      assert.equal(opens, 0, 'unchanged cached repeats perform no history reads');
    }
  }
});

test('reverse goal scan skips oversized records and keeps byte reads bounded', async t => {
  const dir = await fs.mkdtemp(path.join(process.env.TMPDIR, 'utf8-oversized-'));
  t.after(() => fs.rm(dir, {recursive:true, force:true}));
  const file = path.join(dir,'history.jsonl');
  const bytes = Buffer.from(line({type:'attachment',timestamp:stamp,
    attachment:{type:'goal_status',condition:'earlier é漢😀',met:false}}) + padding(3*MB));
  await fs.writeFile(file,bytes);
  const open = fs.open.bind(fs);
  let total = 0;
  t.mock.method(fs,'open',async (...args) => {
    const handle = await open(...args), read = handle.read.bind(handle);
    handle.read = async (buffer, offset, length, position) => {
      assert.ok(length<=MB);
      assert.ok(position>=0 && position+length<=bytes.length);
      total += length;
      return read(buffer,offset,length,position);
    };
    return handle;
  });
  assert.equal((await scanGoal(file,bytes.length,0)).condition,'earlier é漢😀');
  assert.equal(total,bytes.length);
});

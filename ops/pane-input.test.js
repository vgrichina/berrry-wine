'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {inputState,suggestion}=require('./pane-input');
// Escape structure copied from live `tmux capture-pane -p -e -J` of Claude Code panes.
const rule='\x1b[38;5;244m'+'─'.repeat(40)+'\x1b[39m';
const footer='\x1b[39m  \x1b[38;5;211m⏵⏵ bypass permissions on\x1b[38;5;246m (shift+tab to cycle)\x1b[39m';
const claude=(input,above='')=>[above,rule,input,rule,footer].join('\n');
const idleSuggestion=claude('\x1b[39m❯ \x1b[2mcheck the trace output\x1b[0m        ',
  // The handled request also sits above in the transcript, plain, with the same glyph.
  '\x1b[39m❯ check the trace output\x1b[0m\n  ⎿  done');

test('a dim suggestion after an empty prompt is not a draft (OPS-DASHBOARD-DRAFT-REINJECT)',()=>{
  const s=inputState(idleSuggestion);
  assert.equal(s.draft,'');assert.equal(s.promptOpen,false);
  assert.equal(s.suggestion,'check the trace output');
  // The bare-text scan the orchestrator used reads it as typed input.
  const bare=idleSuggestion.replace(/\x1b\[[0-9;]*m/g,'').split('\n').filter(l=>/^❯/.test(l)).at(-1);
  assert.match(bare,/check the trace output/);
});
test('typed text is a draft, with or without a suggestion elsewhere',()=>{
  const s=inputState(claude('\x1b[39m❯ check back when the run finishes\x1b[0m'));
  assert.equal(s.draft,'check back when the run finishes');assert.equal(s.promptOpen,true);assert.equal(s.suggestion,'');
});
test('an empty prompt is empty and busy is read from the status line',()=>{
  const s=inputState(claude('\x1b[39m❯ \x1b[39m','\x1b[38;5;174m✻ Working… (esc to interrupt)\x1b[39m'));
  assert.equal(s.draft,'');assert.equal(s.busy,true);assert.equal(s.suggestion,'');
});
test('Codex placeholder is neither draft nor input',()=>{
  const s=inputState('\x1b[1m›\x1b[22m \x1b[2mAsk Codex to do anything\x1b[22m\n\n  gpt medium','codex');
  assert.equal(s.draft,'');assert.equal(s.promptOpen,false);
  assert.equal(inputState('› fix the build\n\n  gpt medium','codex').draft,'fix the build');
});
test('suggestion() reads only the last prompt line',()=>{
  assert.equal(suggestion('❯ old\n\x1b[39m❯ \x1b[2myes delete codex scratch\x1b[0m'),'yes delete codex scratch');
  assert.equal(suggestion('no prompt here'),'');
});

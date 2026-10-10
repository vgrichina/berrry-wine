'use strict';
// What each registered agent pane really holds in its input box.
//
// Claude Code prints a suggested next prompt -- often the user's own last line --
// in dim text after an empty `❯`. `tmux capture-pane -p` drops the styling, so a
// scan of the bare `❯` line reads that suggestion as an unsent draft, and
// "submitting" it re-sent requests the agent had already handled
// (OPS-DASHBOARD-DRAFT-REINJECT-20261010: 'check the trace output' six times in
// %13, 'check back when the run finishes' in %15). This reads `capture-pane -e`
// through work-guard's plainScreen, the same guard the dashboard nudges use,
// which drops dim runs on prompt lines; the suggestion is reported separately.
//
//   node ops/pane-input.js [--json] [--submit] [%pane ...]
//
// Default panes come from ops/terminals.json. --submit presses Enter (never
// retypes) on panes with a real draft and no approval prompt, then re-reads.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const {plainScreen,promptOpen,claudeDraft}=require('./work-guard');
const {parseApproval}=require('./approval-prompt');
const SGR=/\x1b\[[0-9;]*m/g;

// Dim text on the last prompt line: the suggestion, not input.
function suggestion(ansi){
  const lines=ansi.trimEnd().split('\n'),i=lines.findLastIndex(l=>/^\s*[›❯]/.test(l.replace(SGR,'')));
  if(i<0)return '';
  return [...lines[i].matchAll(/\x1b\[2m([\s\S]*?)(?=\x1b\[(?:0|22)?m|$)/g)].map(m=>m[1].replace(SGR,'')).join('').trim();
}
function codexDraft(screen){
  const lines=screen.trimEnd().split('\n'),i=lines.findLastIndex(l=>/^\s*›/.test(l));
  if(i<0)return null;
  return lines[i].replace(/^\s*›\s?/,'').replace(/^Ask Codex to do anything\s*$/,'').trim();
}
function inputState(ansi,provider='claude'){
  const screen=plainScreen(ansi);
  const draft=provider==='codex'?codexDraft(screen):claudeDraft(screen);
  return {busy:/esc to (?:interrupt|cancel)/i.test(screen.slice(-5000)),approval:!!parseApproval(screen),
    promptOpen:promptOpen(screen,provider),draft:draft??'',suggestion:suggestion(ansi)};
}

function main(argv){
  const json=argv.includes('--json'),submit=argv.includes('--submit');
  const panes=argv.filter(a=>/^%\d+$/.test(a));
  let targets;
  try{targets=JSON.parse(fs.readFileSync(path.join(__dirname,'terminals.json'),'utf8')).terminals||[];}catch{targets=[];}
  const rows=(panes.length?panes.map(pane=>targets.find(t=>t.pane===pane)||{pane}):targets).map(t=>({id:t.id,pane:t.pane,
    provider:/^codex:/.test(t.agentId||'')?'codex':'claude'}));
  const capture=pane=>execFileSync('tmux',['capture-pane','-p','-e','-J','-t',pane],{encoding:'utf8',timeout:2000});
  for(const row of rows){
    try{
      Object.assign(row,inputState(capture(row.pane),row.provider));
      if(submit&&row.draft&&!row.approval){
        execFileSync('tmux',['send-keys','-t',row.pane,'Enter'],{timeout:2000});
        execFileSync('sleep',['0.5']);
        row.submitted=!inputState(capture(row.pane),row.provider).draft;
      }
    }catch(error){row.error=String(error.message||error).split('\n')[0];}
  }
  if(json)console.log(JSON.stringify(rows,null,1));
  else for(const r of rows)console.log(`${r.pane} ${r.id||''} ${r.error?'error='+r.error:
    `busy=${+r.busy} approval=${+r.approval} draft=${JSON.stringify(r.draft)}${r.suggestion?` suggestion=${JSON.stringify(r.suggestion)}`:''}${'submitted' in r?` submitted=${+r.submitted}`:''}`}`);
}
if(require.main===module)main(process.argv.slice(2));
module.exports={inputState,suggestion};

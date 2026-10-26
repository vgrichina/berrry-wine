#!/bin/bash
# Bash owns the concurrent interval; Python verifies only after all Node clients
# have exited. This avoids charging an unnecessary Python harness beside 2 V8s.
set -eu
cd "$(dirname "$0")/.."
node=/home/user/.nvm/versions/node/v24.18.1/bin/node
flags=(--jitless --single-threaded --max-old-space-size=64)
for pair in launcher:launcher launcher:standalone standalone:launcher standalone:standalone; do
 dir=$(python3 - "$pair" <<'PY'
import pathlib,tempfile,json,time,sys
r=pathlib.Path.cwd();d=pathlib.Path(tempfile.mkdtemp(prefix='shell-process-',dir=r/'test-output'))
for session in ['A','B','C','cli']:
 c=dict(outputDir=str(d),referenceDir=str(d),sessionId='owner'+session,plan=dict(allocationId='offline-process-race',totalCaptures=22,perImageBytes=128,retainedBytes=2816,totalCaptureBytes=2816,width=2,height=2,setupMs=2000,acceptanceMs=2000,cleanupMs=2000,totalMs=6000,cutoff=int(time.time()*1000)+7000,ackTimeoutMs=100));(d/('cfg'+session+'.json')).write_text(json.dumps(c))
(d/'pair').write_text(sys.argv[1]);print(d)
PY
)
 # A read/write FIFO permits a timed builtin wait without a third process.
 mkfifo "$dir/timer"; exec 9<>"$dir/timer"
 "$node" "${flags[@]}" test/fixtures/civ2-controller/owner-process.js "$dir/cfgA.json" "${pair%:*}" "$dir/readyA" "$dir/go" "$dir/release" >"$dir/A.json" 2>"$dir/A.err" & a=$!
 "$node" "${flags[@]}" test/fixtures/civ2-controller/owner-process.js "$dir/cfgB.json" "${pair#*:}" "$dir/readyB" "$dir/go" "$dir/release" >"$dir/B.json" 2>"$dir/B.err" & b=$!
 trap 'kill -KILL "$a" "$b" 2>/dev/null || true; wait 2>/dev/null || true' EXIT
 deadline=$((SECONDS+3))
 while [[ ! -f "$dir/readyA" || ! -f "$dir/readyB" ]]; do
  [[ $SECONDS -lt $deadline ]] || exit 11
  read -r -t .005 -u 9 unused || true
 done
 : >"$dir/go"
 while [[ ! -s "$dir/A.json" || ! -s "$dir/B.json" ]]; do
  [[ $SECONDS -lt $deadline ]] || exit 12
  read -r -t .005 -u 9 unused || true
 done
 ar=$(<"$dir/A.json");br=$(<"$dir/B.json")
 if [[ $ar == *'"started":true'* ]]; then kill -KILL "$a"; else kill -KILL "$b"; fi
 wait "$a" 2>/dev/null || true; wait "$b" 2>/dev/null || true; trap - EXIT
 ownerBefore=$(<"$dir/controller-owner.json"); ledgerBefore=$(<"$dir/capture-plan.json")
 "$node" "${flags[@]}" test/fixtures/civ2-controller/owner-process.js "$dir/cfgC.json" launcher "$dir/readyC" "$dir/go" "$dir/release" >"$dir/C.json" 2>"$dir/C.err"
 cliExit=0
 "$node" "${flags[@]}" tools/civ2-serial-controller.js "$dir/cfgcli.json" >"$dir/cli.out" 2>"$dir/cli.err" || cliExit=$?
 [[ $cliExit == 1 && ! -e "$dir/control-in.jsonl" ]]
 [[ $(<"$dir/controller-owner.json") == "$ownerBefore" && $(<"$dir/capture-plan.json") == "$ledgerBefore" ]]
 exec 9>&-
 python3 - "$dir" <<'PY'
import pathlib,sys,json,hashlib
r=pathlib.Path.cwd();d=pathlib.Path(sys.argv[1]);modes=(d/'pair').read_text().split(':');replies=[json.loads((d/(n+'.json')).read_text()) for n in ['A','B']];retry=json.loads((d/'C.json').read_text());assert sum(v['started'] for v in replies)==1,replies
winner=next(i for i,v in enumerate(replies) if v['started']);assert sum(v['launches'] for v in replies)==int(modes[winner]=='launcher');assert not retry['started'] and retry['launches']==0;assert 'no allowance reset' in (d/'cli.err').read_text()
p=r/'docs/reviews/civ2-atomic-controller-ownership-repair-oct26/process-shell-checkpoint.json';v=json.loads(p.read_text()) if p.exists() else {'completed':[]};v['completed'].append(dict(pair=modes,replies=replies,retry=retry,cliExit=1,markerAndLedgerUnchanged=True,noControl=True));v['hashes']={n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['tools/civ2-serial-controller.js','tools/civ2-capture-plan.js','test/fixtures/civ2-controller/owner-process.js','test/test-civ2-controller-process-ownership.sh']};v['flags']=['--jitless','--single-threaded','--max-old-space-size=64'];v['remaining']='review/publication then fresh independent acceptance; real production UI/normal quit pending';t=p.with_suffix('.tmp');t.write_text(json.dumps(v,indent=2));t.replace(p);print('PASS shell-supervised concurrent '+'/'.join(modes)+' + killed winner/reentry/actual CLI')
PY
done

#!/usr/bin/env python3
import os,pathlib,subprocess,sys,json
if len(sys.argv)!=3:raise SystemExit("usage: start-worker.py TASK_FILE OUTPUT_DIRECTORY")
task=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve()
if out.exists():raise SystemExit("Output directory already exists; choose a new task directory")
out.mkdir(parents=True)
text=task.read_text()+"\nYou are a single-task worker, not the coordinator. Do not spawn agents or launch other Codex workers. Finish this task or report a concrete blocker, preserve evidence, then stop. Context compaction at200k is not a task stop. Runtime lifecycle: the coordinator owns shutdown. Leave assigned test boxes RUNNING on completion, recoverable failure or handoff unless the original task explicitly delegates shutdown or an emergency requires stopping. Report box ID/state/expiry and hand back ownership. Do not stop, delete or resume boxes by default."
cmd=["/opt/ascii-agent/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex","exec","--profile","wine-worker","-c","model_auto_compact_token_limit=200000","-c",'model_auto_compact_token_limit_scope="total"',"-m","gpt-6.1-sol","-c",'model_reasoning_effort="medium"',"--json","--output-last-message",str(out/"final.txt"),"-"]
with (out/"events.jsonl").open("w") as events,(out/"stderr.log").open("w") as errors:
 r=subprocess.run(cmd,input=text,text=True,stdout=events,stderr=errors,cwd="/home/user/wine-assembly")
(out/"result.json").write_text(json.dumps({"exitCode":r.returncode,"taskFile":str(task),"profile":"wine-worker","autoCompact":200000})+"\n")
# Stable completion identity lets the coordinator reject late queued notices
# without reopening artifacts. Suppress completions already reviewed before enqueue.
thread_id = None
for line in (out/"events.jsonl").open():
 try:
  event = json.loads(line)
 except ValueError:
  continue
 if event.get("type") == "thread.started":
  thread_id = event.get("thread_id")
  break
event_id = "worker-completion:" + (thread_id or out.name)
processed = {}
try:
 processed = json.loads((out.parent/"completion-dedup.json").read_text()).get("processed", {})
except (OSError, ValueError, AttributeError):
 pass # Missing/malformed ledger must not silently discard a completion.
already_reviewed = any(isinstance(entry, dict) and
 (entry.get("eventId") == event_id or (thread_id and entry.get("workerId") == thread_id))
 for entry in processed.values()) if isinstance(processed, dict) else False
if already_reviewed:
 notification = {"eventId":event_id,"suppressed":True,"reason":"already-reviewed"}
else:
 notice="[Completion ID: "+event_id+"] Worker completed its single assigned task. Review "+str(out/"result.json")+" and "+str(out/"final.txt")+". Decide the next bounded assignment using a fresh worker; do not reuse this worker. If this exact completion ID was already processed, do not reread artifacts, dispatch, or send another status acknowledgment."
 q=subprocess.run([cmd[0],"queue","--thread","01a0ff91-cf9d-7f42-ba93-f9e7616b35a5","--message",notice],text=True,capture_output=True,timeout=30)
 notification={"eventId":event_id,"exitCode":q.returncode,"stderr":q.stderr[-1000:]}
(out/"notification.json").write_text(json.dumps(notification)+"\n")
raise SystemExit(r.returncode)

# Q3 debugger source inventory, 2026-11-15

The source-inventory correction is implemented and the actual Chrome control
passes. Current native qualification, publication and the conditional one fresh
original remain pending at this stage. Heavy work followed TIM smart handles
and LS32 implementation releases; expected predecessor waiting was completed.

Evidence: `scratch/runs/20261115-quake3-source-inventory/`.

## Demonstrated repeated source and causal limits

The previous original's actual `original/operations.jsonl` contains 412 distinct
script IDs whose source responses have the exact 47-byte controller snapshot
expression SHA-256
`000ba5e8856b8d2a95512815f84b8ee419cdcb73dbe015ee87dc832cc883f31c`.
All belong to the same render Worker session and target, with 413 matching
controller evaluator requests. There are 411 preterminal source responses and
one passive late source response, for script 423/request 1307 at 3906.575 ms.
That source request triggered the fixed three-second UNKNOWN. The pending
snapshot evaluation 1309 arrived at 6334.850 ms. No postterminal request occurred.
The previous route is closed. Queue, inspector dispatch, native occupancy and
source-body timing remain UNKNOWN; there is no evidence of an engine bug.

Historical logging retained context IDs and script IDs but omitted the actual
`scriptParsed.hash`. We cannot retroactively claim those events qualify for
reuse. Actual source-byte repetition is demonstrated independently of that gap.
Removing repeated source requests cannot guarantee that the still-required
snapshot evaluations finish within their unchanged three-second deadline.

## Identity and necessity

The primary [CDP Debugger schema](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/js_protocol.json)
defines `scriptParsed.hash` as a SHA-256 content hash and specifies separate
source and WASM bytecode return fields for `getScriptSource`. The same schema
describes numeric context ID reuse across processes and the stronger unique
context ID. Debugger enable also reports existing uncollected scripts, so an
anonymous event alone does not establish evaluator provenance.

V8's primary [inspector implementation](https://github.com/v8/v8/blob/15.1.206.16/src/inspector/v8-debugger-script.cc)
uses `GetSha256Hash` when available and has a UTF-16 fallback. Its primary
[script hash implementation](https://github.com/v8/v8/blob/15.1.206.16/src/objects/script.cc)
hashes UTF-8 text. Fresh Chrome actually reports the UTF-8 hash for the exact
47-byte snapshot expression and the Unicode control. The helper validates the
public hash against actual fetched source using UTF-8 or the UTF-16LE fallback,
records the validated convention separately, and always retains the actual UTF-8
source-byte hash. Unrecognized conventions fall back to fetching. The initial
UTF-16-only candidate safely fetched every script and failed its reuse control;
that rejected qualification is retained. No original ran on it.

Only known controller expressions sent by the current connection can enter the
reuse cache, after a first actual fetch exactly matches the expression and
validates its metadata hash. Reuse preserves each new script ID, numeric and
unique context IDs, session and target, and identifies the first fetched script.
This establishes source equivalence, not a newly fetched bytecode proof or a
claim that every anonymous script originated with the controller.

Production URLs, modules, live edits, WASM, unknown languages, distinct or
unknown anonymous source, malformed/missing hash and missing unique contexts
still fetch. No source is inferred from URL or length alone. Session/target or
context replacement invalidates reuse; failed, stale and postterminal replies
cannot seed the cache. Cache and known-expression memory are each limited to
64 entries/256 KiB with a 60-second lifetime, connection-local only, with limits shared across Worker sessions.

## Current validation

Fifteen independent fake-protocol tests pass, including 412 repeated exact snapshot
expressions with one fetch, equal-length distinct anonymous sources, actual
module-byte hash controls, malformed metadata, context/target/session replacement,
bounded lifetime/capacity, fetch failure and sticky terminal/late replies.
The final actual Chrome control passes all 16 tests. On one Worker/context,
six unchanged snapshot evaluations caused six requests under the old per-event
policy and one under the candidate; each new script ID retains attribution.
Unknown nested anonymous scripts still fetch, two equal-size distinct WASM
modules retain actual byte hashes, and Worker replacement/two real isolated
contexts fetch independently. Actual waits/EOF and zero postterminal requests
are verified. An initial successful control and rejected fixture iterations
remain explicit; a delayed Worker bootstrap exposed and corrected a baseline
fixture assumption rather than being labeled a controller script.

Current native queued input, immutable capture, visibility, independent release,
final full build, publication and the conditional one fresh original remain
pending. No boxes, workers or deployment were created.

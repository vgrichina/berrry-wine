# Aranna atomic observation, 2026-11-07

The incomplete-publication failure is reproduced with captured failed-read bytes
and corrected in the run harness. The transport helper and focused regression
are published on main as `344c54a2cebb0af51858c80b78c18e665dc52080`.
Fresh composed pointer qualification stopped at a generated-control targeting
blocker, so **no fresh original was launched and world movement remains
unverified**. Evidence is in
`scratch/runs/20261107-aranna-atomic-observation/`.

## Demonstrated transport cause and its limits

`reproduce-publication.cjs` executes the retained queue reader and a separate
Node publisher using the old `writeFileSync(finalPath, Buffer, {flag:'wx'})`
protocol. The test pauses the publisher immediately after exclusive open, before
its first payload write. The reader sees the final pathname, reads **zero bytes**,
and throws `SyntaxError: Unexpected end of JSON input` before validation,
admission, adapter preparation or receipt. The actual returned bytes are captured
at the reader call, with length, base64 and SHA-256 in
`reproduction/failed-read.json` and `publication-reproduction.json`. The empty
read SHA is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
After releasing the publisher, the final command is complete valid JSON. The
failed iterator is never retried.

This proves that making the final name visible before completing its contents
can produce the observed exception. It does **not** recover the failed-read
bytes of the predecessor's original command9. That historical cause remains an
inference. Command9 remains terminal UNKNOWN, with no reinterpretation, replay,
resumption, or zero-effect claim.

`tools/atomic-command-publication.js` writes and fsyncs an exclusively created
temporary sibling, closes it, then publishes an exclusive hard link to the final
name and removes the temporary name. Incomplete temporary contents are never
visible at the polled command name. Competing writers cannot overwrite a final
record: losers receive EEXIST. This is a same-filesystem immutable-publication
protocol; no power-loss durability of the containing directory is claimed.

The new run-local queue writer uses this helper for reviews and commands. The
reader uses it for ready/admitted/done records, and its command read captures
the exact failed bytes if parsing fails. A malformed final record still throws
immediately, without admission, retry, repair, or replay. The supervisor's
deadline Quit publication also uses the exclusive helper. The retained queue
validator, production input adapter, owner/module/review/geometry/protocol/point
guards, quotas, UNKNOWN closure and stale-refusal conditions are unchanged.
No emulator or game source behavior was changed.

## Verification

`node --test tools/atomic-command-publication.test.js` passed all four tests:
paused old publication reproduces the empty read; paused atomic publication
keeps the final name absent; eight simultaneous publishers yield exactly one
complete immutable observation; malformed final records preserve exact bytes
and refuse replacement. The 256 KiB concurrent records exercise substantial
payloads rather than only tiny synchronous writes.

`transport-regression-v2.json` records six checks against the actual retained
legacy reader and the exact transformed new reader loaded by this run's driver:
empty and prefix records fail before validation/admission/preparation; complete
wait/screenshot observation and Quit produce valid receipts; UNKNOWN prevents
the next admission. The earlier six-case regression is also retained, with its
narrower test scope. Mapping controls passed six valid/five invalid cases;
selector controls passed nine zero-effect refusals; 32 route-contract boundaries
preserved UNKNOWN/partial closure and the stale zero-effect recovery rule.

`flock /tmp/wine-build.lock bash tools/build.sh` passed before the explicit-path
code commit. The commit was immediately pulled/pushed with strict SSH settings.
The generated baseline modules still match the shipped standard and
compatibility modules. Actual Worker passivity controls passed all twelve
baseline/disabled/armed cells across both modules and ordinary/Worker routes.
Both-module ordered broker controls passed signed seek, short read, EOF/error,
immutable identity and actual production Worker checks.

Preparation mistakes remain recorded: the first passivity invocation reached
the identity check before compatibility observer preparation finished and
failed before its browser execution; the later completed-module invocation
passed. Initial broker preparation used an unsupported output CLI argument and
did not emit the requested module; its browser then rejected HTTP "not found"
bytes before guest execution. Preparation with the documented absolute
`WINE_RENDER_ARTIFACT_PREPARE` path and the subsequent broker control passed.
These failed preparations are not original attempts.

## First composed qualification blocker

Lords2 explicitly released runtime/source/build at 03:08:41Z. The independent
handoff check at 03:09:45Z verified five PIDs absent, two ports refused, one
profile absent, no matching descendants and all four locks free before taking
the lane and claiming the two new implementation files.

The standard generated full-shell control acquired actual screen lock and
armed the unchanged owning observer. The actual owner was slot0, endpoint1,
target `61A6F0149F021B27F554F7728997A390`, session
`8B9149B76CE65BCC11256B994548BFAE`, observer SHA
`e7d6617cecdf3275db05454763c07cad7e6eb557afc2a14ca3413d960328fd31`.
The requested relative movement at command2 was `(2,-145)` from the measured
native `(397,300)` toward the reviewed Single Player target. Owning manager
stores first reached `(399,155)` at serials968/971, then applied the same
displacement again to `(401,10)` at serials980/983. Its completed receipt is
timestamped **03:14:22.442Z**. A subsequent generated diagnostic correction
`(-1,72)` accumulated once, reaching `(400,82)` at serials988/991, with completed
receipt at 03:15:25.692Z. There was no target activation. The source of the
variable repeated delivery is not established here; no emulator defect is
inferred. `qualification-blocker.json` retains the stores, owner, receipts,
native readouts, image dimensions and hashes.

This fresh control did not qualify the composed route. Compatibility full-shell
qualification, expiry/stale refusal, stable unlock, neutral click, typing and
reacquisition were consequently not completed in this run. The predecessor's
successful controls and proven explanation of the old `(392,599)` mismatch
remain valid evidence for that predecessor. Its guest accumulation and repeated
DOWN/UP displacement correction was retained without weakening any guard.

All five generated commands, including normal Quit, have complete receipts;
there are zero UNKNOWN/partial commands in this control. No original EULA,
Choose Hero, name entry, Normal, map, world, or movement was attempted here.
The coordinator was notified on the messageboard at 03:15:55Z. No further
guest-input operation followed the diagnostic correction except normal Quit.

## Visual review and identities

Screenshots were inspected at their original 1001x800 resolution. Startup and
response02 show the generated Single Player rectangle. Responses00,01 and03
have black guest GDI areas; no disappeared-control inference is made. Responses
00 and01 are byte-identical, SHA
`9b8707e2974692c3d2f4e278038bfc04481825c89d6c64a2e7ecc1fe4028202f`.
An inaccurate response00 review was written alongside the image tool call
before its pixels were assessed. The original note is retained, with explicit
`response-00.review-correction.json`; its claim that the rectangle remained
visible is withdrawn. Later observations do not inherit that visual claim.

The standard baseline is 2,181,179 bytes, SHA
`07f1cc970038f8ab31313b8b200edf26caa63473f293f5fc937f5cfe5c5c7f6e`.
Compatibility baseline/observer SHAs are respectively
`1d4bd4330ea16947959e3f4472339d5a32a61216cd8b5246198d11046b652c3e`
and `6b5edb202b5e03d84056b8663869f8485de2b5a7d592ece0e350dc43a88a005d`.
Actual Worker instantiated modules, HTTP identities and passivity results are
retained. Runtime source pin v2 and post-runtime checks record unchanged
production/runtime inputs, with only the offline regression subsequently
expanded. Final pin v3 includes those additions. Exact Git commits, tracked
binary diffs and relevant untracked/new-file patches provide source recovery;
there is no source-tree or media archive.

All 28 existing game media paths passed length/SHA-256 checks against the
predecessor's retained identities. Guest media/configuration/save bytes were
not edited. Media was referenced at existing paths without copying.

## Cleanup and next step

Normal generated Quit completed at 03:15:55.657Z; driver and Chrome exited zero.
The lock holder exited normally after its release marker. At 03:18:15Z,
`final-cleanup.json` independently verified all 29 recorded PIDs absent, six
ports refusing, three profiles absent and four locks free, with 3,066,933,248
available bytes. These counts cover retained lifecycle records; the early failed
broker preparation's lifecycle filename was reused by its later control, so
these are not claimed as an independent census of that earlier browser.
Its failing supervisor exited one and its finally block closed the browser.
Runtime/source/build and implementation-file ownership were explicitly released
at 03:18:22Z. No boxes were assigned or created: ID/state/expiry and box shutdown
handoff are not applicable. No automated cybersecurity risk flag was observed.

The next task is to establish the generated relative-delivery discrepancy and
complete both-module composed pointer qualification before any separately
authorized fresh original. World movement remains unverified. Findings are
published with this note; `result.json` is published last, then this worker stops.
Own pending-result schema, artifact containment and existence checks passed.
The repository-wide evidence checker still exits one for the unrelated retained
Alice run's outside-directory reference; its report is preserved without
changing that agent's files.

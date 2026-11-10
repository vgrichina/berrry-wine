# Q3 retained producer diagnostic

Evidence: `scratch/runs/20261110-q3-retained-producer-native-0328/`.
One fresh original execution used published `ee23983ef` retention, prepared
with `Q3_STARTUP_CONSOLE=1`. Runtime source commit was
`91a46f2f315500cde03a08ef9250ec15ef0b2ac2`. The 950-provider seal is
`9f035a2ed1c7cb2bf5c725f3f6421c78cf0da8308b3666fcafae57d358484ce4`.
Canonical CPU SHA remains
`4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`;
installed observation module SHA is
`17d60ba77bbd975d3295436053b41cb6c547c40a534a521c07f9d95b0af0eefb`.
The accepted unchanged cancellation fixture was hash-verified and reused;
there was no native fixture repeat or second original run.

All **29 complete producer replies** reject the same unchanged production
selector condition:

```js
if (!(v.completed > 0 && v.presented > 0 && v.writeSeq > 0)) return null;
```

There is exactly one matching, nonfailed WebGL endpoint: endpoint 1, owner 0,
context handle 1, HWND 65543, `software=false`, `webgl=true`. Completed batches
advance from 2 to 139, but every reply has `presented=0`, `writeSeq=0`,
`draws=0`, and `vertices=0`. Thus `presented>0` and `writeSeq>0` are the exact
rejected fields at the first failed gate. The later WebGL draw/vertex gate
would also fail. Owner, backend and endpoint matching are satisfied. Setup
and completed batches do not establish presentation or arena readiness.

`diagnose.cjs` executes the actual production `producer.select` against each
retained value. It verifies the exact READ expression hash, request ID,
request/response session, pending status, successful request settlement and
renderer target. It binds the following PAGE_READ to its actual traced query
and startup observation, then applies that page's slot and render endpoint.
These are actual retained values, without reconstructed missing replies.
Requests span 119 through 323; renderer session is
`E3D1E6A632F9E5FDFE8554BE34FC5B01`, target
`DD21A7A741A332D8D116BB8D941693F9`. The page session is
`9FCC5D17E646871708FB7D4ECCD39DE4`; its exact target and full stable owner
fields are retained in `diagnosis.json.gz`. No reply is truncated, has a
protocol/JavaScript exception, or reaches the 64-reply cap.

The 64 retained console calls join the original guest session
`A9114C0AB0AF873F4D75DC3F6A7E6622`, target
`939EFB0BC34CEF9DE203436F7164B949`, execution context 1, and the admitted
original Worker. Every call enters `0x443840` with caller return `0x43feaa`;
all strings terminate within the bound. Text progresses from the original
Q3 version and filesystem initialization through window/context creation,
successful `wglMakeCurrent`, and entry 64, `...using GL_ARB_multitexture`.
The earlier DirectInput cooperative-level refusal explicitly falls back to
Win32 mouse support. It does not establish a fatal startup error.

**The console cap is exhausted. All later guest console text/callers remain
UNKNOWN.** No conclusion about a later guest error follows from their absence.
Passive page observations retain 191 nonnull slices, advancing to sequence
4014 at EIP `0x456a9a`, without a recorded trap. Partial GL observations retain
378 distinct surviving boundary records and completed batch 139. Their ring
overwrites remain explicit; missing draw/presentation boundary markers cannot
independently prove a guest root cause. No runtime CPU/renderer repair is
supported by these observations.

The first startup image did not arrive within the unchanged **50-second**
observer bound. Its exception immediately published owning cancellation at
03:30:53.743991Z; the supervisor received TERM at 03:30:53.763685Z. Kernel
custody reports 172/172 reaped, no unreaped children, and command-log EOF.
The generated parent, prelaunch child, runtime parent, local controller and
watchdog each have actual waits plus separate stdout/stderr EOF receipts.
No game input or screenshot request occurred; no image existed to review.
Arena progress is unverified.

The offline join also found a cleanup admission defect: the generic planned
cancellation exception allowed `Browser.close` to allocate traced request 325
at 03:30:53.753Z after revocation. The unconditional native transport guard
refuses transmission once the cancellation marker exists, but an attempted
later request still entered the trace. The Q3-only repair restricts that
planned graceful-close exception to runs without `Q3_NATIVE_PHASE`. A native
owner's cancellation now rejects cleanup before request allocation/trace.
Ordinary successful close and the existing nonnative cancellation control
retain their behavior. This repair has offline validation only; the original
run above used the pre-repair seal. No native retry was made.

Validation includes the emitted original Worker, real original host init,
two compiled modules and actual installed-instance controls; console caller,
text, register preservation and cap shutdown; four distinct pending producer
conditions plus advancing success; full sealed caller delayed/error/missing
reply controls; Q3 input-observer controls; and the actual generated terminal
caller under the ptrace supervisor. The new native-cancellation control checks
both zero transmitted close and zero `cdp.request` close trace entries.
Focused tests and the locked build pass before publication. The production
selector, startup bound, shared CRT, renderer and startup providers are unchanged.

The prearmed independent immutable watchdog deadline was
2026-11-10T03:53:35.099291Z. Sole task box `bx_2qbqdc6h`, UUID
`3d431674-fbcf-4170-b06b-15ff88d83eb9`, initially expired at
2026-11-10T03:53:34.480Z. Before stop, independent inventories and rereads
verified all 53 unique artifacts (2,079,644 bytes) by SHA and size. Every
nonempty gzip finalized successfully. The zero-byte `execution-boundary.jsonl.gz`
is preserved as an invalid empty container, not claimed as finalized evidence;
the separate 677,874-byte `execution-boundary-transport.jsonl.gz` contains the
complete retained producer and console lanes. There were zero PNGs; full PNG
verification was therefore vacuous. No missing artifact was promoted to success.

Delegated unforced stop `stop_3bfd33cc00fe9668` completed at
2026-11-10T03:31:23.536Z, after evidence verification. Final box state is
**archived**, expiry **null**, stop error **null**. Watchdog actual wait is 0,
with separate EOFs. Other boxes were untouched. Git SHA and relevant binary
diff/new-input patches are the source recovery record; no source archive,
media evidence copy, guest write, artificial guest call, local Chrome, nested
worker, tier/clock change or deadline extension was used.

Next work is offline diagnosis of the original initialization path before a
separately authorized native run. Keep the selector and runtime bounds intact;
the exact readiness refusal is diagnosed, but later console failure and arena
progress remain UNKNOWN. This single-task worker releases its files and stops
after publication.

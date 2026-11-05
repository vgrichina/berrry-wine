# MDK2 pending Medium Enter: finite audio refill and observation cost

The accepted-runtime history stops during buffered audio decoding, before a
witnessed Medium press. There is measurable additional observer work, but no
proved emulator/driver scheduling defect or safe causal remedy for this exact
history. Production files are unchanged. This finding does not authorize a retry.

Inputs are published `337356d17278bf2a5df8726437d2dabea3933e4d` plus
`a7d8905b1e5495a17354da7f94736bddf6e5d781`, with captures in
`scratch/runs/20261104-mdk2-accepted-runtime-binding/`.
Evidence for this investigation is
`scratch/runs/20261105-mdk2-pending-enter-decoder-cause/` (RUN).
The [earlier decoder-return](mdk2-decoder-return-original-20261104.md),
[GC/callback](mdk2-callback-active-context-20261104.md),
[keyup/feedback](mdk2-native-keyup-cause-20261104.md), and
[timer/deferred-load](mdk2-timer-deferred-load-observer-20261104.md) findings
remain distinct histories and static contracts; they are not backfilled into
this run.

The offline audit verifies the original EXE SHA
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`,
ten instruction contracts, all 28 trace-end append prefixes and matching
main/file sidecars. The final history has 465000 boundaries, 29 samples,
three output contexts and two decoder returns. At every post-step sidecar,
main is thread1 under saved returns `47ca7e`, `47a928`, `47b393`; file thread2
is independently at the idle-file-poll boundary. The completed `pointer`
resource remains unchanged. The trace is continuous, but its selected records
and sparse PCs are not an exhaustive record of every executed instruction.

| Direct evidence | Meaning |
| --- | --- |
| Output routine `47d980`, call `47ca79`, checked return `47ca7e` at boundaries179389 and335388; EAX32768, ESP=frame+28 | Two finite 32768-byte requests returned. |
| Object remainingWords11410842 then11394458; decodedWords0 at both returns | 16384 words were consumed between these returns. Zero buffered decoded words is not stream EOF. |
| Final PC`47deb8`, decoder frame ESP`074ffcd8`, object`0847a800`; stack produced24576/requested32768 | The third observed request still has8192 output bytes unproduced. This is progress through transform/output work, not a wait on queued Enter. |
| Outer `47b390: call [ebx+8]`, then `47b549..47b552` decrements `[esp+24h]` and loops to`47b331` while nonzero | A decoder request return is inside an audio refill loop, not necessarily a main-loop return or input poll. |
| Main `402171` calls maintenance`451540`; after return, `40217c` compares the periodic counter with5 and conditionally calls GC`443070` at`402187` | Periodic GC can be another later dependency. There is no GC entry/exit record in this accepted window. The earlier run's GC endpoint is not this run's cause. |

The original call-chain interpretation remains
`402171 → 451540 → 47c600/47c610 → 47bf90 → 47b1a0 → stream callback → 47a880 → 47ca50 → 47d980`.
The three inner saved returns are directly present in this history. The deeper
main-loop chain comes from original bytes and the earlier bounded stack, not a
new capture of the stream's callback pointer. DirectSound Lock/Unlock-shaped
vtable calls surround the refill, at`47b2a1`/`47b572`; its stream object and
remaining loop count were not captured here. No full-stream decoding prerequisite
for future input is established.

At4096, the sidecar covers `[074ffc78,074ffd38)`. Reconstructing the original
stack adjustments puts the outer loop counter at`074ffd64`, **44 bytes beyond
the captured end**. Consequently neither the entire stream's remainingWords
nor the third request's8192 bytes gives the number of remaining refill iterations.
The exact immediate control dependency is the requested-byte comparison at
`47d9e4/47d9e8`, followed by the caller and outer loop counter at`47b549`.
The missing counter cannot be recovered by interpreting uncaptured bytes as zero.

Enter has three separate states. The frozen renderer retains WM_KEYDOWN13
and WM_CHAR13; the keydown carries `asyncPressPublished:true`. The original
`renderer-input.js` publishes asynchronous press state when enqueueing normal
keydown, and `host.js` can publish the live key bitmap to the Worker without
dequeueing these messages. Thus queue presence does not imply async state was
unpublished, and the stamp does not prove a current key-bitmap read or native
poll. `host.check_input → renderer.takeInput` performs message delivery;
the game's `46cee0 → 46cf30 → 454cd0` command sweep is another operation.
At the final capture, lastInput and activeInput are null, command62 has
raw0/previous0/active0, current=`diff`, scheme=`menu`, showmenu1. No consumed
Medium press, keyup, callback, full-rest-after-release, timer or new-level
witness follows from an ACK or that enqueue stamp. A native async poll could
also occur without draining the message queue; neither is invented here.

The aggregate menu allowance is already512:16 observation +48 New Game +448
Medium steps. The extra32 (maximum544) is conditional on the existing released
Medium path and cannot fund this pending press. Every post-step trace-end
reports the actual received budget1000 and ranBlocks1000. The first16-step
interval accounts for33000 boundaries; the following27 each account for16000.
There is no evidence that review/checkpoint commands secretly advanced frozen
steps. There is evidence that the selected native work per step is small.

The current observer rechecks35 instruction pins totalling502 bytes **at every
native boundary**, including bytewise `guest_to_wasm` calls and hex-string
conversion. RUN/audit.cjs calls the unmodified observer for1000 boundaries
against an explicit getter-only memory fixture and counts534 translations per
boundary. The exact predecessor observer from`12a87f179` (SHA`32a03239…`)
checks9 pins/122 bytes and makes154 translations in the same fixture. The
published timer observer`399d2128d` (SHA`dd37b5ba…`) adds380 such translations
per boundary:176700000 additional translations over465000 boundaries, for
this matched fixture path. Actual resource/special-boundary reads can add work;
this is an operation count, not a timing measurement or whole-history replay.

This observation work runs inside the Worker's timed slice. The exact accepted
host feedback statements use
`round((ranBlocks*12/ranMs)/1000)*1000`, clamped to1000..configuredSteps,
after sufficiently spent non-input-burst slices. An isolated fixture executes
those original statements:1000 blocks at1/6/12/100ms select12000/2000/1000/1000;
input-burst and trapped-slice negatives leave the prior budget unchanged.
The earlier native discriminator already proved the observation/quiet-trace
cost difference; its long decoder is deliberately not rerun. The accepted bridge
already suppresses quiet block-log RPCs. Reapplying that old bridge fix cannot
remove the present pin-check work.

The added work is therefore a concrete way observation consumes wall time and
can reduce native progress within the fixed step allowance. Whether every check
is necessary at every boundary is a separate equivalence question: simply
memoizing pins, checking only at samples, subtracting observer time from feedback,
disabling tracing, or changing budgets would alter existing byte-mutation,
deadline, ownership or scheduling behavior. No independently proved correction
with the required negatives and complete parity is available from this evidence.
The captured nativeSlice records lack per-slice ranMs and the host adaptive/burst
state, so they cannot assign the observed1000 solely to observer cost or prove
an optimization would reach consumption within512. No production edit is made.

The remaining discriminating evidence is specific: the live outer stream's
callback/object fields and counter`[outer ESP+24h]`, its buffer/cursor/lock state,
and the decoder's remaining callback/input state; then same-history maintenance
return, any periodic GC return, native command update and queue/async-key state.
For a scheduling correction, independent short fixtures must establish unchanged
wrong-owner/stale/byte-change/bounds/failure/queued-input rejection and both-module
full-memory/GPR/command parity, alongside separated observation timing. Neither
the missing stream state nor the input boundary can be reconstructed from the
16-byte decoder windows. This is the concrete blocker to a causal remedy, not a
request for more resources or authorization for new original execution.

Validation: four existing focused native tests pass. Both accepted module/source
pairs execute the original small native fragments against controls with complete
memory hashes, registers, commands and trap parity. Separately, both retained
module variants pass the four-word decoder output/replay, register/lazy-flag and
output parity, quiet/forward controls and import-failure parity; these are explicit
fixture data, not this stream. The ten-contract/prefix/suffix/work-count/feedback
audit passes. Its initial epilogue-address transcription failure is retained in
`audit-initial.log`; corrected`47d9ee` is byte-verified. No full build is claimed
for this documentation-only change, and no module was mutated or restored.
The accepted native tests read and assert the pinned module hashes before
execution. A later audit of the shared build paths sees the legacy worker's
new`63a43aa7…`/`09a64727…` modules; those are recorded as later path observations,
not substituted for the tested accepted pair. The retained decoder fixtures use
their existing historical paths. No shared module is copied or rolled back.

All50M/360s owner/record/byte/input/ACK, active0 full-rest, frozen review,16ms and
512/544 caps, original assets/code/config remain. No Chrome, game, boat, heavy
runtime lock, full long decoder, subworker, deployment or HeroesII ran. Git SHA
plus relevant binary/new-file patches preserve source; media/modules remain
existing-path SHA references. Box ID/state/expiry: NA; coordinator owns shutdown.

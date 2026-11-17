# AoWII audio wait completion and gameplay, 2026-11-17

Evidence: `scratch/runs/20261117-aow2-audio-wait-continuation-gameplay/`.

The two Mss32 audio EIP0 exits are caused by duplicate completion of an
ordinary parked WaitForSingleObject frame. This is not a ThreadProc return.
No audio disable, guessed return fix or crash suppression is used.

Offline examination of the previous first-fault stacks found valid DLL wait
return addresses 24 bytes below terminal ESP, with the original event and
15/5 millisecond timeout arguments intact. One completion owns 12 bytes.
Running the actual shipped Worker completion handler against those stack
fixtures reproduced terminal EIP0/ESP/EAX after two completions. That fixture
alone did not establish what occurred in the original.

One newly authorized registered original retained a passive, bounded history
of secondary Worker wait requests and replies. The actual native path proves
the missing transfer for both slots:

| Slot | First completion | Duplicate completion | Following slice |
| --- | --- | --- | --- |
| 2 | 880 resumes `0x13439f5` | 881 sets EIP0 | 882: zero blocks, ESP `0x7eabfff8` |
| 1 | 2123 resumes `0x13245c5` | 2124 sets EIP0 | 2125: zero blocks, ESP `0x7ebbfff0` |

The history contains two slice replies for the same parked frame before the
two completion requests. No guest slice separates the first completion reply
from the duplicate request. The duplicate reads the saved-register/local word
above the completed frame, which is zero. Both terminal replies have EAX
`0x102`, yield0, threadReturned false and no reported WASM trap. The evidence
therefore identifies an emulator continuation defect, rather than an ordinary
native worker return or a WASM trap.

`ThreadManager._runWorkerThread` previously marked only the awaited slice as
in flight. Direct nested pumps could enter the method concurrently, and the
flag was cleared before asynchronous result/wait-completion handling ended.
The fix synchronously admits one invocation and holds that admission through
the entire operation, releasing it in the outer finally. It changes neither
the Win32 wait result nor its stack cleanup. A duplicate invocation does not
issue a slice or completion. Existing owner, callback, lifetime and release
checks remain in force.

The focused regression drives the production Worker completion handler while
interleaving nested pump admission at slice and completion-acknowledgement
boundaries. It checks immediate and already-parked waits, exact stack/EIP/EAX,
unsatisfied waits and completion transport failure. Original HEAD fails with
two slices instead of one; the corrected scheduler passes all 59 checks.
Three older VM fixtures now provide the browser-input, RenderWorker and RPC
dependencies their production imports require; their assertions are unchanged.

The first original reached the personally reviewed default Julia opening
dialog. The independent disk watchdog stopped it before a world afterimage,
army movement or Quit proof. The Click-to-begin input was attempted; no native
consumption claim is inferred from the interrupted screenshot. Actual Chrome0,
driver1, watchdog0 and supervisor143 waits with both EOFs are retained; owned
scopes and children are empty. Custody was retrieved and hash-verified before
removing its disposable `/dev/shm` profile. No terminal was reopened.

The published `44115957` supervisor and existing direct188/package191,
source/module/media proof are reused. The original standard module is
`87ef39648a61ed6f54ca4ab8de1926de02c651eb2d99655015dc7e5de5407009`.
Git plus relevant patches is the source archive. There are no source archives,
media copies, repeated lifecycle suites, boxes or deployments.

Post-fix native validation and the two-move/menu-Quit outcome are recorded in
the final run result; this note is updated when that bounded attempt ends.

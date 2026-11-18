# Disciples II public mouse route: static boundary

Run: `scratch/runs/20261118-disciples2-public-mouse-consumer-route-quest/`.
**Actual original hover consumption remains unproved.** No producer/readiness
repair, New Quest, map action or ordinary Quit is qualified. No runtime was
launched, and no old endpoint was contacted. The predecessor's external SIGTERM
at 16:17:05.779 remains sender UNKNOWN and its scope permanently closed.

## Newly established static bindings

The registered original EXE is
`adba242a0a3563651baffa6ec7d9a6c0978b7ae844a1cccedb2a1f4e8eb7b1f8`.
The EXE and all five registered DLLs were hashed and their imports parsed.
None has a DirectInput import or matching ASCII DirectInput/device-query name.
This does not exclude constructed names or GUID-based dynamic use. No acquired
device, state query or buffered query is established; DirectInput is not assumed.

Original RTTI identifies vtable `0x6b4094` as `CMqUIKernelSimple` and
`0x6b4164` as `CMqUIControllerSimple`. These are static bindings, not live
object identities. Kernel slot +8 is loop `0x545cf3`; +24 is HWND accessor
`0x545f07`; +38/+3c are sampled client/screen POINT getters
`0x545f37`/`0x545f4e`; +48 is async-button helper `0x545fb1`.

The loop calls cursor helper `0x545e33` at `0x545d95`. Its sole EXE
GetCursorPos call is `0x545e3d`, returning to `0x545e43`. It copies the
screen POINT, obtains ClientToScreen(hwnd,{0,0}) at `0x545e5f`, and subtracts
that origin. It does not test the cursor API BOOL before using the POINT.
The sample precedes an individual unfiltered PM_REMOVE PeekMessageA at
`0x545dca`, or alternate GetMessageA at `0x545db8`. DispatchMessageA is
loaded at `0x545d68` and called through EBP at `0x545de0`. The loop can
continue without queue exhaustion. This is a concrete original-code difference
from the earlier authored drain-then-sample fixture, not a readiness waiver.

After dispatch, controller +4c at `0x545e0c` statically binds `0x5475f8`,
which walks render subscribers. Rendering alone establishes no hover use.

The window creation path at `0x54a9ba` initially uses DefWindowProcA. The
kernel constructor installs subclass **`0x546150`** with
SetWindowLongA(GWL_WNDPROC) at `0x545bb3`, then its object as GWL_USERDATA
at `0x545bc6`. The separately registered `0x54a16a` callback in older notes
must not simply be assumed to be this subclass. The subclass obtains the
target HWND's GWL_USERDATA at `0x54616f` and has distinct routes:

| Public input | Static forwarding route | Simple-controller binding |
| --- | --- | --- |
| WM_MOUSEMOVE | `0x54639c -> 0x546595 -> +68` at `0x5465c4` | `0x5478cf -> subscriber call 0x54795c` |
| Mouse buttons | `0x546409 -> 0x546505 -> +64` at `0x546537` | `0x54782c -> subscriber call 0x5478bc` |

Subscriber lists can be empty. Reaching a forwarder is not successful
application consumption. The async helper separately calls GetAsyncKeyState
at `0x545fd8` and tests the physical high bit at `0x545fde`; live use is
unmeasured here.

**Bink is a competing public cursor caller.** Registered `binkw32.dll` imports
GetCursorPos at original IAT `0x30036138`, with calls at `0x300015a8`,
`0x300017f1` and `0x30002fc3`. Their returns are `0x300015ae`,
`0x300017f7` and `0x30002fc9`. Future observations must identify the actual
loaded module relocation and callsite. An EXE-only caller list or generic
cursor-read count cannot exclude this source. No Bink runtime call is claimed.

The retained audit passes 44 checks of actual PE bytes, whole-file hashes,
query ordering, vtable bindings and competing calls. These are static checks,
not native execution or consumer controls. Exploratory unaligned listing
starts are excluded from instruction inference; exact byte assertions and
aligned query listings support the findings above.

## Remaining public-consumer boundary

The existing observer records the host `get_mouse_position` result before WAT
GetCursorPos stores the public POINT and returns BOOL. That packed host result
and one call-frame word do not establish a successfully completed public query,
or the controller subscribers' use of its data. No actual target HWND, process,
thread, lifetime, device, returned-query data or visible hover consequence is
established in this task.

The next passive instrumentation needs a completed public query and its output,
or exact public MOVE dispatch and caller continuation, bound to actual process,
memory, thread, HWND generation and lifetime. It must separate Bink, nested,
sibling, nonconsuming, failed and stale activity, then correlate with a personally
reviewed whole-frame hover consequence. Existing nonempty refusals remain.
No generic callback/Peek/frame completion supplies that proof. No production
defect has been demonstrated to repair.

## Admission, evidence and release

Initial /home free space was 1,497,309,184 bytes, below the required 1.5 GB;
a later sample was 1,492,959,232. Native controls and a diagnostic original
were not attempted. The newly authorized diagnostic has not been consumed.
Headroom recovered to 1,548,255,232 during sealing, permitting compact durable
retrieval and this documentation. No continuous whole-task floor is claimed.

Git, relevant clean-path diff, unique audit inputs, original binary hashes,
disassemblies, recovery instructions and validation are retained. No source
tree, media, tested module or frame series was copied. There were no source
changes, native controls, build, runtime inputs, private runtime reads/writes,
clock changes, workers, Python, Wine reference or deployment. All runtime,
browser, display, watchdog and actual-parent wait fields are null because no
runtime was created. Box ID null; state NOT_CREATED; expiry null; stop receipt
null. Evidence retrieval and final publication receipts are in the run result.

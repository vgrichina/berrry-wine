# Half-Life 2 agreement diagnostics: installer stopped before Welcome

Run: `scratch/runs/20261117-halflife2-agreement-native-control-install-progress/`.
Published implementation: `9c6eb037f` on main. The installer did not reach its
agreement page in this run. No installation or game launch is claimed.

The retained original native creation trace was read first. It identifies an
ordinary dialog with agreement buttons, Edit `0x10022` (class 2), and Static
siblings. It does not identify which control caused the previous unavailable
text refusal. The previous UNKNOWN endpoint was never contacted.

An authored ordinary DialogBox fixture now optionally creates a password Edit
alongside two native buttons. The real runner's capture refuses that control,
retains its exact HWND/class/`passwordEdit` reason, preserves both siblings,
excludes private captions from the error, and writes no replacement image.
The same test passes inside the sealed source graph with the unchanged module
`9099bb3f694d5ec6dac2886b70c1920fa33f39ad9258b1e662d1ebe05dc2da0a`.
The published `762ce2c29` scene and USER diagnostic bodies are used byte for
byte. No control acceptance or text availability rule was relaxed.

The task adapter composes those diagnostic components and the authored test
from published Git over the original sealed base. It checks all remaining
source identities against the earlier completed wrapper proof, reuses exact
unchanged persistent-owner lifecycle proofs, and performs a fresh outer/native
fixture wait with both EOFs. The focused captured Next guards and canonical
`flock /tmp/wine-build.lock bash tools/build.sh` passed before publication.

One newly authorized original used the unchanged EXE SHA-256
`24205fa8cb6bfab70a82dd713f0addc7cfb0b3c4df40441ebea0320dcb3b441c`.
Compilation, source/module sealing, inheritance and media validation preceded
the native 600-second clock; the independent watchdog was armed for 620
seconds. Actual waiting owner `793103` was tied to worker `783585`; the actual
outer's parent pidfd and survival across tool return are retained.

I made a sequencing error: I issued the first capture while the ordinary Wise
startup dialog was still preparing, before the Welcome page had appeared.
Capture correctly refused `main.visible` and `focus.mainTopLevel`, identifying
main `0x10001`, focus `0x10003`, focus top level `0x10002`, and no modal. There
were no failing controls in that scene. The original made exactly one HTTP
request, no bind or input, and zero requests after permanent UNKNOWN. No image
was produced. The agreement's original offending control remains unknown.

The runtime then performed host SIGTERM cleanup. Native, adapter, outer,
persistent owner and every watchdog have actual waits and both EOFs, exit 0,
and no remaining owned runtime scope. This is cancellation, not native Quit or
successful installation. No timeout, disk-floor trigger, authentication or
network boundary was demonstrated. No box was created (ID/expiry null; stop
receipt not applicable). Free disk remained above 1.5 GB; no RAM gate was used.

No material native implementation fault was demonstrated or fixed, so the
conditional additional original allowance was not exercised. A future task
needs separate original authorization and must establish ordinary startup
readiness before the first personally reviewed capture, then diagnose the
agreement under the unchanged refusal policy. Steam authentication and a
genuine normal installation remain prerequisites for any installed-game launch.

Evidence retains exact Git plus relevant binary patches, tested modules,
unique native logs and metadata, and selected-screens list empty. There are no
source archives, capture bundles, frame series, or copied original EXE. Four
duplicated extracted media outputs are removed only after SHA-256/CRC/raw
DEFLATE recovery verification against the unchanged original; unique output
and the original overlay index remain.

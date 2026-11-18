# AoWII required-body prerequisite and terrain observation, 2026-11-18

Evidence: `scratch/runs/20261118-aow2-required-body-terrain-cause/`.

The historical `oleaut32.dll` cancellation remains unexplained. Its retained
caller delivered 598,288 bytes and EOF before the owning Network session
reported `net::ERR_ABORTED`. EOF does not replace the strict browser terminal.
No DLL implementation, resource exhaustion or rendering cause follows from
that sequence, and the old runtime scope stays closed.

## Published preparation

The older coherent source remains Git `0a823095cd147c43d362384efd33a312cc2766c7`
plus the retained restored-package patch, with published `81ad6c802` thread
manager. Standard module SHA256 is
`87ef39648a61ed6f54ca4ab8de1926de02c651eb2d99655015dc7e5de5407009`.
This is explicitly an older pin, not current main. Source checks and actual
generated-control Worker bytecode extraction bind that distinction.

The old preparation assumed that current files still existed and that the
thread manager was unchanged. Both assumptions now fail before any browser
launch. The new AoWII-specific recovery helper accepts missing/changed text
only after reconstructing Git plus the recorded patch and verifying its
expected SHA256. Media cannot take this recovery path. The native generated
control then passes all 191 strict required-response terminals and reaches the
real `Native VariantInit returned vt=0` marker. No DLL bytes, registry or game
state are substituted.

The actual main-page `WineAssembly.fetchAssetBytes` streaming reader and a
real browser Worker reader independently consume
`binaries/dlls/oleaut32.dll`: 598,288 bytes, SHA256
`baeb2f7c1b8be56738d34e1d1ddf8e0eebd3a633215dc1575e14656be38b939d`.
Both pass unchanged strict transport assessment. The path's actual filesystem
alias and requested spelling are recorded separately. Worker transport control
is a JavaScript reader, not an additional native guest-loader claim.

Two separate negative native-browser controls serve the genuine DLL bytes
through deliberately delayed responses at the same path with explicit control
queries. An explicit AbortController produces `ERR_ABORTED`; a 6.5-second body
delay exceeds the unchanged 5-second collector deadline and produces
`body timeout`. Each closes UNKNOWN, with no subsequent endpoint requests or
replay. These controls qualify detection, not the historical cancellation's
cause. The synthetic collector suite passes 129 cases; focused recovery tests
reject altered hashes/media recovery and prohibit EOF-only acceptance.

The canonical locked build passes. No shared runtime behavior changed. The
qualified passive Device7 observer, native covering-red/narrow-strip and
whole-memory controls remain reusable; their first original kick was target
upload, not proof of completed draw output. The fresh original's result will
be recorded below after its single authorized observation.

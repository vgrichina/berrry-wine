# Half-Life 2 Subscriber Agreement public Edit diagnosis

Published repair `f169ac488` adds bounded numeric provenance to native text
refusals: signed reported length, exported pointer, memory byte length and a
memory-span check. It never reads, decodes or hashes refused text. Password
controls return before either text export. The existing 65,536-byte complete
text observation limit and complete-image refusal remain in force. Invalid
non-i32 lengths also fail closed. Diagnostics serialize an explicit primitive
allowlist, never the control row, title, text, executable path or arbitrary fields.

The sealed native module remains
`9099bb3f694d5ec6dac2886b70c1920fa33f39ad9258b1e662d1ebe05dc2da0a`.
The existing 5,003-file inventory is reconstructed and verified before changing
only the two public observer files and their focused test. Immutable runtime
manifests record those exact changes; no concurrent foreign work is adopted.
Existing native/component/Next/multipage/cleanup proofs are reused where unchanged.

Source inspection establishes that `native_user_text_length` reads the native
EditState's text_len, in characters excluding NUL. The native ordinary
GetWindowTextLengthA path sends WM_GETTEXTLENGTH, whose Edit handler returns
that same field. An authored real PE creates a native multiline Edit, sets
70,001 characters with ordinary SetWindowTextA, calls GetWindowTextLengthA,
and changes its public title only if that returns exactly 70,001. Its observer
then reports exactly 70,001 with an in-bounds span and refuses complete capture.
No text truncation, replacement image or capture is written. Native password,
invalid/noninteger/negative length, null/outside-memory span, private-field
sanitization and replacement-during-capture tests pass. Both working and
published sealed tests, captured-Next/context guards, cleanup tests and the
canonical locked build passed. The full original core suites were not repeated.

Exactly one authorized ordinary original ran for numeric diagnosis, with
600/620 deadlines and independent watchdog prearmed. Module/source/media
identity preceded execution; passive owned-listener observation preceded HTTP.
The full Welcome and Internet Required images were personally viewed, with
separate current metadata inspection before each review. Their current Next
HWNDs were 10011 and 10017. Both yielded native BUTTON dispatch-return ACKs and
independent physical UP within unchanged 500/1750/3000 deadlines. No previous
page target was reused.

The genuine Steam Subscriber Agreement's Edit 10022, class 2, generation 34,
then refused complete capture. The newly measured public numeric failure is:
reported length **453,207**, exported native pointer **135,831,556**, memory
**536,870,912** bytes, spanInBounds **true**. The pointer is an observation of
native public control backing, not an application-private probe. It is not a
portable address. Memory-span validity does not prove an allocation's validity,
text correctness, a legitimate huge document, corruption, or faithful visible
layout. No refused text was exposed. The transition snapshot is not a substitute
for the refused agreement capture.

This repairs the missing numeric diagnosis, not the still-unqualified complete
observation of this control. There is no supported native semantic fault to fix
from these retained observations. A larger limit, title whitelist, arbitrary
prefix, unsupported-control suppression or invented viewport would not be a
faithful repair. The concrete remaining blocker is complete public observation
of that 453,207-byte-reported Edit under the unchanged capture policy; a future
repair needs actual native length/allocation or layout provenance establishing
what is wrong and a faithful authored reproduction. The conditional second
original was not authorized by any demonstrated material native fault and was
not used. No agreement acceptance, installation, authentication or gameplay is
claimed. The Internet Required notice is not an encountered network/service error.

UNKNOWN permanently closed the endpoint, with zero later HTTP, query, rebind,
replay or retry. Native, adapter, outer, persistent owner and every watchdog
have actual waits and both output EOFs; the owned scope is empty. Host cleanup
is not native Quit. No box was created: ID and expiry null, state NOT_CREATED,
stop receipt NOT_APPLICABLE. Evidence, exact Git/patches, selected whole PNGs,
source/module-before-execution proofs and verified artifact hashes are under
`scratch/runs/20261117-halflife2-subscriber-public-edit-observation/`.

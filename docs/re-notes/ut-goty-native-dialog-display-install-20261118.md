# GOTY authored dialog display preparation, 2026-11-18

Evidence: `scratch/runs/20261118-ut-goty-native-dialog-display-install/`.
No original installer or game has run at this preparation checkpoint.

The previously reported blank capture has SHA256
`8b6859eb449d3228524b27650c5ce110fca37c65853867dbc838013d2c142642`.
Fresh exact authored MessageBox/read-only-disc/self-ShellExecute controls at
1024x712 produce that same complete PNG, including 52,080 non-desktop pixels.
The original compressed bytes decode to a caption, message, focused OK and
Cancel. Repeated captures are byte-identical. Treating this hash as evidence
of a blank native render was incorrect.

Existing `--trace-ctrl`, `--trace-gdi`, `--trace-composite` and generic host
tracing establish the actual path: native control paints into canonical DIB
`0x1c000000`, surface `0x610001`, attached to live HWND `0x10001`, with process
1000 and the matching instance. The compositor selects this window and its
back surface. Passive pre/post reads retain canonical and derived surface
checksums, ownership, geometry and clip state. No window, focus, clock,
invalidation, input fence or painter was synthesized to obtain these facts.

The pinned module is SHA256
`514478fe584a69e23792575ab94ea497e859b9034d978e5d2ed943d0e8f49c98`.
The locked full build reproduces it byte for byte. Git commit, relevant dirty
binary patch and source-file hashes accompany the retained module; sources
were not archived. The authored fixture was reconstructed from the retained
small C/JavaScript recipe after its original EXE disappeared.

The file-image tool returned an `application/octet-stream` data URL. An explicit
PNG MIME type and lossless re-encoding each produced a personally visible whole
dialog, but later repeated previews were still inconsistent. MIME alone is
**not** a proved complete repair. The remaining preview-transport cause is
UNKNOWN; there is no demonstrated native USER defect to patch. The earlier
unpinned scope stays closed and no causal module regression is claimed.

`tools/ut-goty-dialog-display.cjs` prepares an existing whole PNG for review:
it verifies the signature, CRC/decode and optional expected SHA256, supplies an
explicit `image/png` content block, and reports decoded dimensions and pixel
census. It preserves every original encoded byte. It never calls a runtime
endpoint or claims personal review from a pixel count. Regression controls
cover format, unchanged encoded/decoded bytes, SHA mismatch, truncation and
corruption. This repairs missing evidence validation in preparation, not USER
painting or the external image viewer.

A real Chrome control mounts the same authored read-only disc through normal
media import and runs the unchanged authored PE in the normal guest Worker.
Debugger bytecode readback matches the pinned module above. The complete host
screenshot personally shows the caption, message and OK/Cancel; its whole
guest canvas also contains exactly 52,080 non-desktop pixels. Browser input
and child completion are not claimed. The first browser attempt's local
bytecode-collection error was corrected with actual flattened Worker sessions;
both browser processes have actual waits and both pipe EOFs.

One native investigation submission was mistakenly batched with image inspection
and described a prior positive frame. Its native consumption, independent UP
ACK and parent/child Exit0 remain evidence, but it is explicitly excluded from
reviewed-input acceptance. A later zero-input diagnostic scope was cancelled.
The fresh positive native control selected a 1024x768 screen before launch,
was personally reviewed in a separate tool turn, and submitted one fixed
300ms Enter with the published guard helper's final-choice path. The original
500ms confirmation, 1750ms independent UP, identity/generation fences and
900/920/180 custody policy remain unchanged. Actual wait receipts, rather
than a post-exit endpoint, determine completion.

At the initial local-media check, the unique recorded ISO was absent, as were
other workers' retained binaries. This worker performed no download or disc
copy. The retained Manifest permits a mandatory source-size census, but its
`.uz` map sizes do not establish expanded installation space. Exact expanded
space remains unknown until the unique disc is available. No installation
write or incomplete game launch is justified by that lower bound.

## Ordinary bootstrap and provider-backed child repair

The coordinator subsequently restored the one missing disc at its original path,
with an independent whole-file rehash of all 649,633,792 bytes to the original
`e184984ca88f001c5ddd52035d76cd64e266e26c74975161b5ed72366c74704f`.
This worker rehashed it again and performed no download or duplicate disc copy.
The normal media importer selected `D:\Setup.exe` from AUTORUN.INF and extracted
only that process image for the native loader. The first actual original scope
exited without displaying a wizard or installing any files: both ordinary
CreateProcess and ShellExecute attempts to `D:\System\Setup.exe` failed with
"could not be exported". Parent/supervisor/watchdog have actual waits and EOFs.

A generated provider-backed PE control reproduces that failure with the same
native runner and pinned module: the old snapshot-only lookup fails before any
dialog and the guest exits 47. Source-disc entries deliberately retain their
provider even after reads, so the mutable-state exporter correctly omits them.
The selected child image now gets a separate temporary loader file, outside the
mutable snapshot, while its original media ownership and mount context remain.
No other media entry is read or exported. Unfilled asynchronous providers still
fail explicitly; partial bytes never launch.

The first repair control exposed a second failure: `seedExeImage` replaced the
restored read-only executable with a resident entry, and the existing completion
guard rejected that unsafe D: state. Seeding now verifies matching loader bytes
and preserves the exact source-owned object on read-only drives. Missing owners
or mismatched bytes fail before alias writes. The completion guard is unchanged.
A fresh native control starts the actual D: child, validates read-only media and
exact renderer-test arguments, writes PASS, exits 0, and completes a guarded
merge. Its whole dialog was personally reviewed. A later Enter closed the parent
before independent UP could be acknowledged, so that submission is UNKNOWN and
is not an input acceptance pass; its scope stays closed. The earlier exact
self-child control remains the successful reviewed-input control.

The browser control also launches a real provider-backed D: child through the
normal shell. Its whole host screenshot personally shows the child-authored
message after checking read-only drive, profile and exact arguments, alongside
both running apps. Actual Worker bytecode matches the pinned module. Browser
input or completed child merge is not claimed. An earlier browser diagnostic
showed real child Exit0 but parent marker timeout; that separate browser merge
behavior was not changed in this native loader repair.

Focused checks cover snapshot exclusion, selected-image bytes, unchanged source
identity/provider, read-only write rejection, unrelated lazy media exclusion,
resident-image reuse, missing image, asynchronous-source rejection and immutable
seed mismatch/missing-owner rejection. The existing VFS seeding suite passes.

## Native private DLL discovery parity

After publishing the loader repair as `49dd59dba` (strict pull and push both 0),
the second fresh ordinary autorun reached System\Setup.exe but failed at batch
0 on the decorated UClass constructor imported from Core.dll. The actual Core
DLL is on the disc; CLI graph admission considered only the registry's names,
so it never asked its existing guest-path resolver for this private sibling.
The browser already admits genuine mounted private siblings. A narrow native
admission helper now applies that same rule to imports: actual files in the
executable's guest directory, excluding builtin-only system DLLs, static module
placeholders and path-shaped requests. No registry list, app registration or
explicit DLL seed was changed.

A generated disc child importing PRIVATE.DLL reproduces the exact old failure:
`DiscValue` becomes an unimplemented API and the child crashes at batch 0.
With native admission, the actual sibling PE loads, DllMain runs, DiscValue
returns its authored 0x432 value, the child exits 0, and its PASS file merges
through the unchanged completion guard. The whole parent dialog was personally
reviewed in a fresh scope with a preselected separate control port. An earlier
fixture overlap caused EADDRINUSE and the identity guard refused capture; that
scope was cancelled without binding or input. No original scope was affected.
Focused negatives cover builtin exclusion, sibling-directory scope, explicit
path refusal, placeholders and admission without touching provider bytes.
The browser private-DLL control also personally shows the child-authored dialog;
its host log proves PRIVATE.DLL discovery, real PE mapping and DllMain return.
Both actual Workers' bytecode matches the pinned module. No browser input was
sent. Focused checks and the subsequent locked full build passed.

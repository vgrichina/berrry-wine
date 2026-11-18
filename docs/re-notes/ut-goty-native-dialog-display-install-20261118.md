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

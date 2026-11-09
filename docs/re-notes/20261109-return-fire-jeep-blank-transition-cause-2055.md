# Return Fire: blank review contradicts retained capture bytes

Run: `scratch/runs/20261109-return-fire-jeep-blank-transition-cause-2055/`.
Inspected checkout: `02e95626dcbc46b7cab11618eec1b904f844f7b9`.
Historical runtime: `a5f4d260838790605c1c0d62acc046884eeaf7fd`, module
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.

The reported disappearance after Right100ms is **not present in the retained
PNG**. This corrects the visual conclusion in
`20261109-return-fire-bunker-entry-jeep-2045.md`, without changing its terminal
safety decision or historical artifacts. No new native execution was needed.

## Discriminating evidence

The prior run's `review/jeep-info.png`, `review/jeep-screen-mode.png`, and
deduplicated `retrieved/original/jeep-screen-mode.png` are byte-identical:
25,334 bytes, SHA-256
`7b27f488f0624cbde33f68f3938a24606eef4208c01d755d88e3730143388ae3`.
The remote command5 inventory and both capture records already report that same
hash. Thus this is not merely a local path mix-up or a changed downloaded file.

Independent PNG decoding with CRC checks yields the same RGBA digest for all
three files:
`636aefff98a657423518f12fb8686b4f87bdbb15ba9994ee59adb49fd3517912`.
The image is 945×889, has 91 colors, and contains 91,564 non-teal pixels within
the game-window rectangle x156–483, y97–382. It contains the title bar, menu,
jeep information and lower display. It is not a uniform teal desktop.
`audit.cjs` and `audit.json` retain the reproducible numerical comparison;
`retained-command5.png` is the sole copied capture, with no pixel transformation.

Separate model-review tool calls reproduced contradictory presentations of
these same bytes: some showed the window, others only teal. The `view_image`
returned data URL was independently compared to the original file's base64 and
matched exactly. Its MIME was `application/octet-stream`. Forwarding those
bytes as `image/png` once displayed the window, but later explicit PNG and
original-detail calls still appeared blank. **MIME alone is not a proven cause
or repair.** A proposed MIME adapter was tested and removed before publication;
the failed local assertion and subsequent observations remain in run evidence.

This locates the concrete discrepancy after retained capture publication and
decoding, at image presentation/model review. The underlying presentation
mechanism is outside this repository and remains unknown. No causal emulator
input, window, surface or compositor defect is established by this incident.

## Input and lifecycle checks

Read the actual retained `browser-run.cjs`, `bound-input.cjs`, ordinary-key
consumer and collector, alongside tracked composition and renderer input code.
Command5 uses native `ArrowRight`, code `ArrowRight`, VK39. The hold receipt
records exactly 100 ms; a wholly in-hold passive sample reports key39=32768,
and the capture identity reports key39=0 afterward. The renderer maps Right to
Set-1 scan code 0x4D with extended-key handling. There is no wrong-key evidence.

The actual capture consumer calls `Page.captureScreenshot`, base64-decodes the
response, hashes it, writes those bytes once, then publishes binding/capture
metadata. Process, page renderer, canvas, worker instance and module identities
match before/after. The guest remains running without a trap. Retained state
does not contain a window-table/surface-event history, so it cannot establish
every transient guest transition. The exact identical frame establishes only
that the captured output still contains the jeep screen. A movement-mode toggle,
guest keyboard polling, later persistence and successful gameplay are unproved.

The next useful action is to address the image-review presentation discrepancy
using this exact PNG/hash, or resume separately assigned gameplay with reliable
review. Repeating this native sequence to obtain another blank-limit note would
not discriminate a new emulator boundary.

## Validation and runtime ownership

The retained-byte audit passes. Tracked composition, collector, native-key and
lifecycle focused checks and the locked build were rerun; results are in this
run's logs. No shared pinned provider or production source changed. Evidence
contains exact Git SHA and a relevant working-tree patch; no source/media archive.

No box was created, leased, resumed, captured, stopped or otherwise controlled
for this investigation, so there is no new UUID, expiry or stop receipt.
Historical evidence references box `bx_p7b6wwek`, UUID
`a3a3df08-526c-40bb-8832-06d1cacfe525`, already archived; initial expiry
`2026-11-09T21:08:14.092Z`, final `archiveAfter:null`, separate `expiresAt` not
returned. Historical receipt `stop_19ec2c8bedbc4a5d` completed unforced at
`2026-11-09T20:47:00.318Z`. That run retains actual watchdog wait0 and separate
stdout/stderr EOF. These are historical receipts, not newly performed actions.

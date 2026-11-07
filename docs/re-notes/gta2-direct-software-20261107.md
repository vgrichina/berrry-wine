# GTA2 original direct launch, software walking and driving — 2026-11-07

Settled walking, native Enter vehicle entry and separate settled driving were
personally reviewed on the original GTA2 Wild Demo using the production
SOFTWARE renderer. This establishes the narrow software gameplay cell for
GLD3D-CORPUS-27-20261006. WebGL evidence `27fdd86e9` remains separate. No
emulator defect was demonstrated and no production code changed. There is no
combat, audio, FPS, parity or full27 claim.

Evidence: `scratch/runs/20261107-gta2-direct-software/`.

Before allocating, seven controls ran the actual production direct initializer
extracted from `index.html`. They cover the filtered-out original and
`dx_boids`, delayed registry restoration with DOMContentLoaded, wrong ID,
cancellation, a present option, sign-in resume, and explicit
`shell.launchApp(wanted, {directIntent, startedAt:0})` arguments. The MCM
direct-route harness was reused with its production behavior preserved.
The browser used `?debug&threads&d3d-renderer=software&app=ID`; the dropdown
remained Notepad. No catalog option or fake launch was introduced.

The literal action controls execute the actual browser harness executor with
mock transport. The intended arrows, Enter, Escape and 50/100/2000 ms holds,
balanced clicks/double-clicks, capture, quit and invalid key/wait checks passed.
No text entry was intended. Initial preparatory assertions incorrectly counted
capture as a dispatch and allowed an earlier mock Alt tap to leave menu mode
active for Escape; both control expectations were corrected before allocation.
The production renderer/DirectInput key state checks pass independently.
Durations 0, 49, 2001, 3500, -1, NaN and 100.5 reject before transport and input;
accepted bounds are 50–2000 ms. Each Chrome session also recorded five balanced
trusted arrow/Enter pairs on about:blank before selecting an app, with zero
events from invalid-duration requests.

The dependency inventory includes `tools/protected-writer-entries.js`, every
`render-artifact.js` identity input and the static relative require closure.
Miles resolves at its actual app-local URL:
`/binaries/candidates/gta2-demo/installed/Program_Executable_Files/mss32.dll`.
Both Miles and COMCTL32 returned HTTP 200 with pinned bytes before each browser
launch. No `/null` request occurred. All 694 staged pins match before and after.
The retained supplied media comprises 69 registered paths plus the installed
EXE and Miles DLL: 71 files, 26,207,806 bytes, unchanged before/after. The older
73-payload distribution and upstream provenance are not reconstructed.

| Installed file | Bytes | SHA-256 |
|---|---:|---|
| `gta2.exe` | 2,893,824 | `97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3` |
| `mss32.dll` | 331,776 | `0974b244354a5d13e0711db15430c05f7949dc279b63897146f304d1401153fc` |

Before the original, the generated x86 public COM/vtable Surface4/7 regression
passed remotely through its prepared and consumed `com-preflight.wasm` and
identity manifest. The real `dx_boids` guest then launched in a Worker through
the production direct URL. Its owning renderer Worker target
`4D59EDE7FFECCA3CEA2B965BA90A9FA5` had endpoint 1, legacy/software, no adapter
(therefore no GPU adapter), no endpoint failure and control error 0. Direct
software draw completions advanced **195,506 → 222,507** and completed sequence
**52,208 → 59,108**; guest fallback count was 0. The software path deliberately
has no adapter and counts draws in endpoint evidence; an inherited WebGL
adapter assertion was corrected by reading this production contract before
allocation. The sample's colored boids and boundaries were personally viewed.

A separate generated guest called real COMCTL32 PropertySheetA. Its ordinary
property sheet and label were personally viewed; a balanced native click on OK
at page coordinates 173,418 dismissed it, also personally viewed. This used a
scratch generated fixture entry and explicit shell launch without changing the
dropdown or original registry entry. Both generated browsers closed normally,
and their processes, ports, profiles and writer locks were absent before the
original. The earlier software attempt never launched a guest and remains a
launch-readiness result, not evidence of a renderer defect.

Exactly one original started at **02:29:26.512 UTC**. Each input used reviewed
geometry and the existing freshness admission protocol. The capture sequence
establishes:

- `review/playing.png`: the on-foot player starts on the round brick park pad.
  `walk1`, `walk2`, `walk3` and `walk4` show the pad receding above the player,
  followed by descent of the stairs between buildings. `walk6`, `walk7` and
  `walk8` show the alley, roadway and grass median passing the camera. Each
  walking capture follows key release and 1000 ms without input.
- `review/entry2.png`: native Enter, held 2000 ms, initiates entry beside a
  brown car. `review/settle-entry.png` follows another 1500 ms without input:
  the BUG banner appears, the brown car occupies camera center, the on-foot
  player is absent and the former occupant has departed onto the north median.
  The money display is $10.
- `review/drive1.png` and `review/drive2.png`: separate Up holds of 2000 ms,
  each followed by 1500 ms without input, move the car east. The SLOW marking
  shifts left and the gantry and zebra crossing enter from the right.
  `review/driving-settled.png` adds 2000 ms with no input: further coasting
  shifts those landmarks left while the brown car remains near camera center,
  behind the blue car. This is driving translation beyond traffic animation.

All **20 original commands** have complete ACKs, including quit. Three requests
(`play`, `walk5`, `entry1`) were refused stale before dispatch with explicit
effects 0, then refreshed under new IDs. No UNKNOWN/partial input or replay
occurred. A mistaken read-only fetch requested the nonexistent `play` capture
after the first refusal; it failed without guest effect and is retained as
`first-error.json`. Subsequent request handling checked the ACK before fetching.
The cleanup template's literal `UNKNOWN; never replay` is a generic policy
label, not an input outcome.

The actual original renderer Worker target
`AEA95198DB365AE713397F098603E706`, session
`935537845319E649A016CEB18F2597BB`, owns endpoint 1, legacy/software. At the final
settled capture it records **345,907** direct software draw completions,
completed sequence **612,206**, batches **333,054**, commands **345,907**,
ready 1, error 0, failure null and adapter absent. The guest reports fallback
count 0 and null GL renderer/version. These identify software ownership, not FPS.
The browser presented screenshots supply visual evidence.

All three executing original Workers (main guest, guest thread and renderer)
yielded actual Wasm bytecode with SHA-256
`f18229189ae8e50fe938baaa6f2fe2821ee60c297acf7116f5cfeb8529915eaa`
(2,181,162 bytes), matching the staged standard module. All 29 executing
JavaScript source records match their exact staged pins. Chrome was
151.0.7922.108, V8 15.1.206.16. Source staging HEAD was
`cb5f15aa7ae1182e68e38efc46c5923140d52e2c`; relevant dirty and new-file patches
are retained. Existing modules were reused; fresh build provenance is not
inferred from that source HEAD. No local guest runtime or build was run.

All **250 remote artifacts** were retrieved or verified against identical local
bytes, with repeated modules deduplicated and mapped. All **601 complete HTTP
200 responses** match exact files; no successful response is unmapped. The
audit separately retains non-200 build-info, auth, favicon, sample-icon and
optional font-bundle responses; individual font loads succeeded. URL decoding
was needed to map the successful `gta2%20manager.exe` media response. App-local
SHELL32/OLE32 used the recorded built-in stub fallback; no replacement DLL was
introduced. Guest media, config and save inputs were not edited.

All three Chrome exits were 0. Processes, six ports, profiles and writer locks
are absent. The immediate terminal inventory caught the original controller
finishing exit; `final-original-process-check-remote-result.json` confirms it
absent afterward. Delegated normal stop `stop_0c1d0d440052ef3a` completed at
**02:34:14.783 UTC**, forced false, error null. Boat `bx_tbyx72n9` is archived,
active expiry null. Allocation through retrieval and completed stop took about
**6 minutes 51 seconds**, below 35 minutes. Local disk stayed above 2 GB.
No automated risk flag, old403 resume, held-risk retry, second original, nested
worker, source/media archive or deployment occurred.

Findings only are published; no production repair or full build is claimed.
The requested software walking, native entry and settled driving evidence is
complete. Other gameplay dimensions require separate evidence.

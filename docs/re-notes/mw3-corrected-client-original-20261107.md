# MW3 corrected operator caller original — 2026-11-07

The repaired exact caller reached the original MW3 demo main menu and returned
three exact numbered ACKs. The first gameplay prerequisite blocker is menu
navigation: one trusted, balanced native click on **Instant Action** left the
main menu open. No cockpit or movement/fire consequence was reached. The
internal cause of the failed selection remains unknown.

Evidence is in `scratch/runs/20261107-mw3-corrected-client-original/`.
The released predecessor `afe89042a` and its executable preparation recipe were
read. One fresh `POST /sandboxes` used a persisted UUID Idempotency-Key; no old
transport or boat was reused. The separate runtime root was
`/home/user/mw3-command-client-original-runtime`. All 306 manifest files and the
manifest were individually uploaded; their SHA-256 and lengths passed before
launch and after completion. Original route, media, configuration, browser and
safety helper bytes were preserved. Only the owned boot wrapper was adjusted
to require the fixed allocation deadline through `ALLOCATION_DEADLINE`, instead
of constructing a later deadline at browser startup. The operator caller's
literal ACK timeout stayed **20000 ms**.

The tested checkout was `50186e0b0733a0e08b04a74f8320380de97b22e2`;
`source.json`, binary patches and `run-inputs.patch` retain relevant changes and
small helper recovery inputs. The inherited manifest records its earlier
baseline `7f4486b5389817faca7c8a4f9bc602152e708dcf`; the baseline-to-tested patch
records the relevant committed difference. Both live guest and owning renderer
module bytes were retrieved through CDP and matched
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`
(2,182,493 bytes). This is measured module identity, not a claim that the module
was rebuilt at the tested checkout. Existing media retain path/hash/length
references in the manifest; no source or media archive was made.

## Reviewed navigation evidence

ACK 0 was `menu-observe`. The personally reviewed immutable `reviewed/menu.png`
(SHA-256 `97ef0d55ff45cfc74d6522ebf310ca2b469aae26d3958b126a9f398012bd683b`)
shows Campaign, Training, Instant Action, Multiplayer, Options and Quit. This
is the original game menu, beyond the startup splash, but is not gameplay.

ACK 1 was `instant-action`: a click at normalized canvas coordinates
`[0.30,0.44]`, with one DOWN and one independently armed UP after 100 ms.
Admission revalidated all 18 retained owner/module identity fields against the
reviewed capture; its age was 17,040 ms, within the unchanged 120,000 ms bound.
The native evidence records trusted mousemove/mousedown/mouseup. DOWN ACK
arrived at 14:51:15.367Z; UP was independently attempted at 14:51:15.456Z and
acknowledged at 14:51:15.461Z. The renderer later reported mouse `(182,211)`,
buttons zero and an empty input queue; the live guest retained focus HWND
65537. No UNKNOWN, replay, relaxed admission or second gameplay input occurred.

The personally reviewed `reviewed/instant-action.png`
(SHA-256 `192c3ab3ed1ca7324ebd22a1edb517e5bc4345b7642b222dccfb73224bf77506`)
still shows the main menu after the two-second wait, with the visible game
cursor near the center. Animated background pixels changed, so this is not an
identical-image assertion. Browser event acceptance and a drained renderer queue
do not establish guest button consumption or the internal reason for no menu
transition. The next bounded investigation should qualify the original game's
mouse/cursor/button consumption before another original navigation attempt.

## Shutdown and validation

ACK 2 was ordinary `quit`. Chrome exited normally with code 0 and no signal at
14:51:41.245Z. Both recorded PIDs were absent, no owned Chrome/Node process
remained, both ports were closed, and profile, writer lock and held input were
absent. All 53 unique terminal artifact paths (1,235,150 bytes) were recovered
and SHA/length verified before normal delegated stop. Duplicate locally recovered
review PNG/metadata bytes were removed after equality checks; their verified
review copies remain. `retrieval-verified.json` records the surviving paths.

Fresh box **bx_8ys2y2bs** is **archived**, normal stop completed
14:52:03.763Z with `forced:false`. Current expiry/archiveAfter is **none**;
original expiry was 15:50:18.422Z. The immutable allocation-derived execution
cap was 15:15:18.572Z; shutdown preceded it. No lifecycle ownership remains and
no old boat was touched.

Syntax, 306 pre/post pins, original-browser byte identity, corrected caller
literal, exact ACK bindings, reviewed PNG hashes, live module checks, independent
UP receipt, terminal custody and recovered artifact verification passed.
An initial final-verifier assertion compared the original browser with the
intentionally modified preflight sample; correcting that comparison to the
original predecessor passed against retained bytes, without rerunning a browser.
The one-second local disk monitor's minimum was 3,421,626,368 bytes; the remote
2 GB guard never fired. The global evidence checker still reports the preexisting
Alice containment error, unrelated to this run. MW3 has no exact current corpus
manifest entry, so evidence stays in this investigation note and `outcome.json`;
no unrelated dashboard candidate is claimed. No production code changed, no
accepted matrices were repeated, and no build was required for this docs-only
publication. This single bounded task stops here.

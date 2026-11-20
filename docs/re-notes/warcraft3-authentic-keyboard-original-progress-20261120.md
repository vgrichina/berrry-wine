# Original Warcraft III keyboard route, 20 November 2026

Run `scratch/runs/20261120-warcraft3-authentic-keyboard-original-progress`
verified an authentic main-menu shortcut before opening a browser. The local
original `war3.mpq` (SHA-256 `9e19d7ffb65054e4bdd3add7e26d70e16f063cdc20fa5b57639f3b9b7a196f9c`)
contains `UI\FrameDef\Glue\MainMenu.fdf`. Its `SinglePlayerButton` explicitly
declares `ControlShortcutKey "S"`, `TabFocusDefault`, and
`TabFocusNext "MultiPlayerButton"`. This establishes S independently of label
capitalization. The run retains the archive/block identity, asset hash, and
numbered excerpt in `authentic-keyboard-route.json`.

The actual original ran with both worker modules SHA-256 `10bdae2c…63564`,
real CRT `887eb5ce…9fd1`, software GL GPS, and a private 800×600 display.
The worker personally reviewed the whole host consent frame, then the whole
original fullscreen main menu (`frame-102a5bc4…ce6f.png`). One deliberate
300 ms S press used the existing native keyboard path, with a prearmed,
independent trusted key UP. No production source, callback, guard, module,
media, or private-context behavior changed; historical proofs were hash checked
and reused without fixture calibration.

The exact key DOWN was published at 15:49:06.228 UTC and applied at .234.
Status reads remained `DELIVERY_PENDING`, with no native message/token or
USER-return consumption receipt. At .401, readiness failed solely on
`fresh=false`: `sceneAge=253` ms, `sceneMonoAge=253.304931640625` ms, against
the existing 250 ms bound; all other fourteen predicates were true.
The ordinary runtime scope closed at .405 with 117 requests and zero later
ordinary requests. The prearmed trusted independent key UP arrived at .531.
Neither the 500 ms native deadline nor the 1500 ms hold guard was widened.
This reproduces the freshness blocker through the documented keyboard route;
it does not establish its cause. The shared capture/input pipeline remains
its author's responsibility.

Single Player/profile/Prologue/Thrall movement/objective/normal Quit remain
unproved. The closed runtime must not be replayed or queried again. All 22
supervised PIDs retired, with browser/display/helper joins and EOF, no leaks,
and independent finite runtime/cleanup deadlines. No box was created. No
Python, Wine, workers, or deployment was used. Only run-local helpers and this
note changed, so no full build was required. `RECOVERY.md`, exact Git/diffs,
media references, cleanup audit, and the final `result.json` retain recovery
and failure details.

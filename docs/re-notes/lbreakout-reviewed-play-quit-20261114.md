# Fresh original LBreakout2 reviewed play and native application Quit

The authorized single fresh original run succeeded. Evidence is
`scratch/runs/20261114-lbreakout-reviewed-play-quit/result.json` (ignored).
The registered `lbreakout2_251` standard CLI reached Local Game, whose Resume
tooltip explicitly reported no game to resume. Resume was never activated.
Reviewed Start Original Set opened **Late At Night (1/25)** with score **0**,
five yellow lives, attached ball and paddle centered near x400. No old save
was imported; the ordinary fresh VFS used the original profile/defaults.

A separate independently released 120ms Right moved the paddle center to
about x484. A separate 120ms Space produced a lost life, reset paddle and
darkened bottom-row tile. A second independently reviewed/released Space
visibly detached the ball near `(409,450)` above the paddle. Subsequent
review showed three yellow lives remaining and a second darkened tile.
Score remained **0**. Offline RGB comparisons confirm bottom-row rectangles
`(440,369,40,20)` and `(400,369,40,20)` changed from mean138.10 to67.79 after
the respective serves. This establishes visible consequences, **not brick
destruction**, level clear or next-level progress. Twelve selected full PNGs
were individually inspected and are named in result.json; other captures
were removed with compact metadata retained.

Native shutdown was begun early. Separate Escape visibly produced the actual
**Quit Game? y/n** prompt. Only after reviewing it was Y pressed. After a real
wait the Local Game submenu was fully visible; a separate Escape returned
to the fully visible main menu. The first Up selected Local Game; a separately
reviewed second Up wrapped to the actual **Quit** item. Only then was Enter
pressed. The guest logged **`[Exit] code=0`**, with runtime statistics
**182.091 seconds**. This is native application Quit, not the CLI guard.
No P input was used or pause claim made.

The immutable CLI maximum was360 seconds; an independent observable380-second
watchdog was armed before guest launch. Both runtime and watchdog were
actually waited with status0 and both stdout/stderr EOF; no deadline fired,
residual process group was killed, or active deadline extended. All16 recorded
runtime/watchdog/release PIDs are absent. Every key pulse had an independent
UP process armed before DOWN, unique nonreplayed token, fresh reviewed image
hash/age checks and current visible LBreakout2 focus checks. All UPs were
acknowledged and actually joined. There was no autoplay, tracking, solver,
state/config/physics/score/clock edit, forced guest call or synthetic frame.

The pinned verifier passed220 original client files,219 exact companion
mappings and authentic CRT before launch; all221 media/manifest/CRT pins
matched again afterward. No download, copied media or source archive was
needed. Exact source SHA, relevant dirty/new binary patches and module hash
are recorded in source-pins.json and result.json. All320 runtime pins remained
unchanged. Git plus patches is the source archive; no Wasm dump was retained.

Eight native-key/pulse controls and two independent watchdog controls passed.
This worker's full build passed under both wine-heavy-runtime.lock and
wine-build.lock. The original runtime held the heavy lock for one finite
turn, using default1000-block slices, real ticks, no secondary host Workers
and an800x600 host screen. The lock was released before finalization and TIM
was notified for the next fair turn. Foreign WIP and production files were
untouched. No generic production defect was established or speculative fix
made; publication is documentation only.

Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **not
applicable**. No box, worker or public deployment was created. The assigned
task is complete; no further run is needed.

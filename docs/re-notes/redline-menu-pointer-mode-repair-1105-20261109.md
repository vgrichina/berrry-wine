# Redline unlocked menu route correction — 2026-11-09

The run input now selects the reviewed **Training Levels** button with an
ordinary absolute click, replacing the rejected `relative dy:24` step. No
production input behavior changes. Evidence and the small recoverable input
patch are in `scratch/runs/20261109-redline-menu-pointer-mode-repair-1105/`.
`menu-command.cjs` generates the command from the caller's current reviewRef:
`click`, normalized canvas point `[.51,.59]`, hold150ms, wait1000ms. It uses the
existing generated1050 controller and menu adapter; an observed lock still
refuses this absolute target, with zero mouse dispatch. There is no automatic
fallback or lock request.

Retained1050 `review/menu.png` shows Start Up and Training Levels. Its actual
canvas CSS rect is left0/top34/945x855. The command therefore submits CSS
481.95/538.45, inside that pictured button. This is screenshot/canvas geometry,
not an inferred Win32 coordinate mapping. Retained `menu-mouse-events.json`
records only the Play launcher click at132/280, trusted DOWN/UP, all unlocked;
the final observation is `locked:false`. There was no trusted menu click or
pointerlockchange before the relative helper asserted. That helper requires
lock and rejects before sending any `Input.dispatchMouseEvent`.

Production explanation: `lib/apps.js` gives Redline no explicit relativeMouse
profile. `lib/browser-input.js` permits unlocked absolute move/hover/click;
pointer lock is requested only by a trusted down when exclusive presentation
and `wantsRelativeMouse` admit it. `lib/renderer-input.js` selects auto-relative
mode from a recentring loop or exclusive DirectInput capture hint. A software
cursor drawn in a screenshot does not establish that mode. Being unlocked is
an admitted menu state; the old run chose a helper requiring another state.
The retained evidence does **not** record the contemporaneous auto-relative
signals or a lock-request result. It cannot distinguish inactive detection,
an asynchronous/rejected acquisition, or a later mode change. No production
lock bug is established or patched. An eventual native menu consequence and
the guest's current auto-relative state remain unproved.

Offline validation runs the actual generated controller definitions, including
execute/send/capture/fail/close, with the actual numbered transport and mouse
helpers. CDP and owning-renderer services are explicitly inert; no top-level
browser startup runs. Twelve controls pass: old unlocked relative fails before
mouse dispatch; new unlocked absolute click emits MOVE/DOWN/UP and receives an
inert control ACK; locked absolute refuses; locked cursorOnly has zero CDP
displacement; locked relative remains supported; unlocked cursorOnly refuses;
invalid review/wait and terminal controls refuse; MOVE/DOWN/UP service failures
stay terminal. Failed DOWN still sends independent UP. Unlocked-to-locked and
locked-to-unlocked next commands use the current mode. Later failure cannot
replace first-browser-failure, and terminal input/capture/request probes emit
no later CDP. These are controller controls, not native application evidence.

Focused menu-selection, browser lock-gate, relative autodetection and latch
tests pass, as does `flock /tmp/wine-build.lock bash tools/build.sh`.
Fresh789 provider pins and nineteen SHA/size/gzip-CRC verified proof references
retain the unchanged final readiness and successful SystemExit0 guard, including
their previous actual generated delayed/never-ready/exit/failure/missing-file
and real subprocess0/7 controls. Git base plus small relevant diff and owned
input patch reverse-check; no source archive, media or module copies. Free
home stays above1.5GB.

No box/browser/guest allocation, agents/workers, deployment, or shared-client,
custody, Q2/Q3, host/WAT, HeroesII or Claude edits. Task box ID/state/expiry/stop:
**NOT_CREATED**. Prior1050 bx_zdh26cga, UUID1e82aeaf-4307-4c24-9261-ee19593e2763,
remains retained ARCHIVED/PHYSICAL_DRAINED, stop_5f822093e343645e completed
10:53:41.421Z, initial expiry11:15:48.766Z; it was not contacted. Native lifetime
REVOKED; all-writers/edict ABA UNKNOWN. Next, only if separately authorized:
fresh reviewed menu state and ordinary supported input, after required actual
fixture checks; stop on its first failure. No unchanged runtime retry occurred.
SingleTaskSTOP.

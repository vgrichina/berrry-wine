# AoWII persistent browser supervision, 2026-11-17

Evidence: `scratch/runs/20261117-aow2-persistent-supervisor-army-gameplay/`.
The preceding original's outer exit143 remains unexplained. Its missing waits
and EOFs are not reconstructed. Direct188/package191 native VariantInit controls
from a9e0421d7 remain the unchanged known input/module/package reference.

`tools/aow2-persistent-runtime.py` launches a detached keeper that owns and
actually waits for the supervisor. That supervisor directly launches Chrome
and its disposable controller separately; the controller connects through the
unique profile's endpoint. It does not own Chrome's lifetime. The inherited
thread-scoped parent-death signal is cleared before detachment. Caller exit
does not terminate the service. Parent TERM and explicit cancel retain the
cleanup path. Each owned process has separate draining stdout/stderr pipes,
an actual wait, EOF observations and byte counts. Linux subreaping records
adopted-child waits and checks both unique session scopes and remaining direct
children. Session identity is rechecked through a pinned pidfd before signals.

An independently detached deadline watchdog arms before Chrome, monitors the
supervisor's process pidfd and the actual 1,500,000,000-byte floor, and retains
an escalation path. It stays armed until native/controller waits, both EOFs
and empty owned sessions are observed. It is then cancelled and actually joined.
The keeper records the supervisor's actual wait and both EOFs. A browser close
request or ACK never supplies any native wait record.

Pipe Capture/identity primitives reuse `tools/boids-current-supervise.py`, as
used by the GLTron/HL2 d5259f9e5/b2118cb19 supervision chain. Browser ownership
is adapted to a direct Python child instead of the former Puppeteer-detached
browser. Testing found an actual empty `DevToolsActivePort` creation race;
startup now waits for its complete port/path rather than mere file existence.
Early failed test attempts and their actual terminal receipts are preserved.

The focused suite uses real Chrome and real CDP connections for normal exit,
controller failure, controller SIGKILL/client loss, parent TERM, deadline,
explicit cancel, two MiB on each controller pipe, and Chrome failure. The
short-lived launcher exits before each runtime finishes, exercising detached
custody across caller loss. Final results, locked canonical build and the
subsequent single registered original are recorded in the result JSON.

The original uses the unchanged known app, media, source and module controls
by hash. Git plus relevant binary diffs is the source archive; media remains
referenced at its existing path and hash. There is no media copy or repeated
inventory, and the unused compat module is not substituted for the proved
standard module. The final source sealing and gameplay limits follow below.

Published helper: `44115957ca39c919ae04e32268006811cc8e7c3c` on main.
Eight lifecycle cases passed across `lifecycle-qualified` and
`lifecycle-remaining`; after the final zero-child-exit guard, normal exit,
backlog and Chrome failure passed again in `lifecycle-terminal-guard`.
The subset runners' generic console sentence says eight; their proof JSON
correctly contains three cases each. The canonical locked build passed after
that guard. All 28 actual Chrome custody attempts (26 fixtures, one refused
preflight, one original) retain real terminal waits, both EOFs and empty scopes.
Early failed attempts are evidence, not successful test cases. A separate
fixture startup also exercised the watchdog's actual disk-floor response.

The preflight verified 1,055 known applicable hashes, including 435 previously
requested media references. Concurrent Sims changes were preserved: known text
inputs were sealed in memory by their expected SHA256, reconstructing changed
files from the exact prior Git plus recorded patch. This includes storage and
TypeLib source as well as the rendering worker; the earlier description of a
single overlay does not describe the final served source set. No game media
was copied. The actual main Worker instantiated standard module 87ef3964…,
2,399,439 bytes. Direct188/package191 controls were reused by exact hash.
Final offline body assessment passed 798 required responses with no first fault.

The first custody attempt refused changed storage bytes before browser
connection or guest launch. The subsequent sealed run launched the registered
original exactly once. Full shell review caught a delayed Notepad selection
before Launch; ordinary picker selection corrected it, and the 1280×900
viewport was restored and reviewed before Launch. The two short selection
helpers have actual process waits and both EOFs in the run directory.

Personally reviewed whole images witness the main menu, Scenario → Single,
Julia's scenario setup, the world opening dialog and Click to begin. The
selected Party then plotted and completed one ordinary move southeast of the
tower. Five units arrived and Party movement showed **14/20**; the hero remained
at the tower. `first-path.png` shows only a plotted path; `first-arrival.png`
shows the completed move. Mountains, forest and sprites are visible, while
black ground remains an unattributed rendering defect. No terrain parity claim.
The earlier lower-left 20/20 was not qualified as selected-army movement.

The independent 900-second deadline expired before a second move or Quit.
Chrome's actual wait was −15, driver's 124, supervisor's 143 and watchdog's 0;
every pipe reached EOF, with no remaining owned scopes or children. The
watchdog recorded `independent deadline`, fired true, without escalation.
These records establish browser/process cleanup, not native guest Quit.
Command 14 was queued after the deadline but never observed by the driver;
there is no key-delivery, Quit-menu or native-game-exit claim. The one original
is spent; no endpoint was reopened and no unchanged retry was made. The prior
original's exit143 cause remains UNKNOWN.

The requested two-move and ordinary Quit/native-exit acceptance remains
incomplete. Further runtime work requires renewed authorization; expiry of
this run is not a distinct new source fix. Own disposable Chrome profiles were
removed only after actual waits/EOFs and empty scopes. No box, worker or public
deployment was created. Final identities, cleanup, selected images and actual
receipts are indexed by the run's `result.json`.

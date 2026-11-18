# Quake II tmpfs attempt, 2026-11-18

Run: `scratch/runs/20261118-quake2-tmpfs-world-enemy-consequence/`.
**Living-enemy damage/defeat and ordinary Quit remain unproved.** The one
fresh original closed at 11:41:53.213 UTC before any guest DOWN. Only the
reviewed host fullscreen consent was delivered, with independent matching UP
and physical zero. No endpoint request, replay or second original followed
closure. The earlier accepted Game → Easy and four visible movements belong
to the previous run; its existing corpse remains uncredited.

## Old scope audit

The previous sealed run was examined offline only. All fourteen world gesture
commands explicitly declared `mode: play`; the operator selected 5,000 ms.
The four delivered world gestures had frame/request ages of 4353/4475,
4678/4765, 4403/4590 and 3739/3884 ms. The rejected world operations' text
incorrectly said “fixed30000ms.” That was a diagnostic defect, not evidence
that world inputs received menu deadlines. This run corrects the diagnostic
and requires explicit play/menu scope. No world scene was relabelled menu.

## Unchanged runtime and changed host storage

The served runtime is Git `f6962ba5b1cf2829a66f5cc4d80b293c30719b37`,
with module SHA-256
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`.
All 67 registered media/control inputs match before and after. Registry,
modern controls, GL arguments and the registered 10,000-block cooperative
schedule are unchanged. Optional independent child Debugger recovery was
omitted; executing-child module bytes/roles and physical GPU remain unknown.

The exact previous independent prepared release protocol was reused: ARM
acknowledgement before DOWN, 1,750 ms fallback and maximum 1,500 ms hold.
Disposable Chrome profile, cache, crashes and temporary files moved to a
private `/dev/shm/quake2-browser-*` directory. Raw XWD stayed in memory;
selected complete PNGs and metadata stayed on disk. Normal Puppeteer defaults
and explicit component-updater/background-networking disabling were retained.
The worker coordinated on the board and did not edit the tmpfs worker's helper
or canonical launchers. No pause-aware design, polling change, clock change,
forced focus, state/config/save/media edit or gameplay automation was added.

One native GL fixture checked the changed host path: personally reviewed
blue → red after trusted Enter, independent physical-zero releases, ordinary
Escape → native exit 0, actual child/Chrome/enclosing waits, and tmpfs removal.
The existing fixed 600-second/two-scope authored aggregate was preserved;
only one authored scope was used. Before launch the original retained its
180-second startup, 1,200-second total, irreversible 180-second Quit reserve
and 20-second cleanup limits. No timeout was enlarged.

## Precise closure cause

The first post-consent current-display request returned:

- `content: already-displayed`, publication 260;
- `rendererWorkAtRequest.writerHeld: true`;
- `retainedPublicationPixels: false`;
- requested 11:41:52.969, readback started 11:41:52.986 and completed
  11:41:53.023 UTC; displayed publication time 11:41:52.909 UTC.

The unchanged `verifyReadback` conservatively rejected this combination with
“ordinary publication completion, retained pixels or unheld display readback.”
The shared disk/admission record closed permanently on that assertion before
any guest input. The failure's `closed: false` describes the transport flag at
that instant; it does not override the durable shared admission closure.

Source inspection and production renderer tests identify the contract gap:
`serviceCurrentDisplayCapture` can finish an already displayed frame after
the writer releases, without another publication. Metadata retains writer
state **at request**, with no explicit clean-service completion receipt.
The operator therefore cannot distinguish that safe completion from the
combinations its extra metadata fence refuses. The production validator checks
the owner/output and unheld state around readback, but this run does not
retroactively admit the rejected frame or weaken that fence. A future repair
needs separately qualified completion evidence or pre-request readiness; it
was not validated on this original. This is a capture admission limitation,
not proof of broken combat or a game crash. There is no claimed local runtime
fix or completed enemy/Quit result.

## Checks, resource limits and cleanup

The locked build passed. The corrected controller protocol suite passed,
including replacement, UNKNOWN, independent release and freshness controls;
all 14 production capture/admission tests passed. The first controller test
invocation omitted required `QUAKE2_TEST_OUT` and failed before execution;
the initial progress update claiming it passed was corrected. Run-local scope
tests exercise the actual gesture body and corrected diagnostics.

The original driver and enclosing launcher exited 1, Chrome exited 0, native
supervisor exited 1 and watchdog exited 0. Actual waits and both pipe EOFs are
retained. The offline audit verifies 77 recorded runtime PIDs absent, 28
actual waits with both EOFs, nine PNGs decoded and four matching independent
physical-zero UP receipts. Supervision reports no leaks; private displays and both tmpfs
profiles were removed after their browser waits. These are host cleanup,
not ordinary Quake II Quit.

An independent finite disk guard overlapped the original and offline drain.
It measured **1,081,348,096 bytes** free on `/home` after original closure,
despite tmpfs browser state. Thus the required 1.5 GB floor was **not
maintained through drains**. The responsible concurrent writer is unknown;
no foreign cleanup was attempted. A second finite sampler overlaps final
offline sealing. Neither sampling nor later recovery erases that breach.

Evidence retains exact Git pins, relevant binary diffs, run-local operator
patch/seals, input hashes, selected screenshots, closure metadata and actual
waits. Git remains the source archive; no source snapshot or media copy was
made. `result.json` is published last after audits and final receipts.

Box ID null; state `NOT_CREATED`; expiry null; stop receipt null. No agents,
workers, boxes, Python, Wine reference run or deployment were created. Foreign
WIP, held game work and UT media/partials were preserved. Ownership is released
and this single-task worker stops with the original permanently closed.

# Hexen II browser preflight stopped before original, 2026-11-18

No original Hexen II runtime was launched. Living movement, visible enemy
combat consequence and ordinary Quit remain unproved. The required authored
dialog-to-GL and cleanup control did not qualify; continuing to the original
would have bypassed that prerequisite.

Evidence: `scratch/runs/20261118-hexen2-current-browser-live-combat/`.
The selected PNGs depict an authored fixture, **not Hexen II**.

## Immutable inputs and bounds

The runtime was served from published Git
`18c7f57eb26e3df51a6e8f1e35640cf8d91bf829` using the existing memory-only
Git reader. Shared runtime overlays were excluded. The compiled and retained
module is 2,418,470 bytes, SHA-256
`1504acf2ea5cac3ec3b8c627f4edc64c564e62ad37c06928f288bd8ae83b4f37`.
This is the compiled/served module identity; an executing Worker bytecode
capture was not reached, so the independently authenticated executing module
identity is unknown. No executing GL backend was qualified.

The registered original's manifest, its fourteen file references, root
`installed/glh2.exe`, and two registered control files were hashed without
modification (18 references). Original executable SHA-256 remains
`76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`.
The current registration seeds `HKLM\Software\Hexen2\Flag`, unlike the
November 7/12 startup attempts. That registration and the registered modern
controls were preserved; the real MessageBox prerequisite was tested in an
authored fixture instead of removing the original's flag.

The predeclared windows were startup 180 seconds; authored scope 300 seconds;
original 1,200 seconds including a 240-second Quit reserve; cleanup 20 seconds;
independent watchdog 20 seconds beyond each runtime cap. Capture was bounded
at 10 seconds, CDP at 15 seconds, review at 90 seconds, hold at 1,800 ms,
independent release fallback at 5 seconds. UNKNOWN closed the scope, with no
replay or later endpoint queries. The original window was never opened.

## Actual authored outcomes

The unique PE fixture uses the existing authored continuous native GL fixture,
adding a real blocking MessageBoxA before RegisterClass/CreateWindow/GL calls.
It runs through the normal production guest Worker and native presentation.
No runtime source prefix, scheduling/focus/clock change or synthetic success
was used. Browser screenshots are whole headful X11 display captures with
`defaultViewport:null`.

1. `calibration/startup.png` visibly shows the native notice and focused OK.
   One Enter DOWN was sent after whole-frame review. The independent release
   child armed, then its second PAGE_READ evaluation returned exceptionDetails
   before UP. It exited 1, with actual wait and both EOFs. The enclosing scope
   closed immediately and did not request another endpoint or replay Enter.
   **A balanced Enter is not proved.** The raw exceptionDetails were not
   retained; the precise thrown exception is unknown. The initial progress
   attribution to transient GL readiness was an inference: the reader does
   contain a GL readiness guard, but that does not establish which exception
   occurred. The transition and release were not qualified.
2. A proposed process-only reader failed its offline assertion that the GL
   guard had been removed. `calibration2` had already been launched by the
   shell sequence; it was cancelled by filesystem without guest input. This
   separate setup mistake is retained. The reader was corrected offline, but
   no closed scope was reused.
3. `calibration3/startup.png` and `calibration3/dialog-ready.png`, reviewed
   whole, show teal desktop without a visible notice, 12.058 seconds apart.
   Their saved before/after observations report the same live process,
   Worker, dialog window 65537, focus 65539 and publication sequence 5;
   no GL endpoint exists. Logical visibility is not visible presentation.
   No input was sent. The scope closed as presentation UNKNOWN, with no
   further runtime queries. These observations bound the failure but do not
   isolate a production cause or establish equivalence to the UT idle
   compositor issue being investigated separately.

The offline helper checks rejected replacement of ten process/document owner
fields and passed syntax checks. They do not qualify actual transition,
independent UP, backend, ordinary Quit, or gameplay. No runtime repair was
authored; no native/browser oldfail-newpass or locked-build pass is claimed.

## Cleanup and recovery

Each scope retained actual browser, Xvfb, Openbox, supervisor, launcher,
watchdog and enclosing invoker close waits with both output EOFs. All three
containment receipts report no leak; profiles and owned display resources
were removed. Browser host termination is cleanup, not ordinary guest Quit.
The board watcher also has an actual drained wait. No box was created:
box ID null, state NOT_CREATED, expiry null, stop receipt null.

Git remains the source archive. Runtime path hashes, relevant binary worktree
diff, media references, unique fixture/helpers, retained compiled module,
recovery instructions and verified artifact hashes are in the run. The final
result records missing executing module/backend identities explicitly. No
game media copies, source snapshots, frame series, guest analysis or patches,
config/registry/save patches, Wine, Python, agents, boxes or deployment were
used. Held BloodII work and foreign UT/AoW2/render overlays were preserved.

Next prerequisite: qualify visible real-dialog Enter through actual GL-owner
transition, independent matching release and ordinary Quit in a fresh authored
scope. The original gameplay attempt remains unopened.

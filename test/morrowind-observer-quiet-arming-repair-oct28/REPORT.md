# Morrowind quiet API observer arming repair

The optional Name observer was absent from the quiet API consumer predicate.
Its attachment enabled API logging, but the later production startup reset
disabled it when `--observe-morrowind-name --quiet-api` was the only consumer.
The one-line correction includes that flag in the existing consumer predicate.
Default-disabled quiet operation still disables API logging and attaches no
observer or EIP range. Ordinary API line suppression remains unchanged.

The unchanged independent rejection reproducer was first run against pinned
candidate `efa0f32e9dbe7fac2c863737810755473cb458c6`. Its exit 0 means a demonstrated
REJECTION, not acceptance. Its original report and output are preserved in the
canonical task archive; no rejection history was rewritten.

`arming-contract.js` exercises exact production predicate, attach and late-reset
source in that order using the pinned predecessor fixture scaffold. It covers
enabled/disabled × quiet/nonquiet, eight independent logging consumers with and
without the observer, paused trace with/without memory tracing, a mutation
removing the observer predicate, and an intentionally reversed-order control.
The mutation yields `[1,0]` and fails retained arming. Reversing startup order
yields `[0,1]`, demonstrating why an attach-after-reset test can hide this bug.
Disabled quiet hooks produce no observer records or ordinary API lines.

Run from a normal checkout under the task resource supervisor:

```
/usr/bin/node --max-old-space-size=320 \
  test/morrowind-observer-quiet-arming-repair-oct28/arming-contract.js \
  /READ_ONLY/installed/Morrowind.exe
```

The existing 32 source contracts and stale-HRESULT rejecting control were rerun
because the runner changed. Runner syntax and whitespace checks also pass.
Earlier source anchors/controls and transport evidence are reused unchanged.

This qualifies only the isolated source/CLI arming contract. It does not execute
the whole runner, initializers, WAT dispatch, canonical module or original guest.
The independent invocation/HRESULT/count, nested/unexpected API, device/thread/
target/generation/ESP, token/setter/ret0x10, overflow, read/sink-failure correlation
gate remains required. Separate source-matched module, whole-runner including
initializers and authorized gameplay qualification remain required afterward.
There is no established historical text-loss cause, arbitrary destruction/reuse
coverage or first arbitrary later-writer attribution. No runtime or Boat was
assigned; lifecycle ownership remains with the coordinator.

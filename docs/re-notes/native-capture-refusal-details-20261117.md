# Native capture refusal diagnostics

The original Half-Life 2 installer reached its subscriber-agreement page, then
capture refused `control.unsupportedClass` and `control.textUnavailable`. The
installed VB5 launch reached AxButton design-mode loading in its native trace,
but capture refused `focus.mainTopLevel` and `control.unsupportedClass`. Those
reports did not retain the specific offending control identities. Neither
report establishes the unsupported class or a later application dependency.

Native capture errors now include bounded HWND/class/reason entries for the
controls that fail admission, plus main/modal/focus HWNDs when context fails.
The USER snapshot adapter distinguishes missing text exports, password edits,
negative or excessive text length, null text pointers and out-of-memory spans.
Unknown reason strings and malformed identities are not echoed. Captions,
text bytes, executable paths and whole window rows are excluded.

The normal `captureFailures(snapshot)` result is unchanged. Only its optional
diagnostic form, used by the capture error, adds these fields. Refusal still
occurs before encoding or writing an image; supported classes, focus/actor
checks, capture and input deadlines are unchanged. No original endpoint is
reopened and no unsupported control is admitted by this change.

Evidence: `scratch/runs/20261117-coordinator-native-capture-refusal-details/`.
The focused diagnostic test checks unchanged refusal, absence of private text,
exact failing control/focus identity and all six snapshot text reasons. Existing
VB5 current-context, progress-review and dialog-identity unit tests also pass,
as does the locked canonical build. These are JavaScript unit/build results;
they are not a new native original run or evidence of usable IDE/gameplay.

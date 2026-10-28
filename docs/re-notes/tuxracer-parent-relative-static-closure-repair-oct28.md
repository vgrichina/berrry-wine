# Tux Racer parent-relative static candidates — 2026-10-28

Candidate repair based on `032f75ff582aa635ff78baf71febbd0e9a77bd78`
(production tool integrated at `ac4fdeb31c20d5bd869f201c9c051ad5bc663ca6`).
Original tool SHA-256: `567a716c33e97d9c8547a02c77ff10dc1839308afb45c3fe9848effb60a3134d`.

`literal_sources` previously classified every literal containing `..` as unknown,
even when its script-directory candidate was retained. It now normalizes each
root/script-directory candidate lexically with a component stack. A candidate
that attempts to escape the extraction root is discarded immediately. When all
candidates escape, the expression stays explicitly unknown with a reason; when
an in-root candidate exists lexically but none is in the inventory, the audit
rejects it as missing. Candidate lookup uses inventory names and never opens or
stats literal targets. Existing extraction symlink/path guards are unchanged.

Absolute, drive, backslash, computed/substitution and unsupported Tcl forms keep
their prior unknown behavior. In particular, `$tux_data_dir` is never inferred.
Lexical candidate presence does not establish runtime resolution: runtime CWD,
Tcl interpretation and runtime filesystem/symlink semantics remain unknown.

Eight focused tests passed once, invoking the exact changed production function
first. They cover existing and missing parent targets, nested normalization and
both candidate bases, root escape without target reads, absolute/drive/backslash
forms, computed expressions, non-following of an unlisted symlink, and a rejecting
mutation restoring the historical parent exclusion. The mutation silently makes
both existing and missing parent literals unknown; the test oracle rejects it.
Command: `python3 test/test-tuxracer-parent-relative-static-closure-repair-oct28.py`.

Only the changed `literal_sources` audit was run on the retained original
inventory/extraction. The six previously checked literals remain checked.
`courses/common/tux_moonwalk.tcl -> ../common/tux_walk.tcl` adds exactly one
checked candidate: `tuxracer-win32-0.61a/courses/common/tux_walk.tcl`.
Counts change from 6 checked / 2 unknown to 7 checked / 1 unknown. The remaining
unknown is `"$tux_data_dir/courses/common/courseinit.tcl"`.

Reuse the prior six-method integrated acceptance and real-original 158-file,
CRC and direct-import evidence by exact pins in
`/home/user/wine-assembly/scratch/usage-watch/tuxracer-integrated-original-media-validation-oct28/receipt.json`.
No archive hash/census, extraction or full recipe replay was performed here.
This is static candidate analysis only; dynamic Tcl, runtime and gameplay are
unqualified. Independent acceptance is required before integration.

Task-owned command/output, source/input pins, resource measurements, publication
and cleanup are bound by
`/tmp/tuxracer-parent-relative-static-closure-repair-oct28/receipt.json`.
The oversized shared messageboard is coordinator-owned for publication; use the
sibling `publication-note.txt`. No main push or runtime/Boat operation occurred.

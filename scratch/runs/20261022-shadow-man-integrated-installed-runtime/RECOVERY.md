# Recovery handoff

Task branch: task/shadow-man-integrated-installed-runtime-oct22.
Base: 58e90870a40a541a4083cae5e987ca8de31889e6. No main merge.

The precise failed selective command is in selective-recovery-plan.json.
Do not run it as a guest launch recipe. It names only the canonical primary
module in stopped bx_f3gs8qm2's snapshot; nevertheless the CLI stages compressed
snapshot layers in `<out>/.sandbox-snapshot-pull-tmp/`. Its second layer reached
16,777,216 bytes before any canonical module was recovered. The temporary mount
also had a hard aggregate 16 MiB ceiling. There is no complete compressed-size
receipt and no claim that increasing this particular allowance would succeed.

Coordinator must assign any next action. This completed worker authorizes no
retry, rebuild, other box resume, guest attempt or replacement task. Both boxes
remain stopped and coordinator-owned. No running lease or cleanup is outstanding.

Original installation remains remotely at
/home/user/shadow-man-install-quota-oct22/session/{parent-vfs,parent-registry.json}.
Immutable backups remain under /home/user/shadow-man-install-continue-oct22/
{retained-session,retained-game,retained-bounded-game}. They were never read or
modified in this task. Do not reuse historical module f644bbb or fabricate DX
metadata. Future runtime still requires the complete dependency, canonical-input,
compiler-fail-closed, registry-preservation, allocation and watchdog gates.

The accepted canonical build receipt is copied as accepted-canonical-result.json;
its source donor is named in REPORT.md. The old source manifest is only used to
plan the 158-path closure; integrated blob/mode identities are recorded in
planned-source-closure.json. No source/module/originals archive was created.

This is a sparse independent Git staging repository using a read-only alternate
to the integration donor object database. Preserve every base-tree index entry.
Commit only this task's evidence with write-tree --missing-ok / commit-tree
when unchanged sparse base blobs are unavailable. Never broad-fetch to fill
them, stage sparse deletions or mutate donor/root Git metadata. Actual remote
task SHA must be verified after push; a local commit alone is not a backup.

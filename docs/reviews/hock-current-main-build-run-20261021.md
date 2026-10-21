# Hock current-main validation blocked at runtime resume

On 2026-10-21 the documented `boat --json resume bx_wbavbhmg --no-wait`
returned HTTP 403, `api_key_action_forbidden`: `This API key cannot perform
sandbox.resume.` The CLI process itself exited zero; the JSON error is the
authoritative failure. No retry, SSH, alternate credential, runtime, or route
was attempted. User authorization did not override enforced API permissions.

Independent `git ls-remote` verified main
`a33939583068231aaa7c3fc5155b87f3ec85c07b` and census repair
`b3fce6f6fffcb83300397bcacc2691f1d6cb22da`. An isolated sparse repository was
created at that main after a 29,628,780-byte checkout projection. No census
repair or registration was applied, no production source was changed, and
no regression/control tests or canonical build ran in this attempt. This
commit preserves only the concrete runtime blocker and its evidence.

The prior census review and startup integration report were read. Their
producer-lifetime reconciliation remains outstanding: repair pins cover
4261fd93a, not current main. Do not treat the earlier 401-boundary success,
39-file package verification, or registration as current runtime acceptance.

Read-only Boat info after denial confirms bx_wbavbhmg remains stopped with
completed stop `stop_2782be7eee29e720`. Latest snapshot is still the completed
`b4ceda30-e2f7-4322-8642-6826c9856730`; its generation and completion timestamp
match the previous attempt. No runtime writes occurred, so no new snapshot
or stop was issued. Existing named snapshot `hock-original-runtime-20261021`
and `/home/user/hock-original-runtime` remain the recovery location.

Exact API responses and verified initial refs accompany this report in
`hock-current-main-build-run-20261021-evidence/`. The full task receipt and
dashboard record are under
`scratch/runs/20261021-hock-current-main-build-run/`. The previously recorded
TTL is 2026-10-21T06:27:05Z; this attempt never resumed the sandbox.

Completion requires the runtime owner/platform to grant this API credential
the documented resume action, followed by a fresh bounded assignment. Then
review actual startup lifetime deltas, reconcile the prerequisite with targeted
regressions and rejecting controls, apply registration 09a89489 separately,
stage exact source remotely and run canonical `bash tools/build.sh` without
bypasses. Only a successful build permits original package re-verification
and BBLOOGIE.EXE launch/capture. Module identity, screenshots, input, gameplay,
audio and playability are all unqualified in this attempt. Main, old denied
box bx_6czhvg6m, laptop and unrelated WIP were untouched.

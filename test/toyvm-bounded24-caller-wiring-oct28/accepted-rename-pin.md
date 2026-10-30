# Accepted rename-evidence caller pin (2026-10-30)

The source-owned `qualify_accounted.py` caller now accepts the independently
reviewed backend from `f40300ca8a982cee856547cfffe49c42a1ea30bf`:
`fuse_backend.py` SHA-256
`13bf42f071f5eb84542286f35faf2dc814aaf63bf1bcfe7bb306e3e2f7f4f963`.
It replaces `75842ffafd6ebd0c29fa2889a463bfd6f5245634096f4dfef9a3fd69f703e822`.
The base is acceptance commit `12adb51fabfd3bbd6b2ea92134b64f3b85bf1d8c`;
its backend, socket tests, and independent acceptance files remain unchanged.

Only that hash changes in the caller. All four transitive source checks remain
mandatory: adapter, confinement helper, backend, and pinned supervisor. The
adapter still executes the exact validated source buffer, ignoring bytecode and
later file replacement. Rename evidence remains disabled by default, and the
caller does not pass an opt-in argument.

The focused offline regression is:

```sh
python3 -B test/toyvm-bounded24-caller-wiring-oct28/test_accepted_rename_pin.py
```

Run it through the assigned task supervisor and admission/limit controls. The
tests load the real caller first, then use owned temporary source copies. Each
pinned file is independently altered: loading must identify that exact path and
reject before adapter compilation. Restoring each source and modifying an
unrelated decoy must allow loading. A valid poisoned bytecode cache is first
shown to execute through an ordinary loader; the production caller must ignore
it and execute its verified buffer even when the file changes after validation.
A minimal backend import/constructor checks that no rename evidence is allocated
or reported by default.

The remaining checks preserve browser/domain rejection, exact offline-receipt
identity, explicit bounded quotas/resources, fresh work directories, unchanged
dispatch arguments, and authoritative accounting/cleanup/result rejection.
Receipt validation is stubbed only in tests isolating later gates and synthetic
argument forwarding; those tests establish no live acceptance. The actual
wrong-receipt and browser-gate tests do not stub receipt validation.

The task also checked five in-memory loader mutants: removing each of the four
pins, and replacing verified-buffer execution with cached loading. Each was
rejected by its relevant regression. This distinguishes successful loading and
specific pin enforcement from an unconditional rejection.

No mount, guest, browser, Boat, or supervisor workload runs here. The completed
four socket groups and hook-removal acceptance are reused from the exact base;
this caller migration does not replay or extend that runtime qualification.
The existing receipt, browser allowance, confinement, cleanup, and resource
gates still apply. Main integration and any later runtime qualification belong
to the coordinator.

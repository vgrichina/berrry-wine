# MDK2 exact staged original: SSH prerequisite failure

The fresh assignment ended before entry staging or Chrome. Assigned
`bx_vt5pxud5` was running (API state `idle`), healthy and fully hydrated, but
SSH could not be verified. `boat ssh bx_vt5pxud5 ...` returned HTTP403,
`api_key_action_forbidden`, with `This API key cannot perform ssh.` A direct
connection to its advertised endpoint using the installed sandbox SSH key
reached the SSH service but returned `Permission denied (publickey)` for
`user`. No remote command executed. These observations establish an access
prerequisite failure; they do not establish the remote runtime's contents.

Evidence: `scratch/runs/20261104-mdk2-exact-staged-original/` (RUN).
`ssh-check.log`, `direct-ssh-check.log`, and the API observations preserve the
exact responses. No credential material is retained. There is no demonstrated
production defect to repair; changing entry code cannot grant SSH access.

The accepted staging tool at `31105b7ac65c529c2f8a20f69e2b4287d15afe92`
successfully prepared its small allowlisted input locally. Its26 focused tests
passed. The accepted construction entry at
`6d5121b5f96ee6032a9e347e2db64db29c478518` was not changed. Local controller
sources were generated through its existing offline `controllerSources`
function, and a fresh release was written with the exact assignment
`20261104-mdk2-bounded-trace-driver-repair`, authorization
`RUNTIME RELEASE MDK2 TARGET ONWARD`, exact absolute RUN path and
`shutdownOwner: coordinator`. No historical release or review was copied.
The original compressed manifest was decoded locally; its SHA256 remains
`4a8bb12508a5f6b402880a3af9532e28ca4bd7fc18fb94bd0ccaf6c9c3ceb4ed`.

Nothing was transferred. Remote `--stage`, `--check` and `--run` were never
invoked. Remote111-helper identities, observerde6, original1329 dependencies,
432disk/HTTP pins, cffc/580f modules, CJS/ESM/Puppeteer, isolation and no-store
remain unverified for this assignment. No current build or main source was
substituted. No browser, HTTP server, guest launch, input, execution slice,
construction quantum, trace, capture or native/file/main readback occurred.
There is no new native completion, Level creation, Lua or gameplay evidence.
Browser PID/HTTP/CDP closure is not applicable: none was started by this worker.

Hydration became true at `2026-11-04T16:39:52.086Z`. The final custody API
observation at approximately16:40Z confirmed healthy, hydrated, API-idle
`bx_vt5pxud5`, left RUNNING with expiry `2026-11-04T17:18:31.093Z`.
Custody was returned on the shared messageboard at16:40:39Z, before the17:05
handback limit. No further box access followed. The coordinator exclusively
owns snapshot and normal shutdown, scheduled by17:10Z. The closed parent
`bx_dj748qxr` was never accessed or resumed.

RUN records the exact preparation Git SHA, relevant binary diff, owned new-note
patch, input identities and a full SHA256/size seal. There are no source-tree,
scratch/docs/test-binary archives, media copies or execution-module copies.
No production code changed, so no build was required for this documentation
commit. Next is coordinator resolution of the SSH access prerequisite before
any separately authorized fresh attempt; this bounded assignment is terminal
and must not be resumed.

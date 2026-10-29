# Independent combined SIX acceptance

Decision: the exact published candidate 2566ab96e6a4f0f951435204f3972603ca1b8e77 passes this direct callback acceptance and may proceed to caller integration gates.

The unchanged pinned production Backend.handle was imported from its actual source, beginning with INIT. One live backend processed 53 interleaved requests: RENAME12/45 type and cycle rejections, nonempty replacement/removal, UNLINK/RMDIR type checks, CREATE/MKDIR collisions and invalid parents, moved directory and descendant READDIR parent invariants, rejected SETATTR flags with size requests, valid write/read/resize/shrink controls, replacement/removal/recreation and retained-open inode collection. Every rejection compares the complete backend state (including inode payload, children, links, opens, next inode, failure latch, live/peak and cumulative writes). Only the documented request counter advances. Direct exceptions require isinstance(OSError) and errno.

Six private temporary source mutants each remove one accepted family: rename type, rename cycle, removal type, resolved readdir parent, create parent, and setattr flags. Each is detected at the intended focused control. Mutants stop at first detection. Their compressed traces retain exact input, reply, errno and full before/after state. Production was byte-identical across all five prescribed pins before and after. Prior successful suites were provenance only; none was replayed.

Evidence: acceptance-results.json indexes seven compressed full traces. accept_six.py is the fresh harness. Run each baseline/mutant separately through the task's pinned supervisor under the unchanged admission and resource controls, with an explicit output path in private temporary storage. No subprocess is launched by the harness. Private mutants are written only beside that output, never into production.

This is direct wire-payload callback execution, not protocol transport, mounted FUSE, real CLI, browser or gameplay qualification. No runtime mount, Boat or deployment occurred. The separate newer RENAME-parent and selector lifetime repairs are deliberately excluded. Caller pins/integration, CLI confinement/lifecycle, mounted FUSE and browser acceptance remain separate gates. No test box was assigned; lifecycle ownership remains with the coordinator.

Previous blocked-report.json and closeout-pins.json predate this pinned relaunch and remain untouched, uncommitted historical local artifacts. The pinned relaunch results supersede that blocked status only for this task's fresh acceptance.

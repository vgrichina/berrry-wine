# Original LBreakout menu Enter completion, offline

Evidence: `scratch/runs/20261110-lbreakout-menu-consumption-0313/` (ignored).

The actual generated consumer now automatically gates ordinary Enter commands.
Arming requires the command ID, prior reviewed image SHA/label and an 80–300 ms
balanced pulse. The gate binds the immutable owning Worker/instance, original
EXE/SDL media and DLL lifecycle generation, and the currently selected original
submenu link. Unsupported Enter selections fail before input. The existing
explicit `completion:level-start` path remains required for starting gameplay.
The `080064edf` unobserved paddle/combined-play refusal and `b1dc83b64` paddle
observer are preserved.

## Compiled causal path

The original EXE manager calls `SDL_PollEvent` at `0x4105f1`; its return is
`0x4105f6`. A nonzero result supplies the event passed to `_menu_handle_event`
at `0x40c36a`, returning to `0x4107b2`. The handler checks event type 2 and
symbol 13, then its Enter branch at `0x40c4d6` dispatches selected item type 6
through `_menu_select` to the link target. `_cur_menu` is at `0x477150`.
This is queued event consumption, unlike the paddle's held-state poll.

The manager subsequently updates and draws the selected menu, calls
`_stk_display_update(1)` at `0x410844`, and returns at `0x410849`.
That original full display path calls `SDL_UpdateRect` at `0x426021`, returning
at `0x426026`. The new single-target observer follows SDL Enter down delivery
and return, the manager's polled Enter event, the exact menu/event/item/target
at handler entry, original handler return with the new menu, original SDL
display return, manager display return and released Enter. Only then may the
existing bounded page presentation and first screenshot occur. If release
arrives later, the observer follows original SDL keyup entry/return as well.
Instruction anchors are checked against the authentic loaded images.

The unchanged two-second bound includes completion and page presentation;
no instruction budget, clock, tier, shared renderer, startup or provider is
changed. The observer only reads guest state and uses the existing targeted
breakpoint driver. It never writes guest state or invokes guest routines.

## Controls and limits

The focused test executes original compiled SDL delivery and the original
Enter handler in the shipped interpreter with isolated offline event/menu
objects. A balanced Enter is already released when the original handler
selects its submenu. The boundary controls cover poll filtering, exact event
binding, handler transition, SDL/manager display ordering, release before and
after display, generation changes, incomplete work and sticky first failure.
The full generated caller is exercised through the real numbered transport
consumer with boundary service adapters: success, wrong command, module,
owner, prior image, incomplete work, observer error, presentation refusal,
unobserved paddle and combined-play refusal. Negative cases require no first
command image and reject all later key/capture/quit actions with zero protocol.
These adapters make no native image or gameplay claim.

Validation passed: 13 inspection tests, menu observer/original compiled-handler
controls, paddle/pause/level-start regressions and ten full generated consumer
controls. The required `flock /tmp/wine-build.lock bash tools/build.sh` passed;
the post-build original compiled-handler control passed again. The canonical
module remains `4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`.
The run records exact Git/source patches and media hashes without media copies
or source-tree archives.

The first isolated polling control returned -1 before event-loop initialization.
An attempted queue initialization did not return with a valid cdecl stack;
the exact initialization failure is unresolved. These development failures
are recorded in the run evidence. The final compiled control
uses an explicitly isolated SDL event object. The queue path is established
by original disassembly and boundary ordering controls, not a live queue run.
The previous native pixel-identical Enter result remains unexplained: this
offline repair closes an observed completion gap but does not retrospectively
establish whether that pulse was missed or its screenshot was premature.

No new box, browser, native attempt, guest operation or nested worker was
created. No lifecycle operation was performed. The predecessor's box
`bx_99yye6ek` remains reported archived with null expiry; its retained stop
receipt is `stop_0fe7d955ecbd44bb`, completed `2026-11-10T03:08:55.756Z`.
There is no box owned by this offline task. Next: a separately authorized
native attempt using this generated consumer, with individual image review
and immediate terminal cancellation on the first nonresponse.

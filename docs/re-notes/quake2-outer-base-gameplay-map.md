# Quake II Outer Base: gameplay map and frozen-CLI lessons

This note records the Outer Base route discovered by manually playing the
Quake II 3.14 demo through a frozen, headless CLI session. The map is based on
observed screenshots and traversed connections; it was not derived from the
BSP or from an online walkthrough.

The geometry is approximate, but the connections, pickups, dead ends, and
confirmed loops reflect the gameplay session. The furthest point reached was
the staging bay beyond the emblem door. The player died there before reaching
the next level.

## Map

```text
LEGEND
  @  furthest point reached
  X  dead end
  ↺  confirmed loop
  !  combat
  +  health or armor
  ║  door or gate


                           OUTER BASE

  ┌────────────────┐
  │ DROP-POD START │
  └───────┬────────┘
          ▼
  ┌────────────────┐
  │ ENTRY CONTROL  │
  └───────┬────────┘
          ▼
  ┌────────────────────────┐
  │ CRATE COURTYARD      ! │
  │ first guard killed     │
  └───────┬────────────────┘
          │ low breach
          ▼
  ┌────────────────────────┐
  │ MOSS LOWER ROOM        │
  │ corpse / item nook     │
  └───────┬────────────────┘
          │ ladder
          ▼
  ┌────────────────────────┐
  │ UPPER SHAFT ROOM       │◄─────────────────┐
  └───────┬────────────────┘                  │
          │ jump across shaft                 │
          ▼                                   │
  ┌────────────────────────┐                  │
  │ DARK CONNECTOR         │                  │
  └───────┬────────────────┘                  │
          ▼                                   │
  ┌────────────────────────┐                  │
  │ CRATE CHAMBER       !! │                  │
  │ small crate → big crate│                  │
  │ climb to balcony       │                  │
  └───────┬────────────────┘                  │
          ▼                                   │
  ┌────────────────────────┐                  │
  │ UPPER BALCONY          │                  │
  └───┬────────────┬───┘                  │
      │ right hall     │ moss/support edge    │
      ▼                ▼                      │
  ramp + cage      ┌──────────────────┐       │
      │             │ SERVICE CHAMBER │       │
      └────────────►│ / ROCK BREACH    │       │
        loop ↺      └────────┬─────────┘       │
                             │ boulder crawl   │
                             ▼                 │
                    ┌──────────────────┐       │
                    │ TUNNEL POCKET    │       │
                    │ "Crouch here"    │       │
                    └────────┬─────────┘       │
                             ▼                 │
                    ┌──────────────────┐       │
                    │ ARMOR CACHE    + │       │
                    │ Jacket Armor     │       │
                    └────────┬─────────┘       │
                             ▼                 │
                    ┌──────────────────┐       │
                    │ COLLAPSED        │       │
                    │ INDUSTRIAL ROOM  │       │
                    │ rubble climb     │       │
                    └────────┬─────────┘       │
                             ▼                 │
                    ┌──────────────────┐       │
                    │ SPARKING RIBBED  │       │
                    │ PASSAGE          │       │
                    └────────┬─────────┘       │
                             ▼
                 ┌───────────────────────────┐
                 │ ORANGE-PANEL COMBAT ROOM │
                 │ several guards       !!!!│
                 │ health + armor shards   +│
                 └─────┬──────────────┬──────┘
                       │              │
          raised red   │              │ moss threshold
          opening      ▼              ▼
               ┌─────────────┐   ┌───────────────────┐
               │ TINY OUTSIDE│   │ LONG RIBBED HALL │
               │ VISTA       │   └─────┬────────┬────┘
               │          X  │         │        │
               └─────────────┘         │        │ side window
                                       │        ▼
                                       │  ┌─────────────────┐
                                       │  │ SUPPORT         │
                                       │  │ COURTYARD       │
                                       │  │ sealed panel X  │
                                       │  └────────┬────────┘
                                       │           │ right ramp
                                       │           ▼
                                       │  ┌─────────────────┐
                                       │  │ UPPER CRATE     │
                                       │  │ SHELF           │
                                       │  └────────┬────────┘
                                       │           │
                                       │           └─────↺ returns to
                                       │                 combat room
                                       ▼
                              ┌───────────────────┐
                              │ EMBLEM EXIT DOOR │
                              │ use to open       │
                              └─────────╬─────────┘
                                        ▼
                              ┌───────────────────┐
                              │ LARGE STAGING BAY│
                              │ crates / stairs  │
                              │ upper red opening│
                              │ guard         !  │
                              │              @  │
                              └───────────────────┘

                         Furthest reach: staging bay
                         Result: killed by doorway guard
                         Next level not reached yet
```

## Lessons learned

### Use real held input

`tools/ctl.js key 87 down` does not hold W. The `key` verb emits a complete
keydown/keyup tap and ignores the apparent `down` suffix. Genuine held input
for a frozen session must be injected explicitly around the stepped interval:

```bash
node tools/ctl.js -s :8152 eval "renderer.handleKeyDown(87)"
node tools/ctl.js -s :8152 step 60 8
node tools/ctl.js -s :8152 eval "renderer.handleKeyUp(87)"
```

The ineffective pseudo-holds accounted for much of the early slow and
apparently aimless movement.

### Size time slices according to risk

Useful starting ranges for an 8 ms frozen tick are:

- 60--100 steps while traversing a cleared corridor.
- 15--30 steps while entering an unknown room.
- 8--20 steps between observations after an enemy becomes visible.
- One very short slice after operating a door, because enemies can act during
  its opening animation.

The emblem door was operated and then allowed to advance for 100 steps. That
gave the staging-bay guard enough guest time to inflict severe damage before
the next screenshot.

### Release held controls after a timeout

Some long `step` requests exceed the control client's 30-second wall-clock
window while the server continues the step. If that happens, send the matching
keyup immediately, poll until the in-flight step completes, and only then take
the next action. Otherwise movement can continue unintentionally during later
guest steps.

### Upgrade from the starting blaster

Several guards dropped stronger weapons, but the run continued with the
starting blaster. Its slow projectiles made each encounter long and allowed
guards to close the distance. A retry should collect the first useful dropped
gun and its ammunition before proceeding.

### Align pitch before firing

In this configuration Page Down raises the view and Delete lowers it. Early
shots repeatedly struck the floor because pitch was too low. Aim should be
corrected horizontally and vertically before holding attack; a longer burst
does not compensate for the wrong trajectory.

### Use doorway geometry as cover

Unknown doors should be opened from an offset position. Expose only enough of
the next room to locate a target, then retreat behind the jamb between shots.
Standing in the center of the emblem doorway allowed the staging-bay guard to
advance into the ribbed hall and flank at close range.

### Save at milestones

No manual save existed when the player died, so only the automatic
`ENTERING Outer Base` save was available. Create and verify manual saves after
major milestones:

1. Acquiring a stronger weapon.
2. Collecting Jacket Armor.
3. Clearing the orange-panel combat room.
4. Immediately before operating the emblem door.

### Track branch state explicitly

The upper-shaft cage and exterior courtyard consumed time after they had
effectively closed loops. Maintain a small state for every junction:

```text
[ ] unexplored
[→] likely continuation
[↺] confirmed loop
[X] dead end
[+] useful pickup
```

Corpses also blocked several apparently open thresholds. Before declaring a
door locked, retry from a lateral offset.

### Separate exploration from execution

The first run established topology. The next run should use the shortest known
route, collect only strategically valuable pickups, and avoid revisiting
confirmed loops or dead ends.

## Improved retry playbook

```text
follow known route
      │
      ├─ collect first stronger dropped weapon
      ├─ collect Jacket Armor
      ├─ collect both known health packs and armor shards
      ├─ clear orange-panel room from doorway cover
      ├─ create and verify manual save
      ├─ approach emblem door from an offset
      ├─ use door, then step only 8--20 ticks
      ├─ kill staging-bay guard from behind jamb
      ├─ save again
      └─ continue toward the next-level transition
```

During combat, each observation should record current health, armor, target
bearing, visible projectile direction, and cover position. This makes the next
command a direct reaction to the latest frame rather than a long speculative
sequence.

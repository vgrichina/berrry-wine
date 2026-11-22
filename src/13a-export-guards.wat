  ;; ============================================================
  ;; EXPORT GUARDS: store stepping owns guest memory
  ;; ============================================================
  ;;
  ;; A research controller sets $rep_store_step (07-decoder.wat,
  ;; set_rep_store_step) and then executes guest writes one store at a time,
  ;; recording which instruction wrote which byte first (tools/pawn-store-
  ;; observer.cjs). That record is only true if nothing else writes guest
  ;; memory while the mode is on. The interpreter refuses its own
  ;; uninterruptible paths (API thunks, APCs, timers, wave callbacks) with
  ;; `unreachable`; this closes the other door, JavaScript calling in.
  ;;
  ;; Every function export gets the prologue below, on a compiler-generated
  ;; wrapper (WATX export-wrap): internal calls still reach the original
  ;; directly. `(all)` is default-deny -- an export added anywhere, later, is
  ;; guarded without anyone remembering to. The exceptions:
  ;;
  ;;   (pure)              inferred by the compiler from the body: only reads,
  ;;                       constants and arithmetic -- it cannot change anything
  ;;   run                 keeps stepping (one store per call)
  ;;   set_rep_store_step  turns the mode off
  ;;   guest_read8/32      bounded direct-window reads (13-exports.wat)
  ;;
  ;; build/watx-facts.json lists every export with the wrappers applied to it.
  (export-wrap
    (match (and (all)
                (not (pure))
                (not (name "run" "set_rep_store_step" "guest_read8" "guest_read32"))))
    (prologue
      (if (global.get $rep_store_step)
        (then (unreachable)))))

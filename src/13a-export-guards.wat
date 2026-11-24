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
  ;; Every function export gets the advice below, on a compiler-generated
  ;; wrapper (WATX `advise ... (at export)`): internal calls still reach the
  ;; original directly. `(export)` is default-deny -- an export added anywhere,
  ;; later, is guarded without anyone remembering to. The exceptions:
  ;;
  ;;   (pure)              inferred by the compiler from the body: only reads,
  ;;                       constants and arithmetic -- it cannot change anything
  ;;   (no-advise "store-step") on the function itself, with its reason:
  ;;                       run (13-exports.wat), set_rep_store_step
  ;;                       (07-decoder.wat), guest_read8/32 (13-exports.wat)
  ;;
  ;; build/watx-facts.json lists every function's advice chain (advice.chains)
  ;; and, per export, the advice applied to it (exports[].advice).
  (advise "store-step"
    (match (and (export) (not (pure))))
    (at export)
    :before
      (if (global.get $rep_store_step)
        (then (unreachable))))

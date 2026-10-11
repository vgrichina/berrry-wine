  ;; ============================================================
  ;; REGISTER ACCESS
  ;; ============================================================
  ;; The eight GPRs are slots of a per-thread register file in linear memory
  ;; (see $REGFILE / $reg_base in 01-header.wat), so an indexed access is a
  ;; single load or store — no call, no br_table, no data-dependent branch.
  ;; Every former `call $get_reg` / `call $set_reg` site is rewritten to
  ;; exactly the expressions below by tools/regarray-transform.js; these two
  ;; functions are kept as the readable definition of the encoding.
  (func $get_reg (param $r i32) (result i32)
    (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $r) (i32.const 2))))
  )

  (func $set_reg (param $r i32) (param $v i32)
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $r) (i32.const 2))) (local.get $v))
  )

  ;; Get byte register value (0-3=al/cl/dl/bl, 4-7=ah/ch/dh/bh)
  ;; AL..BH are BYTES INSIDE the dword slots, and linear memory is little-endian,
  ;; so the low byte of register r is byte 0 of slot r, and a high byte (AH..BH,
  ;; r >= 4) is byte 1 of slot r-4. Both cases are the one address
  ;;     ((r & 3) << 2) + (r >> 2)
  ;; with no branch. This is only expressible because the registers are memory:
  ;; a wasm global has no byte address, which is why this used to be a branch
  ;; over two shift-and-mask arms.
  (func $reg8_addr (param $r i32) (result i32)
    (i32.add (global.get $reg_base)
      (i32.add (i32.shl (i32.and (local.get $r) (i32.const 3)) (i32.const 2))
               (i32.shr_u (local.get $r) (i32.const 2)))))
  (func $get_reg8 (param $r i32) (result i32)
    (i32.load8_u (call $reg8_addr (local.get $r)))
  )

  ;; Set byte register (preserves other bits)
  ;; ONE byte store. The read-modify-write this replaces (load, mask, or, store)
  ;; existed only because a global can be written whole or not at all -- it was
  ;; never about x86 semantics. i32.store8 already takes the low 8 bits of $v.
  ;; Safe on the shared memory: each guest thread owns its own $REGFILE stride,
  ;; so no other thread can be reading the dword this partially writes.
  (func $set_reg8 (param $r i32) (param $v i32)
    (i32.store8 (call $reg8_addr (local.get $r)) (local.get $v))
  )

  ;; Get/set 16-bit register
  ;; AX..DI are the low half of their slot, so a 16-bit read is one load16_u and
  ;; a 16-bit write is one store16 -- again a read-modify-write that only ever
  ;; existed because the register was a global.
  (func $get_reg16 (param $r i32) (result i32)
    (i32.load16_u (i32.add (global.get $reg_base) (i32.shl (local.get $r) (i32.const 2))))
  )
  (func $set_reg16 (param $r i32) (param $v i32)
    (i32.store16 (i32.add (global.get $reg_base) (i32.shl (local.get $r) (i32.const 2))) (local.get $v))
  )

  ;; ============================================================
  ;; GUEST MEMORY
  ;; ============================================================
  ;; Null sentinel: a 4-byte region at offset 0xF0 that stays zeroed.
  ;; Used as g2w fallback so reads from invalid guest addresses see zeros
  ;; (simulating Windows null-page behavior) and writes go to a harmless sink.
  (global $NULL_SENTINEL i32 (i32.const 0xF0))

  ;; Win98 private-page protections accepted by VirtualAlloc/VirtualProtect.
  ;; PAGE_WRITECOPY variants apply to mapped views, and PAGE_WRITECOMBINE did
  ;; not exist on the target OS. PAGE_GUARD/PAGE_NOCACHE are mutually exclusive
  ;; and neither may modify PAGE_NOACCESS.
  (func $guest_page_protection_valid (param $protect i32) (result i32)
    (local $base i32) (local $modifier i32)
    (if (i32.ne
          (i32.and (local.get $protect)
            (i32.xor (global.get $GUEST_PTE_PROTECT_MASK) (i32.const -1)))
          (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $base (i32.and (local.get $protect) (i32.const 0xFF)))
    (if (i32.eqz
          (i32.or
            (i32.or (i32.eq (local.get $base) (i32.const 0x01))
                    (i32.eq (local.get $base) (i32.const 0x02)))
            (i32.or
              (i32.or (i32.eq (local.get $base) (i32.const 0x04))
                      (i32.eq (local.get $base) (i32.const 0x10)))
              (i32.or (i32.eq (local.get $base) (i32.const 0x20))
                      (i32.eq (local.get $base) (i32.const 0x40))))))
      (then (return (i32.const 0))))
    (local.set $modifier (i32.and (local.get $protect) (i32.const 0x700)))
    (if (i32.ne (i32.and (local.get $modifier) (i32.const 0x400)) (i32.const 0))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $modifier) (i32.const 0x300))
      (then (return (i32.const 0))))
    (if (i32.and
          (i32.eq (local.get $base) (i32.const 0x01))
          (i32.ne (local.get $modifier) (i32.const 0)))
      (then (return (i32.const 0))))
    (i32.const 1))

  ;; Publish an affine, page-aligned guest-to-WASM range into packed PTEs.
  ;; Low bits retain the caller's validated PAGE_* value verbatim.
  (func $guest_page_publish_range
    (param $guest i32) (param $size i32) (param $backing i32)
      (param $protect i32) (result i32)
    (local $cur i32) (local $end i32) (local $back i32) (local $old i32)
    (if (i32.or
          (i32.or
            (i32.ne (i32.and (local.get $guest) (i32.const 0xFFF)) (i32.const 0))
            (i32.ne (i32.and (local.get $backing) (i32.const 0xFFF)) (i32.const 0)))
          (i32.ne (i32.and (local.get $size) (i32.const 0xFFF)) (i32.const 0)))
      (then (return (i32.const 0))))
    (if (i32.eqz (local.get $size)) (then (return (i32.const 1))))
    (local.set $end (i32.add (local.get $guest) (local.get $size)))
    (if (i32.lt_u (local.get $end) (local.get $guest))
      (then (return (i32.const 0))))
    (local.set $cur (local.get $guest))
    (local.set $back (local.get $backing))
    (block $done (loop $pages
      (br_if $done (i32.ge_u (local.get $cur) (local.get $end)))
      (local.set $old (i32.or (local.get $old) (i32.atomic.rmw.xchg
        (i32.add (global.get $GUEST_PAGE_TABLE)
          (i32.and (i32.shr_u (local.get $cur) (i32.const 10))
            (i32.const 0x003FFFFC)))
        (i32.or (i32.and (local.get $back) (i32.const 0xFFFFF000))
          (i32.or
            (i32.and (local.get $protect) (global.get $GUEST_PTE_PROTECT_MASK))
            (global.get $GUEST_PTE_PRESENT))))))
      (local.set $cur (i32.add (local.get $cur) (i32.const 0x1000)))
      (local.set $back (i32.add (local.get $back) (i32.const 0x1000)))
      (br $pages)))
    ;; A uop window (07d) proved over a page that was already present may now
    ;; name the wrong backing; one over pages that were absent cannot exist.
    ;; After the stores, so no window can be proved against the old entries
    ;; under the new epoch.
    (if (i32.and (local.get $old) (global.get $GUEST_PTE_PRESENT))
      (then (call $uop_win_bump)))
    (i32.const 1))

  (func $guest_page_clear_range (param $guest i32) (param $size i32)
    (local $cur i32) (local $end i32) (local $old i32)
    (local.set $end (i32.add (local.get $guest) (local.get $size)))
    (if (i32.lt_u (local.get $end) (local.get $guest)) (then (return)))
    (local.set $cur (local.get $guest))
    (block $done (loop $pages
      (br_if $done (i32.ge_u (local.get $cur) (local.get $end)))
      (local.set $old (i32.or (local.get $old) (i32.atomic.rmw.xchg
        (i32.add (global.get $GUEST_PAGE_TABLE)
          (i32.and (i32.shr_u (local.get $cur) (i32.const 10))
            (i32.const 0x003FFFFC)))
        (i32.const 0))))
      (local.set $cur (i32.add (local.get $cur) (i32.const 0x1000)))
      (br $pages)))
    ;; as above: a uop window over a page that just went away is stale
    (if (i32.and (local.get $old) (global.get $GUEST_PTE_PRESENT))
      (then (call $uop_win_bump))))

  ;; Change PAGE_* on a page-rounded committed range. The caller holds
  ;; LOCK_VIRTUAL_MAP, so the validation pass and update pass are atomic with
  ;; respect to commit/release. Return -1 without changing anything if a page
  ;; is missing; otherwise return the first page's previous protection.
  (func $guest_page_protect_range
      (param $guest i32) (param $size i32) (param $protect i32) (result i32)
    (local $base i32) (local $raw_end i32) (local $end i32) (local $cur i32)
    (local $cell i32) (local $pte i32) (local $old i32)
    (local.set $base (i32.and (local.get $guest) (i32.const 0xFFFFF000)))
    (local.set $raw_end (i32.add (local.get $guest) (local.get $size)))
    (if (i32.or
          (i32.le_u (local.get $raw_end) (local.get $guest))
          (i32.gt_u (local.get $raw_end) (i32.const 0xFFFFF000)))
      (then (return (i32.const -1))))
    (local.set $end
      (i32.and (i32.add (local.get $raw_end) (i32.const 0xFFF))
        (i32.const 0xFFFFF000)))
    (local.set $cur (local.get $base))
    (block $checked (loop $check
      (br_if $checked (i32.ge_u (local.get $cur) (local.get $end)))
      (local.set $cell
        (i32.add (global.get $GUEST_PAGE_TABLE)
          (i32.and (i32.shr_u (local.get $cur) (i32.const 10))
            (i32.const 0x003FFFFC))))
      (local.set $pte (i32.atomic.load (local.get $cell)))
      (if (i32.eqz (i32.and (local.get $pte) (global.get $GUEST_PTE_PRESENT)))
        (then (return (i32.const -1))))
      (if (i32.eq (local.get $cur) (local.get $base))
        (then (local.set $old
          (i32.and (local.get $pte) (global.get $GUEST_PTE_PROTECT_MASK)))))
      (local.set $cur (i32.add (local.get $cur) (i32.const 0x1000)))
      (br $check)))
    (local.set $cur (local.get $base))
    (block $updated (loop $update
      (br_if $updated (i32.ge_u (local.get $cur) (local.get $end)))
      (local.set $cell
        (i32.add (global.get $GUEST_PAGE_TABLE)
          (i32.and (i32.shr_u (local.get $cur) (i32.const 10))
            (i32.const 0x003FFFFC))))
      (local.set $pte (i32.atomic.load (local.get $cell)))
      (i32.atomic.store (local.get $cell)
        (i32.or
          (i32.and (local.get $pte) (i32.const 0xFFFFF800))
          (i32.and (local.get $protect) (global.get $GUEST_PTE_PROTECT_MASK))))
      (local.set $cur (i32.add (local.get $cur) (i32.const 0x1000)))
      (br $update)))
    (local.get $old))

  (func $guest_page_translate (param $ga i32) (result i32)
    (local $pte i32)
    (local.set $pte
      (i32.atomic.load
        (i32.add (global.get $GUEST_PAGE_TABLE)
          (i32.and (i32.shr_u (local.get $ga) (i32.const 10))
            (i32.const 0x003FFFFC)))))
    (if (i32.eqz (i32.and (local.get $pte) (global.get $GUEST_PTE_PRESENT)))
      (then (return (global.get $NULL_SENTINEL))))
    (i32.or
      (i32.and (local.get $pte) (i32.const 0xFFFFF000))
      (i32.and (local.get $ga) (i32.const 0xFFF))))

  ;; Resolve a complete sparse span only when every crossed guest page maps to
  ;; the corresponding contiguous backing page. Checking merely the two ends
  ;; would accept a hole or a differently backed middle page; checking each
  ;; page boundary proves the affine range that bulk string/loop helpers need.
  ;; Why the last failing call failed, for --uop-win-census (07d $uwc_*):
  ;; 1 first page unmapped, 2 wrapped end, 3 a later page unmapped, 4 a later
  ;; page mapped but not backed next to its predecessor. Written only on the
  ;; failure returns, so a successful span pays nothing for it.
  (global $gpas_why (mut i32) (i32.const 0))
  (func $guest_page_affine_span (param $ga i32) (param $len i32) (result i32)
    (local $start_wa i32) (local $cur_wa i32)
    (local $end i32) (local $cur i32)
    (local.set $start_wa (call $guest_page_translate (local.get $ga)))
    (if (i32.eq (local.get $start_wa) (global.get $NULL_SENTINEL))
      (then (global.set $gpas_why (i32.const 1))
            (return (global.get $NULL_SENTINEL))))
    (if (i32.eqz (local.get $len)) (then (return (local.get $start_wa))))
    (local.set $end (i32.add (local.get $ga) (local.get $len)))
    (if (i32.le_u (local.get $end) (local.get $ga))
      (then (global.set $gpas_why (i32.const 2))
            (return (global.get $NULL_SENTINEL))))
    (local.set $cur
      (i32.add (i32.or (local.get $ga) (i32.const 0xFFF)) (i32.const 1)))
    (block $done (loop $pages
      (br_if $done (i32.ge_u (local.get $cur) (local.get $end)))
      (local.set $cur_wa (call $guest_page_translate (local.get $cur)))
      (if (i32.ne (local.get $cur_wa)
            (i32.add (local.get $start_wa)
              (i32.sub (local.get $cur) (local.get $ga))))
        (then
          (global.set $gpas_why
            (select (i32.const 3) (i32.const 4)
              (i32.eq (local.get $cur_wa) (global.get $NULL_SENTINEL))))
          (return (global.get $NULL_SENTINEL))))
      (local.set $cur (i32.add (local.get $cur) (i32.const 0x1000)))
      (br $pages)))
    (local.get $start_wa))

  (func $g2w_miss (param $ga i32) (result i32)
    (local $wa i32)
    ;; Mode 5: Windows' rule for reserved memory, and nothing else. A
    ;; read of a MEM_RESERVE page that was never committed is an access
    ;; violation, and an engine may commit the page from its own exception
    ;; filter and continue (Serious Sam's CTStream::ExceptionFilter maps
    ;; stream buffers this way). The filter chain runs synchronously from
    ;; here, so the faulting instruction simply completes against the page
    ;; the filter committed: no precise faulting EIP is needed to resume.
    (if (i32.eq (global.get $fault_unmapped) (i32.const 5))
      (then
        (if (i32.and
              (i32.and (i32.ge_u (local.get $ga) (i32.const 0x10000))
                       (i32.eqz (global.get $fault_raising)))
              (i32.and (i32.eqz (global.get $api_handler_depth))
                       (call $virtual_reserved_contains (local.get $ga))))
          (then
            (if (call $seh_fault_sync (local.get $ga))
              (then
                (local.set $wa (call $guest_page_translate (local.get $ga)))
                (if (i32.ne (local.get $wa) (global.get $NULL_SENTINEL))
                  (then (return (local.get $wa))))))))
        ;; A reserved page still uncommitted here -- no handler committed it,
        ;; or the access came from inside an API handler or another raise --
        ;; reads zeros and loses writes, which the guest cannot see. Name it in
        ;; the per-EIP census so the loss is visible.
        (if (i32.ge_u (local.get $ga) (i32.const 0x10000))
          (then (if (call $virtual_reserved_contains (local.get $ga))
            (then (call $host_unmapped_trace (local.get $ga) (global.get $eip))))))
        ;; Every other miss keeps the quiet sentinel, as with no mode at all.
        (i32.store (global.get $NULL_SENTINEL) (i32.const 0))
        (return (global.get $NULL_SENTINEL))))
    ;; Mode 4: Win98's own rule. Only the 4KB guard page at 0 faults; the rest
    ;; of low memory is the readable DOS/Win16 arena, so everything above it
    ;; keeps the quiet sentinel. Dark Reign's debug allocator walks the EBP
    ;; chain to record a call stack and stops only when reading the outermost
    ;; frame (saved EBP 0, so [4]) faults into its __except; on the sentinel it
    ;; read zeros and walked forever.
    (if (i32.eq (global.get $fault_unmapped) (i32.const 4))
      (then
        (if (i32.and (i32.lt_u (local.get $ga) (i32.const 0x1000))
                     (i32.and (i32.eqz (global.get $fault_raising))
                              (i32.eqz (global.get $api_handler_depth))))
          (then
            (global.set $fault_address (local.get $ga))
            (call $raise_exception (i32.const 0xC0000005))))
        (i32.store (global.get $NULL_SENTINEL) (i32.const 0))
        (return (global.get $NULL_SENTINEL))))
    (if (global.get $fault_unmapped)
      (then
        (call $host_unmapped_trace (local.get $ga) (global.get $eip))
        (if (i32.eq (global.get $fault_unmapped) (i32.const 2))
          (then (unreachable)))
        ;; Mode 3: what the hardware does. The sentinel keeps a guest that
        ;; dereferences NULL alive -- reads answer 0, writes go nowhere -- which
        ;; is why a corrupted pointer surfaces thousands of instructions from
        ;; where it was made, and why a list walk that should have taken an
        ;; access violation on its first step instead runs forever. Raising
        ;; hands the fault to the guest's own __except, or to the unhandled-
        ;; exception path, at the instruction that caused it.
        ;;
        ;; The sentinel is still returned: the faulting op completes against
        ;; four bytes of scratch rather than being unwound mid-instruction, so
        ;; one register may take a garbage value before control reaches the
        ;; handler. $eip is already the handler's by then, and $eip_redirected
        ;; stops $run resuming the abandoned block.
        (if (i32.and (i32.eq (global.get $fault_unmapped) (i32.const 3))
                     (i32.eqz (global.get $fault_raising)))
          (then
            (global.set $fault_address (local.get $ga))
            (call $raise_exception (i32.const 0xC0000005))))))
    (i32.store (global.get $NULL_SENTINEL) (i32.const 0))
    (global.get $NULL_SENTINEL))

  ;; $g2w's direct-window fast path, expanded in place at a hot call site so
  ;; the common translation is an add, a subtract and one compare instead of a
  ;; call. SpiderMonkey Ion inlines no wasm call at all, so every `call $g2w`
  ;; is a real `bl` with a frame and a stack check there; V8 inlines $g2w at
  ;; some sites and not others (docs/accessor-fastpath-split.md).
  ;;
  ;; The caller declares `(local $g2w_wa i32)`; the compiler refuses an
  ;; undeclared local, so a site that forgets it does not build. $GA appears
  ;; exactly once and is evaluated before anything else, so an argument with
  ;; side effects, or one that itself expands this macro, is safe.
  ;;
  ;; One unsigned compare is exactly the old two-compare test. The old test
  ;; accepted wa iff (wa >=s 0) and (wa <u END), END = region.end
  ;; $DIRECT_WINDOW = 0x08000000. Any wa with wa <u END has bit 31 clear
  ;; (END <= 0x80000000), so it is also >=s 0: the signed test is implied and
  ;; the conjunction is just wa <u END. Both forms compute wa with the same
  ;; mod-2^32 arithmetic, so wraparound in (ga - image_base + GUEST_BASE)
  ;; lands on the same bit pattern either way. test/test-g2w-fast-macro.js
  ;; pins the bound and checks the two against each other at the edges.
  ;;
  ;; The miss hands $g2w_slow the guest address rebuilt from wa, the exact
  ;; mod-2^32 inverse, so $GA is not evaluated a second time and no second
  ;; local is needed.
  (defmacro (g2w-fast $GA)
    (block (result i32)
      (local.set $g2w_wa
        (i32.add (i32.sub $GA (global.get $image_base)) (global.get $GUEST_BASE)))
      (if (result i32) (i32.lt_u (local.get $g2w_wa) (region.end $DIRECT_WINDOW))
        (then (local.get $g2w_wa))
        (else (call $g2w_slow
          (i32.add (i32.sub (local.get $g2w_wa) (global.get $GUEST_BASE))
                   (global.get $image_base)))))))

  (func $g2w (param $ga i32) (result i32)
    (local $g2w_wa i32)
    (g2w-fast (local.get $ga)))

  ;; Everything $g2w does once the direct window has missed. Only the
  ;; g2w-fast macro calls it; a direct-window address passed here would be
  ;; mistranslated, since this never tests that window.
  (func $g2w_slow (param $ga i32) (result i32)
    (local $wa i32)
    ;; CreateDIBSection pointers live in a dedicated high guest range backed by
    ;; the final 64MB of linear memory. Test it only after the normal direct
    ;; window misses so ordinary loads retain their original hot path.
    (if (i32.lt_u
          (i32.sub (local.get $ga) (global.get $DIB_GUEST_BASE))
          (global.get $DIB_GUEST_CAPACITY))
      (then
        (if (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 4)) (then
          (call $d3dim_lazy_access
            (i32.add (global.get $DIB_BACKING_BASE)
              (i32.sub (local.get $ga) (global.get $DIB_GUEST_BASE))) (i32.const 1))))
        (return (i32.add
          (global.get $DIB_BACKING_BASE)
          (i32.sub (local.get $ga) (global.get $DIB_GUEST_BASE))))))
    ;; Sparse VirtualAlloc mappings use the flat PTE table. A missing entry is
    ;; authoritative: VIRTUAL_MAP_TABLE remains allocation/query metadata and
    ;; is never a second translation mechanism.
    (local.set $wa (call $guest_page_translate (local.get $ga)))
    (if (i32.ne (local.get $wa) (global.get $NULL_SENTINEL))
      (then (return (local.get $wa))))
    (call $g2w_miss (local.get $ga))
  )

  ;; Would $g2w resolve $ga? The same three lookups with no miss side effect,
  ;; for a handler that has to decide whether an access faults before making it.
  (func $guest_addr_mapped (param $ga i32) (result i32)
    (local $wa i32)
    (local.set $wa (i32.add (i32.sub (local.get $ga) (global.get $image_base)) (global.get $GUEST_BASE)))
    (if (i32.eqz (i32.or (i32.lt_s (local.get $wa) (i32.const 0))
                (i32.ge_u (local.get $wa) (region.end $DIRECT_WINDOW))))
      (then (return (i32.const 1))))
    (if (i32.lt_u
          (i32.sub (local.get $ga) (global.get $DIB_GUEST_BASE))
          (global.get $DIB_GUEST_CAPACITY))
      (then (return (i32.const 1))))
    (i32.ne (call $guest_page_translate (local.get $ga)) (global.get $NULL_SENTINEL)))

  ;; The lowest guest address a sparse VirtualAlloc reservation may occupy.
  ;;
  ;; It used to be the flat $VIRTUAL_ALLOC_MIN, which is not a fact about
  ;; anything. The real constraint is that a sparse mapping must not land inside
  ;; the direct window, because $g2w answers a direct-window address from the
  ;; image's affine delta above and never consults the page table at all. That
  ;; window ends at guest (region.end $DIRECT_WINDOW) + image_base - GUEST_BASE,
  ;; which for the usual 0x400000 image is 0x083EE000 -- so the constant was
  ;; holding back 124 MB of guest address space that nothing else could use.
  ;;
  ;; Black & White 2 is what made that matter. At the land picker its reserve
  ;; cursor stands at 0x289F0000 and the land loader asks for one 430 MB
  ;; (0x19AA0000) reservation; that lands at 0x0EF50000, 18 MB below the old
  ;; floor and 100 MB above this one. It was refused, operator new returned
  ;; null, and the unhandled std::bad_alloc ended the process.
  ;;
  ;; Capped at the old constant rather than simply derived: an image based high
  ;; enough to push the direct window past it would *raise* the floor, and the
  ;; code-page bitmap that records decoded pages below the floor covers exactly
  ;; 0x10000000 pages' worth. Raising the floor is a separate change with its
  ;; own correctness argument to make; lowering it needs none.
  (func $virtual_alloc_min (result i32)
    (local $end i32)
    (local.set $end
      (i32.and
        (i32.add
          (i32.sub (i32.add (region.end $DIRECT_WINDOW) (global.get $image_base))
                   (global.get $GUEST_BASE))
          (i32.const 0xFFFF))
        (i32.const 0xFFFF0000)))
    (select (local.get $end) (global.get $VIRTUAL_ALLOC_MIN)
      (i32.lt_u (local.get $end) (global.get $VIRTUAL_ALLOC_MIN))))

  ;; Translate a complete guest span only when one affine mapping contains it.
  ;; Unlike translating two endpoints, this proves that every byte between them
  ;; uses the same guest->WASM delta. Return NULL_SENTINEL when the span crosses
  ;; a mapping boundary or is unmapped, so callers can retain their elementwise
  ;; fallback. The unsigned `len <= size-off` form also rejects wrapped ends.
  (func $g2w_affine_span (param $ga i32) (param $len i32) (result i32)
    (local $wa i32) (local $off i32)

    (local.set $wa
      (i32.add (i32.sub (local.get $ga) (global.get $image_base))
        (global.get $GUEST_BASE)))
    (if (i32.and
          (i32.lt_u (local.get $wa) (region.end $DIRECT_WINDOW))
          (i32.le_u (local.get $len)
            (i32.sub (region.end $DIRECT_WINDOW) (local.get $wa))))
      (then (return (local.get $wa))))

    (local.set $off
      (i32.sub (local.get $ga) (global.get $DIB_GUEST_BASE)))
    (if (i32.and
          (i32.lt_u (local.get $off) (global.get $DIB_GUEST_CAPACITY))
          (i32.le_u (local.get $len)
            (i32.sub (global.get $DIB_GUEST_CAPACITY) (local.get $off))))
      (then
        (if (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 4)) (then
          (call $d3dim_lazy_access
            (i32.add (global.get $DIB_BACKING_BASE) (local.get $off)) (local.get $len))))
        (return (i32.add (global.get $DIB_BACKING_BASE) (local.get $off)))))

    ;; The page-boundary walk is amortized by the bulk operation that requested
    ;; the span. NULL_SENTINEL tells that caller to preserve exact x86 ordering
    ;; through its elementwise path when pages are missing or non-contiguous.
    (local.set $wa (call $guest_page_affine_span (local.get $ga) (local.get $len)))
    ;; --uop-win-census: how the sparse spans bulk paths ask for turn out.
    (if (global.get $uwc_on)
      (then (call $uwc_bulk_note (local.get $len) (local.get $wa))))
    (local.get $wa)
  )
  ;; Sparse backing is not in the direct affine guest window. In particular,
  ;; native shader allocations retain WASM pointers and must recover the real
  ;; guest allocation on release. Serialize against map removal/compaction.
  (func $w2g_sparse (param $wa i32) (result i32)
    (local $i i32) (local $count i32) (local $rec i32)
    (local $off i32) (local $guest i32)
    (call $lock_acquire (global.get $LOCK_VIRTUAL_MAP))
    (local.set $count (i32.atomic.load (global.get $VIRTUAL_MAP_STATE)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (i32.add (global.get $VIRTUAL_MAP_TABLE)
        (i32.shl (local.get $i) (i32.const 4))))
      (local.set $off (i32.sub (local.get $wa) (i32.load offset=8 (local.get $rec))))
      (if (i32.lt_u (local.get $off) (i32.load offset=4 (local.get $rec)))
        (then
          (local.set $guest (i32.add (i32.load (local.get $rec)) (local.get $off)))
          (br $done)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (call $lock_release (global.get $LOCK_VIRTUAL_MAP))
    (local.get $guest))
  (func $w2g (param $wa i32) (result i32)
    (if (i32.lt_u
          (i32.sub (local.get $wa) (global.get $VIRTUAL_BACKING_BASE))
          (global.get $VIRTUAL_BACKING_BASE_SIZE))
      (then (return (call $w2g_sparse (local.get $wa)))))
    ;; The extension backing window, above the declared map. Same record table,
    ;; so the same walk answers it; only the range test has to know it exists.
    ;; A host that created the 512MB minimum has no such addresses, and
    ;; $virtual_backing_ext_end returns 0 there so this test never fires.
    (if (i32.and (i32.ge_u (local.get $wa) (call $virtual_backing_ext_base))
          (i32.lt_u (local.get $wa) (call $virtual_backing_ext_end)))
      (then (return (call $w2g_sparse (local.get $wa)))))
    (if (result i32)
      (i32.lt_u
        (i32.sub (local.get $wa) (global.get $DIB_BACKING_BASE))
        (global.get $DIB_BACKING_BASE_SIZE))
      (then
        (i32.add
          (global.get $DIB_GUEST_BASE)
          (i32.sub (local.get $wa) (global.get $DIB_BACKING_BASE))))
      (else
        (i32.add
          (i32.sub (local.get $wa) (global.get $GUEST_BASE))
          (global.get $image_base)))))
  ;; Sparse VirtualAlloc ranges are guest-contiguous, but adjacent guest pages
  ;; need not have adjacent WASM backing (commits can be interleaved). Keep the
  ;; normal aligned/page-local path to one translation; only gather/scatter the
  ;; few x86 word/dword accesses that actually cross a non-contiguous boundary.
  (func $gl32 (param $ga i32) (result i32)
    (local $wa i32) (local $end_wa i32) (local $g2w_wa i32) (local $epoch i32)
    (local.set $wa (g2w-fast (local.get $ga)))
    (if (i32.le_u (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 0xFFC))
      (then (return (i32.load (local.get $wa)))))
    (local.set $epoch (global.get $fault_sync_epoch))
    (local.set $end_wa (call $g2w (i32.add (local.get $ga) (i32.const 3))))
    (if (i32.and (i32.eq (local.get $epoch) (global.get $fault_sync_epoch))
          (i32.eq (local.get $end_wa) (i32.add (local.get $wa) (i32.const 3))))
      (then (return (i32.load (local.get $wa)))))
    ;; Byte by byte, each translated just before it is read. Translating the
    ;; last byte may have run a fault filter that decommitted the first page
    ;; (Serious Sam's CTStream window does exactly that), so $wa is not reused;
    ;; a byte read before a later fault was valid when it was read, which is
    ;; what the restarted instruction would see.
    (i32.or
      (i32.or
        (i32.load8_u (call $g2w (local.get $ga)))
        (i32.shl
          (i32.load8_u (call $g2w (i32.add (local.get $ga) (i32.const 1))))
          (i32.const 8)))
      (i32.or
        (i32.shl
          (i32.load8_u (call $g2w (i32.add (local.get $ga) (i32.const 2))))
          (i32.const 16))
        (i32.shl
          (i32.load8_u (call $g2w (i32.add (local.get $ga) (i32.const 3))))
          (i32.const 24)))))
  ;; Native x87 loads retain the single contiguous direct-window lookup. Only
  ;; other mappings need page-edge validation (and a lazy DIB access barrier).
  (func $gl32_native (param $ga i32) (result i32)
    (local $wa i32)
    (local.set $wa (i32.add (i32.sub (local.get $ga) (global.get $image_base)) (global.get $GUEST_BASE)))
    (if (i32.le_u (local.get $wa) (i32.sub (region.end $DIRECT_WINDOW) (i32.const 4)))
      (then (return (i32.load (local.get $wa)))))
    (call $gl32 (local.get $ga)))

  (func $gl64 (param $ga i32) (result i64)
    (local $wa i32) (local $end_wa i32) (local $epoch i32)
    (local.set $wa (i32.add (i32.sub (local.get $ga) (global.get $image_base)) (global.get $GUEST_BASE)))
    (if (i32.le_u (local.get $wa) (i32.sub (region.end $DIRECT_WINDOW) (i32.const 8)))
      (then (return (i64.load (local.get $wa)))))
    (local.set $wa (call $g2w (local.get $ga)))
    (if (i32.le_u (i32.and (local.get $ga) (i32.const 4095)) (i32.const 4088))
      (then (return (i64.load (local.get $wa)))))
    ;; Translate the last byte BEFORE loading either half. A pending GPU
    ;; surface can start on the second page even when the first is outside it.
    (local.set $epoch (global.get $fault_sync_epoch))
    (local.set $end_wa (call $g2w (i32.add (local.get $ga) (i32.const 7))))
    (if (i32.and (i32.eq (local.get $epoch) (global.get $fault_sync_epoch))
          (i32.eq (local.get $end_wa) (i32.add (local.get $wa) (i32.const 7))))
      (then (return (i64.load (local.get $wa)))))
    (i64.or (i64.extend_i32_u (call $gl32 (local.get $ga)))
      (i64.shl (i64.extend_i32_u (call $gl32 (i32.add (local.get $ga) (i32.const 4)))) (i64.const 32))))

  (func $gl16 (param $ga i32) (result i32)
    (local $wa i32) (local $end_wa i32) (local $g2w_wa i32) (local $epoch i32)
    (local.set $wa (g2w-fast (local.get $ga)))
    (if (i32.ne (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 0xFFF))
      (then (return (i32.load16_u (local.get $wa)))))
    (local.set $epoch (global.get $fault_sync_epoch))
    (local.set $end_wa (call $g2w (i32.add (local.get $ga) (i32.const 1))))
    (if (i32.and (i32.eq (local.get $epoch) (global.get $fault_sync_epoch))
          (i32.eq (local.get $end_wa) (i32.add (local.get $wa) (i32.const 1))))
      (then (return (i32.load16_u (local.get $wa)))))
    ;; As $gl32: never a translation taken before a fault filter ran.
    (i32.or
      (i32.load8_u (call $g2w (local.get $ga)))
      (i32.shl (i32.load8_u (call $g2w (i32.add (local.get $ga) (i32.const 1)))) (i32.const 8))))
  (func $gl8 (param $ga i32) (result i32)
    (local $g2w_wa i32)
    (i32.load8_u (g2w-fast (local.get $ga))))
  ;; Cheap "could a write here be touching code?" test, for one guest address.
  ;; Page-granular over the whole guest space ($code_page_test, 04-cache; exact
  ;; below 0x10000000, hashed across 256MB segments above): the old
  ;; OR with the sparse generated-code min..max span is gone, because that span
  ;; flagged every data page between two generated-code islands (StarCraft:
  ;; 7.5M no-op invalidations per 3500 batches). Kept as a name because the uop
  ;; store-window test (07d $uop_window_set) asks the same question.
  (func $code_write_is_code (param $ga i32) (result i32)
    (call $code_page_test (local.get $ga)))

  (func $store_page_needs_barrier (param $ga i32) (result i32)
    (i32.or (call $code_write_is_code (local.get $ga))
      (call $page_watch_is_watched (call $g2w (local.get $ga)))))

  ;; A write of $len bytes starting at $ga. The length is not decoration: with
  ;; per-offset invalidation (docs/page-compile-design.md section 5) the retire
  ;; walk needs the real extent, because it retires the blocks that cover the
  ;; bytes named and nothing else. Passing only the first and last byte of a
  ;; REP MOVS -- which is what the page-granularity design got away with, since
  ;; two endpoints named every page in between as long as there were at most
  ;; two -- would now leave every block in the middle live over rewritten bytes.
  (func $invalidate_code_write (param $ga i32) (param $len i32)
    ;; Bulk writers already use this boundary before their contiguous write.
    ;; As with code invalidation, resource ownership must exclude a concurrent
    ;; reader until that operation finishes; this notification is not a fence.
    (call $page_watch_write_guest (local.get $ga) (local.get $len))
    ;; Invalidate decoded blocks only when writes can affect already-decoded
    ;; executable bytes. RCT mutates large image-data buffers during startup;
    ;; treating every image write as self-modifying code makes each byte/word
    ;; update scan the whole block-cache index.
    ;;
    ;; $code_page_test answers that per page for every guest page: its bit is
    ;; set by $code_note_decode, so it is on if a block was decoded out of
    ;; that page (by any instance) -- or out of a page it aliases with across
    ;; a 256MB segment, which only costs a slow path. It replaces the old code_start..end,
    ;; generated_code_start..end and generated_sparse_code_* span tests, which
    ;; were all coarser -- a span covers every data page between its ends.
    (if (i32.eqz (global.get $exe_size_of_image)) (then (return)))
    ;; The hot case is a 1/2/4-byte write inside one page: answer it with the
    ;; bitmap and decline without a call. A write that spans pages goes straight
    ;; to the range walk, which tests each page's directory slot itself -- a
    ;; first-page test would be wrong there, since the code could be in the last
    ;; page of the span.
    (if (i32.le_u (i32.add (i32.and (local.get $ga) (i32.const 0xFFF)) (local.get $len))
                  (i32.const 4096))
      (then
        (if (i32.eqz (call $code_page_test (local.get $ga))) (then (return)))))
    ;; Multi-page spans need every page in between retired, not just the two
    ;; ends -- main fixed that with its own $invalidate_code_range, and the
    ;; page-compile one below already walks page by page, so that fix arrives
    ;; here as a property of the range walk rather than a second function.
    (call $invalidate_code_range (local.get $ga) (local.get $len)))

  ;; The slow half of a single-page $gsN store, reached only when the page's
  ;; CODE_PAGE_BITMAP bit is set: the $gsN helpers test the bit inline (one
  ;; byte load and a few shifts/masks) so the ~every-store common case -- a data
  ;; page, including every push/call to the stack -- never makes a call. The
  ;; per-thread page index then decides, byte-exactly, whether anything dies.
  (func $code_write_hit (param $ga i32) (param $len i32)
    (if (i32.eqz (global.get $exe_size_of_image)) (then (return)))
    (call $invalidate_code_range (local.get $ga) (local.get $len)))

  (func $gs32 (param $ga i32) (param $v i32)
    (local $wa i32) (local $end_wa i32) (local $g2w_wa i32) (local $epoch i32) (local $tries i32)
    (local.set $wa (g2w-fast (local.get $ga)))
    (if (i32.le_u (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 0xFFC))
      (then
        (if (i32.and ;; inline $code_page_test: slot = (ga>>12 ^ ga>>28 ^ (ga>>30)<<15) & 0xFFFF
              (i32.load8_u (i32.add (global.get $CODE_PAGE_BITMAP)
                (i32.and (i32.xor (i32.xor (i32.shr_u (local.get $ga) (i32.const 15))
                                           (i32.shr_u (local.get $ga) (i32.const 31)))
                                  (i32.shl (i32.shr_u (local.get $ga) (i32.const 30)) (i32.const 12)))
                         (i32.const 0x1FFF))))
              (i32.shl (i32.const 1)
                (i32.and (i32.xor (i32.shr_u (local.get $ga) (i32.const 12))
                                  (i32.shr_u (local.get $ga) (i32.const 28)))
                         (i32.const 7))))
          (then (call $code_write_hit (local.get $ga) (i32.const 4))))
        (i32.store (local.get $wa) (local.get $v))
        (call $page_watch_write_one (local.get $wa)) (return)))
    ;; Sampled before $invalidate_code_write: its page-watch walk translates
    ;; the bytes too, and a fault filter it runs can move the page $wa names.
    (local.set $epoch (global.get $fault_sync_epoch))
    (call $invalidate_code_write (local.get $ga) (i32.const 4))
    (local.set $end_wa (call $g2w (i32.add (local.get $ga) (i32.const 3))))
    (if (i32.and (i32.eq (local.get $epoch) (global.get $fault_sync_epoch))
          (i32.eq (local.get $end_wa) (i32.add (local.get $wa) (i32.const 3))))
      (then (i32.store (local.get $wa) (local.get $v))
        (call $page_watch_write (local.get $wa) (i32.const 4)) (return)))
    ;; Byte by byte with fresh translations, again whenever a fault filter ran
    ;; during the pass: it may have decommitted a page already written, and the
    ;; restarted x86 store would write every byte again. Bounded; a filter that
    ;; keeps both pages committed (CTStream's two-page window) settles at once.
    (block $stored (loop $again
      (local.set $epoch (global.get $fault_sync_epoch))
      (local.set $wa (call $g2w (local.get $ga)))
      (i32.store8 (local.get $wa) (local.get $v))
      (i32.store8
        (call $g2w (i32.add (local.get $ga) (i32.const 1)))
        (i32.shr_u (local.get $v) (i32.const 8)))
      (i32.store8
        (call $g2w (i32.add (local.get $ga) (i32.const 2)))
        (i32.shr_u (local.get $v) (i32.const 16)))
      (local.set $end_wa (call $g2w (i32.add (local.get $ga) (i32.const 3))))
      (i32.store8 (local.get $end_wa) (i32.shr_u (local.get $v) (i32.const 24)))
      (br_if $stored (i32.eq (local.get $epoch) (global.get $fault_sync_epoch)))
      (local.set $tries (i32.add (local.get $tries) (i32.const 1)))
      (br_if $again (i32.lt_u (local.get $tries) (i32.const 4)))))
    (call $page_watch_write_one (local.get $wa))
    (call $page_watch_write_one (local.get $end_wa)))
  ;; Common 64-bit guest store for x87/MMX. Translate once for the ordinary
  ;; same-page case; sparse guest neighbors need not be WASM neighbors.
  (func $gs64 (param $ga i32) (param $v i64)
    (local $wa i32) (local $end_wa i32) (local $g2w_wa i32) (local $epoch i32) (local $tries i32)
    (local.set $wa (g2w-fast (local.get $ga)))
    (if (i32.le_u (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 0xFF8))
      (then
        (if (i32.and ;; inline $code_page_test: slot = (ga>>12 ^ ga>>28 ^ (ga>>30)<<15) & 0xFFFF
              (i32.load8_u (i32.add (global.get $CODE_PAGE_BITMAP)
                (i32.and (i32.xor (i32.xor (i32.shr_u (local.get $ga) (i32.const 15))
                                           (i32.shr_u (local.get $ga) (i32.const 31)))
                                  (i32.shl (i32.shr_u (local.get $ga) (i32.const 30)) (i32.const 12)))
                         (i32.const 0x1FFF))))
              (i32.shl (i32.const 1)
                (i32.and (i32.xor (i32.shr_u (local.get $ga) (i32.const 12))
                                  (i32.shr_u (local.get $ga) (i32.const 28)))
                         (i32.const 7))))
          (then (call $code_write_hit (local.get $ga) (i32.const 8))))
        (i64.store (local.get $wa) (local.get $v))
        (call $page_watch_write_one (local.get $wa)) (return)))
    (local.set $epoch (global.get $fault_sync_epoch))
    (call $invalidate_code_write (local.get $ga) (i32.const 8))
    (local.set $end_wa (call $g2w (i32.add (local.get $ga) (i32.const 7))))
    (if (i32.and (i32.eq (local.get $epoch) (global.get $fault_sync_epoch))
          (i32.eq (local.get $end_wa) (i32.add (local.get $wa) (i32.const 7))))
      (then (i64.store (local.get $wa) (local.get $v))
        (call $page_watch_write (local.get $wa) (i32.const 8)) (return)))
    ;; Both halves again if a fault filter ran between them (see $gs32).
    (block $stored (loop $again
      (local.set $epoch (global.get $fault_sync_epoch))
      (call $gs32 (local.get $ga) (i32.wrap_i64 (local.get $v)))
      (call $gs32 (i32.add (local.get $ga) (i32.const 4))
        (i32.wrap_i64 (i64.shr_u (local.get $v) (i64.const 32))))
      (br_if $stored (i32.eq (local.get $epoch) (global.get $fault_sync_epoch)))
      (local.set $tries (i32.add (local.get $tries) (i32.const 1)))
      (br_if $again (i32.lt_u (local.get $tries) (i32.const 4))))))
  ;; 128-bit guest access for SSE (MOVAPS/MOVUPS and every packed memory
  ;; operand). A same-page access is one translation and one v128 op; a
  ;; page-crossing operand goes lane by lane through $gl32/$gs32, since
  ;; adjacent sparse guest pages need not be adjacent in WASM memory.
  (func $gl128 (param $ga i32) (result v128)
    (local $wa i32) (local $g2w_wa i32)
    (if (i32.le_u (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 0xFF0))
      (then
        (local.set $wa (g2w-fast (local.get $ga)))
        ;; A miss has already been reported once by $g2w; every lane of an
        ;; unmapped page reads as the sentinel's zero, as four $gl32s would.
        ;; The sentinel is only four bytes, so it must not take a v128.load.
        (if (i32.eq (local.get $wa) (global.get $NULL_SENTINEL))
          (then (return (v128.const i32x4 0 0 0 0))))
        (return (v128.load (local.get $wa)))))
    (i32x4.replace_lane 3
      (i32x4.replace_lane 2
        (i32x4.replace_lane 1
          (i32x4.replace_lane 0 (i32x4.splat (i32.const 0))
            (call $gl32 (local.get $ga)))
          (call $gl32 (i32.add (local.get $ga) (i32.const 4))))
        (call $gl32 (i32.add (local.get $ga) (i32.const 8))))
      (call $gl32 (i32.add (local.get $ga) (i32.const 12)))))
  (func $gs128 (param $ga i32) (param $v v128)
    (local $wa i32) (local $g2w_wa i32) (local $epoch i32) (local $tries i32)
    (if (i32.le_u (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 0xFF0))
      (then
        (local.set $wa (g2w-fast (local.get $ga)))
        ;; Unmapped: the miss is reported, and the write goes nowhere.
        (if (i32.eq (local.get $wa) (global.get $NULL_SENTINEL)) (then (return)))
        (if (i32.and ;; inline $code_page_test: slot = (ga>>12 ^ ga>>28 ^ (ga>>30)<<15) & 0xFFFF
              (i32.load8_u (i32.add (global.get $CODE_PAGE_BITMAP)
                (i32.and (i32.xor (i32.xor (i32.shr_u (local.get $ga) (i32.const 15))
                                           (i32.shr_u (local.get $ga) (i32.const 31)))
                                  (i32.shl (i32.shr_u (local.get $ga) (i32.const 30)) (i32.const 12)))
                         (i32.const 0x1FFF))))
              (i32.shl (i32.const 1)
                (i32.and (i32.xor (i32.shr_u (local.get $ga) (i32.const 12))
                                  (i32.shr_u (local.get $ga) (i32.const 28)))
                         (i32.const 7))))
          (then (call $code_write_hit (local.get $ga) (i32.const 16))))
        (v128.store (local.get $wa) (local.get $v))
        (call $page_watch_write_one (local.get $wa)) (return)))
    ;; Every lane again if a fault filter ran meanwhile (see $gs32).
    (block $stored (loop $again
      (local.set $epoch (global.get $fault_sync_epoch))
      (call $gs32 (local.get $ga) (i32x4.extract_lane 0 (local.get $v)))
      (call $gs32 (i32.add (local.get $ga) (i32.const 4)) (i32x4.extract_lane 1 (local.get $v)))
      (call $gs32 (i32.add (local.get $ga) (i32.const 8)) (i32x4.extract_lane 2 (local.get $v)))
      (call $gs32 (i32.add (local.get $ga) (i32.const 12)) (i32x4.extract_lane 3 (local.get $v)))
      (br_if $stored (i32.eq (local.get $epoch) (global.get $fault_sync_epoch)))
      (local.set $tries (i32.add (local.get $tries) (i32.const 1)))
      (br_if $again (i32.lt_u (local.get $tries) (i32.const 4))))))
  (func $gs16 (param $ga i32) (param $v i32)
    (local $wa i32) (local $end_wa i32) (local $g2w_wa i32) (local $epoch i32) (local $tries i32)
    (local.set $wa (g2w-fast (local.get $ga)))
    (if (i32.ne (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 0xFFF))
      (then
        (if (i32.and ;; inline $code_page_test: slot = (ga>>12 ^ ga>>28 ^ (ga>>30)<<15) & 0xFFFF
              (i32.load8_u (i32.add (global.get $CODE_PAGE_BITMAP)
                (i32.and (i32.xor (i32.xor (i32.shr_u (local.get $ga) (i32.const 15))
                                           (i32.shr_u (local.get $ga) (i32.const 31)))
                                  (i32.shl (i32.shr_u (local.get $ga) (i32.const 30)) (i32.const 12)))
                         (i32.const 0x1FFF))))
              (i32.shl (i32.const 1)
                (i32.and (i32.xor (i32.shr_u (local.get $ga) (i32.const 12))
                                  (i32.shr_u (local.get $ga) (i32.const 28)))
                         (i32.const 7))))
          (then (call $code_write_hit (local.get $ga) (i32.const 2))))
        (i32.store16 (local.get $wa) (local.get $v))
        (call $page_watch_write_one (local.get $wa)) (return)))
    ;; Sampled before $invalidate_code_write: its page-watch walk translates
    ;; the bytes too, and a fault filter it runs can move the page $wa names.
    (local.set $epoch (global.get $fault_sync_epoch))
    (call $invalidate_code_write (local.get $ga) (i32.const 2))
    (local.set $end_wa (call $g2w (i32.add (local.get $ga) (i32.const 1))))
    (if (i32.and (i32.eq (local.get $epoch) (global.get $fault_sync_epoch))
          (i32.eq (local.get $end_wa) (i32.add (local.get $wa) (i32.const 1))))
      (then (i32.store16 (local.get $wa) (local.get $v))
        (call $page_watch_write (local.get $wa) (i32.const 2)) (return)))
    ;; As $gs32.
    (block $stored (loop $again
      (local.set $epoch (global.get $fault_sync_epoch))
      (local.set $wa (call $g2w (local.get $ga)))
      (i32.store8 (local.get $wa) (local.get $v))
      (local.set $end_wa (call $g2w (i32.add (local.get $ga) (i32.const 1))))
      (i32.store8 (local.get $end_wa) (i32.shr_u (local.get $v) (i32.const 8)))
      (br_if $stored (i32.eq (local.get $epoch) (global.get $fault_sync_epoch)))
      (local.set $tries (i32.add (local.get $tries) (i32.const 1)))
      (br_if $again (i32.lt_u (local.get $tries) (i32.const 4)))))
    (call $page_watch_write_one (local.get $wa))
    (call $page_watch_write_one (local.get $end_wa)))
  (func $gs8 (param $ga i32) (param $v i32)
    (local $wa i32) (local $g2w_wa i32)
    (local.set $wa (g2w-fast (local.get $ga)))
    (if (i32.and ;; inline $code_page_test: slot = (ga>>12 ^ ga>>28 ^ (ga>>30)<<15) & 0xFFFF
              (i32.load8_u (i32.add (global.get $CODE_PAGE_BITMAP)
                (i32.and (i32.xor (i32.xor (i32.shr_u (local.get $ga) (i32.const 15))
                                           (i32.shr_u (local.get $ga) (i32.const 31)))
                                  (i32.shl (i32.shr_u (local.get $ga) (i32.const 30)) (i32.const 12)))
                         (i32.const 0x1FFF))))
              (i32.shl (i32.const 1)
                (i32.and (i32.xor (i32.shr_u (local.get $ga) (i32.const 12))
                                  (i32.shr_u (local.get $ga) (i32.const 28)))
                         (i32.const 7))))
      (then (call $code_write_hit (local.get $ga) (i32.const 1))))
    (i32.store8 (local.get $wa) (local.get $v))
    (call $page_watch_write_one (local.get $wa)))

  ;; ============================================================
  ;; LAZY FLAGS
  ;; ============================================================
  (func $set_flags_add (param $a i32) (param $b i32) (param $r i32)
    (global.set $flag_op (i32.const 1)) (global.set $flag_sign_shift (i32.const 31))
    (global.set $flag_a (local.get $a)) (global.set $flag_b (local.get $b)) (global.set $flag_res (local.get $r)))
  (func $set_flags_sub (param $a i32) (param $b i32) (param $r i32)
    (global.set $flag_op (i32.const 2)) (global.set $flag_sign_shift (i32.const 31))
    (global.set $flag_a (local.get $a)) (global.set $flag_b (local.get $b)) (global.set $flag_res (local.get $r)))
  (func $set_flags_logic (param $r i32)
    (global.set $flag_op (i32.const 3)) (global.set $flag_sign_shift (i32.const 31)) (global.set $flag_res (local.get $r)))
  (func $set_flags_shift (param $r i32) (param $cf i32)
    (global.set $flag_op (i32.const 7)) (global.set $flag_sign_shift (i32.const 31)) (global.set $flag_res (local.get $r))
    (global.set $flag_b (local.get $cf)))
  ;; ROL/ROR/RCL/RCR write only CF and OF (count != 0); ZF, SF and PF keep
  ;; whatever the previous instruction left. Code that tests a compare across
  ;; a rotate depends on it: Indeo 4's generated VLC reader in ir41_32.dll does
  ;; `cmp al,0x10 / ror eax,0x10 / jz`, and with the rotate's result written
  ;; as the ZF source it never took the branch and decoded forever. So the
  ;; record goes to exact raw mode (9), the one that stores each flag
  ;; independently -- the same shape SAHF and POPF produce. The SF source has
  ;; bits 7, 15 and 31 all set because the 8- and 16-bit shift handlers
  ;; rewrite $flag_sign_shift to 7 / 15 after $do_shift returns.
  (func $set_flags_rotate (param $cf i32) (param $of i32)
    (local $zf i32) (local $sf i32) (local $pf i32)
    (local.set $zf (call $get_zf))
    (local.set $sf (call $get_sf))
    (local.set $pf (call $get_pf))
    (global.set $flag_op (i32.const 9))
    (global.set $flag_sign_shift (i32.const 31))
    (global.set $flag_a (i32.or (i32.and (local.get $cf) (i32.const 1))
                                (i32.shl (local.get $pf) (i32.const 1))))
    (global.set $flag_b (i32.and (local.get $of) (i32.const 1)))
    (global.set $flag_res
      (if (result i32) (local.get $zf) (then (i32.const 0))
        (else (if (result i32) (local.get $sf) (then (i32.const 0x80008081))
          (else (i32.const 1)))))))
  (func $set_flags_inc (param $a i32) (param $r i32)
    (global.set $saved_cf (call $get_cf))  ;; INC preserves CF
    (global.set $flag_op (i32.const 4)) (global.set $flag_sign_shift (i32.const 31))
    (global.set $flag_a (local.get $a)) (global.set $flag_b (i32.const 1)) (global.set $flag_res (local.get $r)))
  (func $set_flags_dec (param $a i32) (param $r i32)
    (global.set $saved_cf (call $get_cf))  ;; DEC preserves CF
    (global.set $flag_op (i32.const 5)) (global.set $flag_sign_shift (i32.const 31))
    (global.set $flag_a (local.get $a)) (global.set $flag_b (i32.const 1)) (global.set $flag_res (local.get $r)))

  (func $get_zf (result i32) (i32.eqz (global.get $flag_res)))
  (func $get_sf (result i32) (i32.and (i32.shr_u (global.get $flag_res) (global.get $flag_sign_shift)) (i32.const 1)))
  (func $get_cf (result i32)
    (if (result i32) (i32.eq (global.get $flag_op) (i32.const 1))
      (then (i32.lt_u (global.get $flag_res) (global.get $flag_a)))
    (else (if (result i32) (i32.eq (global.get $flag_op) (i32.const 2))
      (then (i32.lt_u (global.get $flag_a) (global.get $flag_b)))
    (else (if (result i32) (i32.or (i32.eq (global.get $flag_op) (i32.const 4))
                                   (i32.eq (global.get $flag_op) (i32.const 5)))
      (then (global.get $saved_cf))  ;; INC/DEC preserve CF
    (else (if (result i32) (i32.eq (global.get $flag_op) (i32.const 6))
      (then (global.get $flag_b))  ;; MUL/IMUL: flag_b stores CF/OF
    (else (if (result i32) (i32.eq (global.get $flag_op) (i32.const 7))
      (then (global.get $flag_b))  ;; Shift: flag_b stores last bit shifted out
    (else (if (result i32) (i32.eq (global.get $flag_op) (i32.const 8))
      (then (global.get $flag_a))  ;; Raw mode: CF stored in flag_a
    (else (if (result i32) (i32.eq (global.get $flag_op) (i32.const 9))
      (then (i32.and (global.get $flag_a) (i32.const 1)))  ;; Exact raw: packed CF
    (else (i32.const 0))))))))))))))))
  (func $get_of (result i32)
    (local $sa i32) (local $sb i32) (local $sr i32)
    ;; Raw mode: OF stored in flag_b
    (if (i32.or (i32.eq (global.get $flag_op) (i32.const 8))
                 (i32.eq (global.get $flag_op) (i32.const 9)))
      (then (return (global.get $flag_b))))
    ;; MUL/IMUL: OF = CF = flag_b
    (if (i32.eq (global.get $flag_op) (i32.const 6))
      (then (return (global.get $flag_b))))
    (local.set $sa (i32.and (i32.shr_u (global.get $flag_a) (global.get $flag_sign_shift)) (i32.const 1)))
    (local.set $sb (i32.and (i32.shr_u (global.get $flag_b) (global.get $flag_sign_shift)) (i32.const 1)))
    (local.set $sr (i32.and (i32.shr_u (global.get $flag_res) (global.get $flag_sign_shift)) (i32.const 1)))
    (if (result i32) (i32.or (i32.eq (global.get $flag_op) (i32.const 1)) (i32.eq (global.get $flag_op) (i32.const 4)))
      (then (i32.and (i32.eq (local.get $sa) (local.get $sb)) (i32.ne (local.get $sa) (local.get $sr))))
    (else (if (result i32) (i32.or (i32.eq (global.get $flag_op) (i32.const 2)) (i32.eq (global.get $flag_op) (i32.const 5)))
      (then (i32.and (i32.ne (local.get $sa) (local.get $sb)) (i32.eq (local.get $sb) (local.get $sr))))
    (else (i32.const 0))))))

  ;; SAHF/POPF supply independently writable flags. In exact raw mode (9),
  ;; flag_a packs CF in bit 0 and PF in bit 1. Other modes derive parity from
  ;; the lazy arithmetic result as before.
  (func $get_pf (result i32)
    (if (result i32) (i32.eq (global.get $flag_op) (i32.const 9))
      (then (i32.and (i32.shr_u (global.get $flag_a) (i32.const 1)) (i32.const 1)))
      (else (i32.eqz (i32.and
        (i32.popcnt (i32.and (global.get $flag_res) (i32.const 0xFF)))
        (i32.const 1))))))

  ;; Evaluate condition code (same encoding as x86 Jcc lower nibble)
  ;; 0=O,1=NO,2=B,3=AE,4=Z,5=NZ,6=BE,7=A,8=S,9=NS,A=P,B=NP,C=L,D=GE,E=LE,F=G
  (func $eval_cc (param $cc i32) (result i32)
    (local $r i32)
    (if (i32.eq (local.get $cc) (i32.const 0x0)) (then (return (call $get_of))))
    (if (i32.eq (local.get $cc) (i32.const 0x1)) (then (return (i32.eqz (call $get_of)))))
    (if (i32.eq (local.get $cc) (i32.const 0x2)) (then (return (call $get_cf))))
    (if (i32.eq (local.get $cc) (i32.const 0x3)) (then (return (i32.eqz (call $get_cf)))))
    (if (i32.eq (local.get $cc) (i32.const 0x4)) (then (return (call $get_zf))))
    (if (i32.eq (local.get $cc) (i32.const 0x5)) (then (return (i32.eqz (call $get_zf)))))
    (if (i32.eq (local.get $cc) (i32.const 0x6)) (then (return (i32.or (call $get_cf) (call $get_zf)))))
    (if (i32.eq (local.get $cc) (i32.const 0x7)) (then (return (i32.and (i32.eqz (call $get_cf)) (i32.eqz (call $get_zf))))))
    (if (i32.eq (local.get $cc) (i32.const 0x8)) (then (return (call $get_sf))))
    (if (i32.eq (local.get $cc) (i32.const 0x9)) (then (return (i32.eqz (call $get_sf)))))
    ;; 0xA=P (parity even): low byte of result has even number of set bits
    (if (i32.eq (local.get $cc) (i32.const 0xA)) (then (return (call $get_pf))))
    ;; 0xB=NP (parity odd)
    (if (i32.eq (local.get $cc) (i32.const 0xB)) (then (return (i32.eqz (call $get_pf)))))
    ;; 0xC=L: SF!=OF
    (if (i32.eq (local.get $cc) (i32.const 0xC)) (then (return (i32.ne (call $get_sf) (call $get_of)))))
    ;; 0xD=GE: SF==OF
    (if (i32.eq (local.get $cc) (i32.const 0xD)) (then (return (i32.eq (call $get_sf) (call $get_of)))))
    ;; 0xE=LE: ZF=1 or SF!=OF
    (if (i32.eq (local.get $cc) (i32.const 0xE)) (then (return (i32.or (call $get_zf) (i32.ne (call $get_sf) (call $get_of))))))
    ;; 0xF=G: ZF=0 and SF==OF
    (i32.and (i32.eqz (call $get_zf)) (i32.eq (call $get_sf) (call $get_of)))
  )

  ;; Build EFLAGS from lazy state (for pushfd)
  ;;
  ;; PF comes from the same expression $eval_cc uses for JP/SETP, so a program
  ;; that reads parity out of a pushed EFLAGS word agrees with one that branches
  ;; on it. $eflags_extra carries every bit we do not model (IF, IOPL, NT, RF,
  ;; AC, and bit 21 ID) straight back out of the last popfd -- see $load_eflags.
  (func $build_eflags (result i32)
    (i32.or (i32.or (i32.or (i32.or
      (i32.shl (call $get_cf) (i32.const 0))
      (i32.const 2))  ;; bit 1 always set
      (i32.or
        (i32.shl (call $get_zf) (i32.const 6))
        (i32.shl (call $get_sf) (i32.const 7))))
      (i32.or
        (i32.shl (global.get $df) (i32.const 10))
        (i32.shl (call $get_of) (i32.const 11))))
      (i32.or
        (i32.shl (call $get_pf) (i32.const 2))  ;; PF
        (global.get $eflags_extra)))
  )

  ;; Restore flags from EFLAGS value (for popfd)
  ;; Uses flag_op=9 (exact raw mode): CF/PF/ZF/SF/OF are independent.
  (func $load_eflags (param $f i32)
    ;; Everything outside the six bits we model is remembered verbatim, so
    ;; pushfd hands it back. Dropping it used to break the standard CPUID probe
    ;; (toggle bit 21, pushfd, compare): the toggle never survived, so the ID
    ;; bit read back unchanged and the program concluded the CPU has no CPUID
    ;; at all. Allegro does exactly this, which is why Liquid War never even
    ;; executed the cpuid its binary contains, and so never installed its MMX
    ;; blitters. Mask = ~(CF|bit1|PF|AF|ZF|SF|DF|OF).
    (global.set $eflags_extra (i32.and (local.get $f) (i32.const 0xFFFFF328)))
    (global.set $df (i32.and (i32.shr_u (local.get $f) (i32.const 10)) (i32.const 1)))
    (global.set $flag_op (i32.const 9))  ;; exact raw flags mode
    ;; Pack CF/PF in flag_a, OF in flag_b, and encode ZF/SF in flag_res.
    (global.set $flag_a (i32.or
      (i32.and (local.get $f) (i32.const 1))
      (i32.and (i32.shr_u (local.get $f) (i32.const 1)) (i32.const 2))))
    (global.set $flag_b (i32.and (i32.shr_u (local.get $f) (i32.const 11)) (i32.const 1)))  ;; OF = bit 11
    ;; flag_res: bit 31 = SF, zero iff ZF. This makes get_zf and get_sf work with flag_sign_shift=31.
    ;;
    ;; PF is carried independently in flag_a, so even synthetic combinations
    ;; such as ZF=1/PF=0 round-trip exactly.
    (global.set $flag_sign_shift (i32.const 31))
    (if (i32.and (local.get $f) (i32.const 0x40))  ;; ZF = bit 6
      (then (global.set $flag_res (i32.const 0)))
      (else (if (i32.and (local.get $f) (i32.const 0x80))  ;; SF = bit 7
        (then (global.set $flag_res (i32.const 0x80000001)))
        (else (global.set $flag_res (i32.const 1))))))
  )

  ;; Save caller-saved registers + lazy flags onto guest stack (9 dwords = 36 bytes)
  (func $save_caller_regs
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base))                         (global.get $eip))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))  (i32.load offset=0 (global.get $reg_base)))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))  (i32.load offset=4 (global.get $reg_base)))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (i32.load offset=8 (global.get $reg_base)))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (global.get $flag_op))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)) (global.get $flag_res))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (global.get $flag_a))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (global.get $flag_b))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (global.get $flag_sign_shift)))

  ;; Restore caller-saved registers + lazy flags from guest stack
  (func $restore_caller_regs
    (global.set $eip             (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
    (i32.store offset=4 (global.get $reg_base) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
    (i32.store offset=8 (global.get $reg_base) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
    (global.set $flag_op         (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
    (global.set $flag_res        (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
    (global.set $flag_a          (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (global.set $flag_b          (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (global.set $flag_sign_shift (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

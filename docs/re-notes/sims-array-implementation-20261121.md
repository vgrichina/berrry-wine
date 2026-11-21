# Generic native typed output SAFEARRAY transport

Evidence: `scratch/runs/20261121-sims-array-complete/`.

The native Automation metadata reader follows VT_SAFEARRAY element descriptors.
The generic owned channel supports output SAFEARRAY** parameters containing
fixed-width Automation scalars or counted BSTRs. The actual Sims iKernel SLTG
IID DEF5FEEC-225A-11D3-88AA-00C04F72F303 slot 5 has precisely that BSTR output
signature (flags 10). No IID-specific dispatch or fabricated result is added.
The retained predecessor `metadata-full.log` supplies this metadata; extraction
and registrar setup were not repeated.

Wire values carry only the element VARTYPE, descriptor-order bounds, and flat
native-order typed elements. Scalar bits and counted UTF-16 bytes are preserved,
including embedded NULs, unpaired code units, empty BSTRs and null BSTRs.
Dimensions, signed bounds, counts, aggregate bytes, element width, native flags,
locks and complete reply shape are checked. Native output descriptors/data and
BSTR elements are destroyed on the server after encoding, including cancellation
or failed reply publication. Caller descriptor/data/strings use the native heap
and ABI; the caller can destroy them through ordinary SafeArrayDestroy. Every
allocation enters the unwind ledger immediately. The entire reply and all caller
output spans validate before publication; resources transfer only after all
outputs are written. Partial allocation failure leaves caller output slots intact.

The supported transport is deliberately output-only. Input/inout arrays,
SAFEARRAY-valued returns, nested SAFEARRAY element descriptors, VARIANT/interface
and record element ownership remain explicitly unsupported before dispatch.
Malformed or locked native output descriptors are rejected, never forcibly freed
by guessing a replacement descriptor; their native producer must return a valid
owned, unlocked array. This does not implement Microsoft NDR interoperability.

The focused native regression uses the real registered type library, real x86
SafeArrayCreate/SysAllocStringLen/SafeArrayCopy producer, and two independent
emulator memories with displaced heaps. It verifies output ABI, independent
BSTR/data/descriptor addresses, repeatable native destruction and stable heaps,
malformed native and wire metadata, empty/null outputs, failed HRESULTs, scalar
bits, partial descriptor/data/BSTR allocation failures, late output publication
failure, nested native ReadFile and executing/completed-unpolled cancellation.
All codec allocations, proxy objects, exports, requests and pending frames retire.
The exact baseline source loaded from the recorded Git revision fails on the
same actual slot-5 signature with E_NOTIMPL; no source checkout is replaced.

Validation and the one authorized real Sims continuation are recorded in the
run result. Installation and native Quit require their actual observed outcome.

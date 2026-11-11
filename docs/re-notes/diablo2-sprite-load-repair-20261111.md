# Diablo II repeated Load: retired texture wrappers exhaust the auxiliary pool

Evidence: `scratch/runs/20261111-diablo2-native-sprite-load-repair-1750/`.
The genuine four-file XP260 checkpoint first loaded successfully in a fresh
native process on the pinned parent (`0db20330ccd6761a705eea70c5dd9bfc7704c147`,
module `ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`).
A native Save & Exit exported byte-identical files; the second Load succeeded.
The third Load reproduced the original `d3dSprite.cpp:85, Expression: success`
assertion. Thus checkpoint bytes alone do not cause this failure.

A passive host import observer recorded real guest API arguments, return
addresses, and EAX after dispatch; it did not alter arguments, guest memory,
or HRESULTs. The failing call was
`IDirectDrawSurface::QueryInterface(IID_IDirect3DTexture2)` returning
`0x8007000e` (`E_OUTOFMEMORY`) with a null output. The final failing call returned
to runtime address `0x018ad7d2`, corresponding to original D2Direct3D.dll
`0x100037d2`. Disassembly connects this helper's false return to line 85.
The immediately preceding CreateSurface succeeded. A read-only snapshot found
`COM_AUX_NEXT_SHARED=16384`, 11,927 auxiliary wrappers whose DX_OBJECTS owner
was already freed, and 11,924 free DX object slots. This is auxiliary interface
wrapper exhaustion, not failed surface storage or save corruption.

`dx_get_wrapper_for_vtbl_locked` now reuses an initialized wrapper belonging
to a logically freed owner when its append pool is full. It retains the
existing lookup-first behavior and holds LOCK_DX during allocation. A zero
interface count alone does not permit reuse: the owner's DX_OBJECTS type must
be zero, preserving all views of live objects, including separately retained
surface interfaces. Reference bookkeeping is cleared for the reclaimed entry.
If every owner is live, surface QI still fails without changing a published
vtable, output ownership, or reference count.

The Surface4/7 ABI candidate fills the real pool using ordinary guest-x86 COM
calls and keeps those views alive. It checks genuine exhaustion, stable live
vtable/identity/pixels/reference counts, and a successful new QI after final
Release of one filler object. There is no fabricated COM record or cursor
fault injection. This regression fails at the reuse assertion on the pre-fix
current-main module `5512a65e2ce88cc76b39b3246d35f13919d9df060d3670a9a85cae9c4100f638`
and passes with the repair in standard and compatibility modes. The ordinary
DirectDraw interface reference-count test and locked canonical build pass.
An attempted pinned-module/current-host fixture had mismatched API identities
and is retained as an invalid fixture attempt, not regression evidence.

The original game then completed three ordinary Loads in one repaired process
using the genuine milestone files and native Save & Exit between Loads.
`review/repair-world3.png` and `review/repair-stats3.png` show the third Load
alive in camp. At that point the cursor was again 16,384, while all 29,752
observed QueryInterface calls and 29,759 CreateSurface calls had succeeded.
The same original return site `0x018ad7d2` now returned zero with a valid
Texture2 pointer. The fixed canonical module is
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`.
See the run's RESULT/RECOVERY for subsequent gameplay, separate checkpoints,
assistance disclosure, complete evidence audit, and the final stop receipt.

  ;; =====================================================================
  ;; Multiple Provider Router (MPR.DLL)
  ;;
  ;; This browser machine has no installed network provider and no mapped or
  ;; remembered network connections.  These handlers expose that supported
  ;; configuration explicitly.  They do not manufacture a provider, an enum
  ;; handle, or a drive mapping just to let an import return success.
  ;;
  ;; Microsoft documents that WNetEnumResource and WNetCloseEnum test network
  ;; availability before validating hEnum.  Therefore WNetOpenEnum cannot
  ;; truthfully hand out an empty enumeration handle here: open, enumerate and
  ;; close consistently return ERROR_NO_NETWORK.  Query/add operations which
  ;; document the same machine-wide condition return it as well.  The parent
  ;; query requires an installed provider and returns ERROR_BAD_PROVIDER;
  ;; cancellation names a connection which cannot exist and returns
  ;; ERROR_NOT_CONNECTED.  Failure paths leave every caller-owned buffer,
  ;; length/count, system-tail pointer and output handle unchanged.
  ;; =====================================================================

  ;; winerror.h values used by the documented WNet failure contracts.
  (global $MPR_ERROR_BAD_PROVIDER i32 (i32.const 1204))
  (global $MPR_ERROR_NO_NETWORK i32 (i32.const 1222))
  (global $MPR_ERROR_NOT_CONNECTED i32 (i32.const 2250))

  ;; One state decision shared by the public entry points.  $operation is an
  ;; internal closed enum:
  ;;   0 open, 1 enumerate, 2 close, 3 parent, 4 resource information,
  ;;   5 add, 6 cancel, 7 mapped-drive query, 8 universal-name query.
  ;; The stack delta includes the guest return address.
  (func $sub_mpr_no_network (param $operation i32)
    (local $result i32) (local $pop i32)
    (local.set $result (global.get $MPR_ERROR_NO_NETWORK))
    (local.set $pop (i32.const 20))
    (if (i32.eq (local.get $operation) (i32.const 0))
      (then (local.set $pop (i32.const 24))))
    (if (i32.eq (local.get $operation) (i32.const 2))
      (then (local.set $pop (i32.const 8))))
    (if (i32.eq (local.get $operation) (i32.const 3))
      (then
        (local.set $result (global.get $MPR_ERROR_BAD_PROVIDER))
        (local.set $pop (i32.const 16))))
    (if (i32.eq (local.get $operation) (i32.const 6))
      (then
        (local.set $result (global.get $MPR_ERROR_NOT_CONNECTED))
        (local.set $pop (i32.const 16))))
    (if (i32.eq (local.get $operation) (i32.const 7))
      (then (local.set $pop (i32.const 16))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $pop)))
    (i32.store offset=0 (global.get $reg_base) (local.get $result)))

  ;; WNetOpenEnum{A,W}(dwScope, dwType, dwUsage, lpNetResource, lphEnum)
  (func $handle_WNetOpenEnumA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                              (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $sub_mpr_no_network (i32.const 0)))

  (func $handle_WNetOpenEnumW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                              (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_WNetOpenEnumA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr)))

  ;; WNetEnumResource{A,W}(hEnum, lpcCount, lpBuffer, lpBufferSize).
  ;; ERROR_NO_NETWORK precedes hEnum validation on this API.
  (func $handle_WNetEnumResourceA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                  (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $sub_mpr_no_network (i32.const 1)))

  (func $handle_WNetEnumResourceW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                  (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_WNetEnumResourceA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr)))

  ;; WNetCloseEnum(hEnum).  Network availability is likewise tested first.
  (func $handle_WNetCloseEnum (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                              (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $sub_mpr_no_network (i32.const 2)))

  ;; WNetGetResourceParent{A,W}(lpNetResource, lpBuffer, lpcbBuffer).
  ;; lpProvider is required and no provider is installed on this machine.
  (func $handle_WNetGetResourceParentA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                       (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $sub_mpr_no_network (i32.const 3)))

  (func $handle_WNetGetResourceParentW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                       (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_WNetGetResourceParentA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr)))

  ;; WNetGetResourceInformation{A,W}(lpNetResource, lpBuffer, lpcbBuffer,
  ;;                                  lplpSystem)
  (func $handle_WNetGetResourceInformationA (param $arg0 i32) (param $arg1 i32)
                                            (param $arg2 i32) (param $arg3 i32)
                                            (param $arg4 i32) (param $name_ptr i32)
    (call $sub_mpr_no_network (i32.const 4)))

  (func $handle_WNetGetResourceInformationW (param $arg0 i32) (param $arg1 i32)
                                            (param $arg2 i32) (param $arg3 i32)
                                            (param $arg4 i32) (param $name_ptr i32)
    (call $handle_WNetGetResourceInformationA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr)))

  ;; WNetAddConnection2{A,W}(lpNetResource, lpPassword, lpUserName, dwFlags)
  (func $handle_WNetAddConnection2A (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $sub_mpr_no_network (i32.const 5)))

  (func $handle_WNetAddConnection2W (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_WNetAddConnection2A
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr)))

  ;; WNetCancelConnection2A(lpName, dwFlags, fForce).  With no current or
  ;; remembered connection, the supplied name is necessarily not connected.
  (func $handle_WNetCancelConnection2A (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                       (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $sub_mpr_no_network (i32.const 6)))

  ;; WNetGetConnectionA(lpLocalName, lpRemoteName, lpnLength) and
  ;; WNetGetUniversalNameA(lpLocalPath, dwInfoLevel, lpBuffer, lpBufferSize).
  ;; ERROR_NO_NETWORK is documented for both and describes the unavailable
  ;; provider state more precisely than fabricating an unmapped-drive result.
  (func $handle_WNetGetConnectionA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                   (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $sub_mpr_no_network (i32.const 7)))

  (func $handle_WNetGetUniversalNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $sub_mpr_no_network (i32.const 8)))

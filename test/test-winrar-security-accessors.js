#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (global $security_test_esp_after (mut i32) (i32.const 0))

  (func $security_test_begin
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x07000000)))
  (func $security_test_end
    (global.set $security_test_esp_after (i32.load offset=16 (global.get $reg_base))))
  (func (export "test_esp_after") (result i32)
    (global.get $security_test_esp_after))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))

  (func (export "test_IsValidSid") (param $sid i32) (result i32)
    (call $security_test_begin)
    (call $handle_IsValidSid (local.get $sid) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $security_test_end) (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_IsValidAcl") (param $acl i32) (result i32)
    (call $security_test_begin)
    (call $handle_IsValidAcl (local.get $acl) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $security_test_end) (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_IsValidSecurityDescriptor") (param $sd i32) (result i32)
    (call $security_test_begin)
    (call $handle_IsValidSecurityDescriptor (local.get $sd) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (call $security_test_end) (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_GetSecurityDescriptorControl")
      (param $sd i32) (param $control i32) (param $revision i32) (result i32)
    (call $security_test_begin)
    (call $handle_GetSecurityDescriptorControl
      (local.get $sd) (local.get $control) (local.get $revision)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $security_test_end) (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_GetSecurityDescriptorLength") (param $sd i32) (result i32)
    (call $security_test_begin)
    (call $handle_GetSecurityDescriptorLength (local.get $sd) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (call $security_test_end) (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_GetSecurityDescriptorOwner")
      (param $sd i32) (param $owner i32) (param $defaulted i32) (result i32)
    (call $security_test_begin)
    (call $handle_GetSecurityDescriptorOwner
      (local.get $sd) (local.get $owner) (local.get $defaulted)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $security_test_end) (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_GetSecurityDescriptorGroup")
      (param $sd i32) (param $group i32) (param $defaulted i32) (result i32)
    (call $security_test_begin)
    (call $handle_GetSecurityDescriptorGroup
      (local.get $sd) (local.get $group) (local.get $defaulted)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $security_test_end) (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_GetSecurityDescriptorDacl")
      (param $sd i32) (param $present i32) (param $acl i32)
      (param $defaulted i32) (result i32)
    (call $security_test_begin)
    (call $handle_GetSecurityDescriptorDacl
      (local.get $sd) (local.get $present) (local.get $acl)
      (local.get $defaulted) (i32.const 0) (i32.const 0))
    (call $security_test_end) (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_GetSecurityDescriptorSacl")
      (param $sd i32) (param $present i32) (param $acl i32)
      (param $defaulted i32) (result i32)
    (call $security_test_begin)
    (call $handle_GetSecurityDescriptorSacl
      (local.get $sd) (local.get $present) (local.get $acl)
      (local.get $defaulted) (i32.const 0) (i32.const 0))
    (call $security_test_end) (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const SENTINEL = 0x5a5aa5a5;
  const LAST_ERROR = 0x12345678;
  const out = e.guest_alloc(32) >>> 0;
  const dword = offset => e.guest_read32(out + offset) >>> 0;
  const word = offset => dword(offset) & 0xffff;
  const fillOut = () => {
    for (let offset = 0; offset < 32; offset += 4)
      e.guest_write32(out + offset, SENTINEL);
  };
  const expectEsp = value => assert.strictEqual(e.test_esp_after() >>> 0, value >>> 0);

  const makeSid = subAuthorities => {
    const sid = e.guest_alloc(8 + subAuthorities.length * 4) >>> 0;
    e.guest_write8(sid, 1);
    e.guest_write8(sid + 1, subAuthorities.length);
    e.guest_write8(sid + 7, 5);
    subAuthorities.forEach((value, index) => e.guest_write32(sid + 8 + index * 4, value));
    return sid;
  };
  const makeAcl = (size = 32, aceSize = 0) => {
    const acl = e.guest_alloc(size) >>> 0;
    e.guest_write8(acl, 2);
    e.guest_write16(acl + 2, size);
    e.guest_write16(acl + 4, aceSize ? 1 : 0);
    if (aceSize) {
      e.guest_write8(acl + 8, 0);
      e.guest_write16(acl + 10, aceSize);
      e.guest_write8(acl + 16, 1);
      e.guest_write8(acl + 17, (aceSize - 16) / 4);
      e.guest_write8(acl + 23, 5);
    }
    return acl;
  };

  const owner = makeSid([32, 544]);
  const group = makeSid([18]);
  const dacl = makeAcl(32, 24);
  const sacl = makeAcl(8);
  const sd = e.guest_alloc(20) >>> 0;
  e.guest_write8(sd, 1);
  e.guest_write16(sd + 2, 0x003f);
  e.guest_write32(sd + 4, owner);
  e.guest_write32(sd + 8, group);
  e.guest_write32(sd + 12, sacl);
  e.guest_write32(sd + 16, dacl);

  e.test_set_last_error(LAST_ERROR);
  assert.strictEqual(e.test_IsValidSid(owner), 1);
  expectEsp(0x07000008);
  assert.strictEqual(e.test_IsValidAcl(dacl), 1);
  expectEsp(0x07000008);
  assert.strictEqual(e.test_IsValidSecurityDescriptor(sd), 1);
  expectEsp(0x07000008);
  assert.strictEqual(e.test_get_last_error() >>> 0, LAST_ERROR,
    'IsValid* does not manufacture extended error information');

  fillOut();
  assert.strictEqual(e.test_GetSecurityDescriptorControl(sd, out, out + 4), 1);
  assert.strictEqual(word(0), 0x003f);
  assert.strictEqual(dword(4), 1);
  expectEsp(0x07000010);
  assert.strictEqual(e.test_GetSecurityDescriptorLength(sd), 88,
    'absolute length includes the 20-byte header and all associated structures');
  expectEsp(0x07000008);

  fillOut();
  assert.strictEqual(e.test_GetSecurityDescriptorOwner(sd, out, out + 4), 1);
  assert.strictEqual(dword(0), owner);
  assert.strictEqual(dword(4), 1);
  assert.strictEqual(e.test_GetSecurityDescriptorGroup(sd, out + 8, out + 12), 1);
  assert.strictEqual(dword(8), group);
  assert.strictEqual(dword(12), 1);
  expectEsp(0x07000010);

  fillOut();
  assert.strictEqual(e.test_GetSecurityDescriptorDacl(sd, out, out + 4, out + 8), 1);
  assert.deepStrictEqual([dword(0), dword(4), dword(8)], [1, dacl, 1]);
  expectEsp(0x07000014);
  assert.strictEqual(e.test_GetSecurityDescriptorSacl(sd, out + 12, out + 16, out + 20), 1);
  assert.deepStrictEqual([dword(12), dword(16), dword(20)], [1, sacl, 1]);
  expectEsp(0x07000014);

  const empty = e.guest_alloc(20) >>> 0;
  e.guest_write8(empty, 1);
  fillOut();
  assert.strictEqual(e.test_GetSecurityDescriptorDacl(empty, out, out + 4, out + 8), 1);
  assert.deepStrictEqual([dword(0), dword(4), dword(8)], [0, SENTINEL, SENTINEL],
    'an absent ACL defines only Present');
  assert.strictEqual(e.test_GetSecurityDescriptorOwner(empty, out + 12, out + 16), 1);
  assert.deepStrictEqual([dword(12), dword(16)], [0, SENTINEL],
    'an absent owner clears its pointer and leaves Defaulted ignored');

  const relative = e.guest_alloc(80) >>> 0;
  for (let offset = 0; offset < 80; offset++) e.guest_write8(relative + offset, 0);
  e.guest_write8(relative, 1);
  e.guest_write16(relative + 2, 0x803f);
  e.guest_write32(relative + 4, 20);
  e.guest_write32(relative + 8, 36);
  e.guest_write32(relative + 12, 48);
  e.guest_write32(relative + 16, 56);
  // S-1-5-32-544 at +20, S-1-5-18 at +36.
  e.guest_write8(relative + 20, 1);
  e.guest_write8(relative + 21, 2);
  e.guest_write8(relative + 27, 5);
  e.guest_write32(relative + 28, 32);
  e.guest_write32(relative + 32, 544);
  e.guest_write8(relative + 36, 1);
  e.guest_write8(relative + 37, 1);
  e.guest_write8(relative + 43, 5);
  e.guest_write32(relative + 44, 18);
  e.guest_write8(relative + 48, 2);
  e.guest_write16(relative + 50, 8);
  e.guest_write8(relative + 56, 2);
  e.guest_write16(relative + 58, 24);

  assert.strictEqual(e.test_IsValidSecurityDescriptor(relative), 1);
  assert.strictEqual(e.test_GetSecurityDescriptorLength(relative), 80,
    'self-relative length is the furthest validated component end');
  fillOut();
  assert.strictEqual(e.test_GetSecurityDescriptorOwner(relative, out, out + 4), 1);
  assert.strictEqual(dword(0), relative + 20);
  assert.strictEqual(e.test_GetSecurityDescriptorGroup(relative, out + 8, out + 12), 1);
  assert.strictEqual(dword(8), relative + 36);
  assert.strictEqual(e.test_GetSecurityDescriptorSacl(relative, out + 16, out + 20, out + 24), 1);
  assert.strictEqual(dword(20), relative + 48);
  assert.strictEqual(e.test_GetSecurityDescriptorDacl(relative, out + 16, out + 20, out + 24), 1);
  assert.strictEqual(dword(20), relative + 56);

  const badSid = makeSid([]);
  e.guest_write8(badSid, 2);
  assert.strictEqual(e.test_IsValidSid(badSid), 0, 'SID revision is checked');
  e.guest_write8(badSid, 1);
  e.guest_write8(badSid + 1, 16);
  assert.strictEqual(e.test_IsValidSid(badSid), 0, 'SID length is bounded by the maximum count');
  assert.strictEqual(e.test_IsValidSid(0x90000000), 0, 'an unmapped SID is rejected safely');

  const badAcl = makeAcl(24, 16);
  e.guest_write16(badAcl + 10, 20);
  assert.strictEqual(e.test_IsValidAcl(badAcl), 0, 'an ACE cannot exceed AclSize');
  e.guest_write16(badAcl + 10, 16);
  assert.strictEqual(e.test_IsValidAcl(badAcl), 1);
  e.guest_write8(badAcl + 16, 2);
  assert.strictEqual(e.test_IsValidAcl(badAcl), 0, 'a malformed embedded SID invalidates its ACE');
  e.guest_write8(badAcl + 16, 1);
  e.guest_write8(badAcl + 8, 4);
  assert.strictEqual(e.test_IsValidAcl(badAcl), 0, 'unmodeled post-Win98 ACE layouts are rejected');
  e.guest_write8(badAcl + 8, 0);
  e.guest_write8(badAcl, 3);
  assert.strictEqual(e.test_IsValidAcl(badAcl), 0, 'unknown ACL revisions are rejected');
  const aclWithApplicationData = makeAcl(28, 20);
  e.guest_write8(aclWithApplicationData + 17, 0);
  assert.strictEqual(e.test_IsValidAcl(aclWithApplicationData), 1,
    'a bounded SID may be followed by documented ACE application data');
  assert.strictEqual(e.test_IsValidAcl(0x90000000), 0, 'an unmapped ACL is rejected safely');

  const unalignedSid = (e.guest_alloc(9) + 1) >>> 0;
  e.guest_write8(unalignedSid, 1);
  e.guest_write8(unalignedSid + 1, 0);
  assert.strictEqual(e.test_IsValidSid(unalignedSid), 1,
    'x86 permits a valid standalone SID at an unaligned address');
  const unalignedAcl = (e.guest_alloc(9) + 1) >>> 0;
  e.guest_write8(unalignedAcl, 2);
  e.guest_write16(unalignedAcl + 2, 8);
  e.guest_write16(unalignedAcl + 4, 0);
  assert.strictEqual(e.test_IsValidAcl(unalignedAcl), 1,
    'x86 permits a valid standalone ACL at an unaligned address');
  const unalignedSd = (e.guest_alloc(21) + 1) >>> 0;
  e.guest_write8(unalignedSd, 1);
  e.guest_write16(unalignedSd + 2, 4);
  e.guest_write32(unalignedSd + 16, unalignedAcl);
  assert.strictEqual(e.test_IsValidSecurityDescriptor(unalignedSd), 1,
    'absolute descriptors and their pointers do not invent alignment failures');

  e.guest_write32(relative + 4, 4);
  assert.strictEqual(e.test_IsValidSecurityDescriptor(relative), 0,
    'self-relative component offsets cannot point inside the header');
  fillOut();
  e.test_set_last_error(LAST_ERROR);
  assert.strictEqual(e.test_GetSecurityDescriptorDacl(relative, out, out + 4, out + 8), 0);
  assert.deepStrictEqual([dword(0), dword(4), dword(8)], [SENTINEL, SENTINEL, SENTINEL],
    'failed multi-output access is atomic');
  assert.strictEqual(e.test_get_last_error(), 87);

  // GetSecurityDescriptorControl is the documented exception: Revision is
  // returned even when a component makes the descriptor invalid.
  fillOut();
  assert.strictEqual(e.test_GetSecurityDescriptorControl(relative, out, out + 4), 0);
  assert.strictEqual(word(0), SENTINEL & 0xffff);
  assert.strictEqual(dword(4), 1);
  fillOut();
  assert.strictEqual(e.test_GetSecurityDescriptorDacl(sd, 0x90000000, out + 4, out + 8), 0);
  assert.strictEqual(dword(4), SENTINEL, 'invalid output pointers do not partially write peers');

  console.log('PASS  WinRAR security descriptor/SID/ACL accessors are bounded and stateful');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

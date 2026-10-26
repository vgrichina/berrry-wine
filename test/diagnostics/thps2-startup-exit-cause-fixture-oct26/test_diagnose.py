import unittest, struct
from diagnose import PE, stack_route

class DiagnosticTests(unittest.TestCase):
    def test_section_translation_and_zero_fill_rejection(self):
        # Nonidentity RVA/raw offsets catch the deceptively correct RVA==raw .text case.
        b=bytearray(0x600); b[:2]=b'MZ';struct.pack_into('<I',b,0x3c,0x80);b[0x80:0x84]=b'PE\0\0'
        struct.pack_into('<H',b,0x86,1);struct.pack_into('<H',b,0x94,224)
        struct.pack_into('<H',b,0x98,0x10b);struct.pack_into('<I',b,0x98+28,0x400000);struct.pack_into('<I',b,0x98+60,0x200)
        s=0x98+224;b[s:s+8]=b'.test\0\0\0';struct.pack_into('<IIII',b,s+8,0x800,0x3000,0x200,0x400)
        p=PE(b);self.assertEqual(p.off(0x403040),0x440)
        self.assertEqual(p.off(0x400100),0x100)
        for a,n in [(0x403200,1),(0x4031ff,2),(0x402fff,1),(0x3fffff,1)]:
            with self.assertRaises(ValueError):p.off(a,n)
    def frame(self,caller,quick=0):
        return struct.pack('<9I',0x4f03dc,1,0,0x4f0317 if quick else 0x4f0306,1,quick,0,caller,1)
    def test_distinct_original_callers_have_same_observed_exit(self):
        a=self.frame(0x4f20d9);b=self.frame(0x4c63bc)
        self.assertEqual(a[:8],b[:8]);self.assertNotEqual(stack_route(a),stack_route(b))
        self.assertEqual(stack_route(a)['callerReturn'],'0x4f20d9')
    def test_quick_exit_is_distinct(self):self.assertEqual(stack_route(self.frame(0x4f20f8,1))['route'],'_exit')
    def test_reject_wrong_invocation_and_inconsistent_arguments(self):
        for o,v in [(0,0x1234),(4,0),(16,2),(20,1),(24,1)]:
            b=bytearray(self.frame(0x4f20d9));struct.pack_into('<I',b,o,v)
            with self.assertRaises(ValueError):stack_route(b)
        with self.assertRaises(ValueError):stack_route(b'')
    def test_unknown_stack_stays_unclassified(self):
        b=bytearray(self.frame(0x4f20d9));struct.pack_into('<I',b,12,0x123456)
        self.assertIn('unclassified',stack_route(b)['route'])

if __name__=='__main__':unittest.main()

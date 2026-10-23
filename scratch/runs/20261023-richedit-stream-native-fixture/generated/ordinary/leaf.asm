
/home/user/wine-assembly-rich-edit-native-callback-fixture-oct23/scratch/runs/20261023-richedit-stream-native-fixture/generated/ordinary/leaf.bin:     file format binary


Disassembly of section .data:

00402800 <.data>:
  402800:	ff 05 14 18 40 00                               	inc    DWORD PTR ds:0x401814
  402806:	83 3d 14 18 40 00 01                            	cmp    DWORD PTR ds:0x401814,0x1
  40280d:	0f 85 19 00 00 00                               	jne    0x40282c
  402813:	8b 44 24 08                                     	mov    eax,DWORD PTR [esp+0x8]
  402817:	c7 00 69 6e 00 00                               	mov    DWORD PTR [eax],0x6e69
  40281d:	8b 44 24 10                                     	mov    eax,DWORD PTR [esp+0x10]
  402821:	c7 00 02 00 00 00                               	mov    DWORD PTR [eax],0x2
  402827:	e9 0a 00 00 00                                  	jmp    0x402836
  40282c:	8b 44 24 10                                     	mov    eax,DWORD PTR [esp+0x10]
  402830:	c7 00 00 00 00 00                               	mov    DWORD PTR [eax],0x0
  402836:	b9 01 01 00 44                                  	mov    ecx,0x44000101
  40283b:	ba 02 02 00 44                                  	mov    edx,0x44000202
  402840:	bb 03 03 00 44                                  	mov    ebx,0x44000303
  402845:	bd 05 05 00 44                                  	mov    ebp,0x44000505
  40284a:	be 06 06 00 44                                  	mov    esi,0x44000606
  40284f:	bf 07 07 00 44                                  	mov    edi,0x44000707
  402854:	b8 00 00 00 00                                  	mov    eax,0x0
  402859:	c2 10 00                                        	ret    0x10

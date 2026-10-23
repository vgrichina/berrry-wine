
/home/user/wine-assembly-rich-edit-native-callback-fixture-oct23/scratch/runs/20261023-richedit-stream-native-fixture/generated/ordinary/callback.bin:     file format binary


Disassembly of section .data:

00402400 <.data>:
  402400:	ff 05 10 18 40 00                               	inc    DWORD PTR ds:0x401810
  402406:	8b 44 24 00                                     	mov    eax,DWORD PTR [esp+0x0]
  40240a:	89 05 80 18 40 00                               	mov    DWORD PTR ds:0x401880,eax
  402410:	8b 44 24 04                                     	mov    eax,DWORD PTR [esp+0x4]
  402414:	89 05 84 18 40 00                               	mov    DWORD PTR ds:0x401884,eax
  40241a:	8b 44 24 08                                     	mov    eax,DWORD PTR [esp+0x8]
  40241e:	89 05 88 18 40 00                               	mov    DWORD PTR ds:0x401888,eax
  402424:	8b 44 24 0c                                     	mov    eax,DWORD PTR [esp+0xc]
  402428:	89 05 8c 18 40 00                               	mov    DWORD PTR ds:0x40188c,eax
  40242e:	8b 44 24 10                                     	mov    eax,DWORD PTR [esp+0x10]
  402432:	89 05 90 18 40 00                               	mov    DWORD PTR ds:0x401890,eax
  402438:	83 3d 10 18 40 00 01                            	cmp    DWORD PTR ds:0x401810,0x1
  40243f:	0f 85 19 00 00 00                               	jne    0x40245e
  402445:	8b 44 24 08                                     	mov    eax,DWORD PTR [esp+0x8]
  402449:	c7 00 4f 57 4e 00                               	mov    DWORD PTR [eax],0x4e574f
  40244f:	8b 44 24 10                                     	mov    eax,DWORD PTR [esp+0x10]
  402453:	c7 00 03 00 00 00                               	mov    DWORD PTR [eax],0x3
  402459:	e9 0a 00 00 00                                  	jmp    0x402468
  40245e:	8b 44 24 10                                     	mov    eax,DWORD PTR [esp+0x10]
  402462:	c7 00 00 00 00 00                               	mov    DWORD PTR [eax],0x0
  402468:	b9 01 01 00 44                                  	mov    ecx,0x44000101
  40246d:	ba 02 02 00 44                                  	mov    edx,0x44000202
  402472:	bb 03 03 00 44                                  	mov    ebx,0x44000303
  402477:	bd 05 05 00 44                                  	mov    ebp,0x44000505
  40247c:	be 06 06 00 44                                  	mov    esi,0x44000606
  402481:	bf 07 07 00 44                                  	mov    edi,0x44000707
  402486:	b8 00 00 00 00                                  	mov    eax,0x0
  40248b:	c2 10 00                                        	ret    0x10

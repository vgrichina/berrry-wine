
/home/user/wine-assembly-rich-edit-native-callback-fixture-oct23/scratch/runs/20261023-richedit-stream-native-fixture/generated/nested/callback.bin:     file format binary


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
  40243f:	0f 85 a5 00 00 00                               	jne    0x4024ea
  402445:	68 fe 0f ac 51                                  	push   0x51ac0ffe
  40244a:	b9 01 01 00 33                                  	mov    ecx,0x33000101
  40244f:	ba 02 02 00 33                                  	mov    edx,0x33000202
  402454:	bb 03 03 00 33                                  	mov    ebx,0x33000303
  402459:	bd 05 05 00 33                                  	mov    ebp,0x33000505
  40245e:	be 06 06 00 33                                  	mov    esi,0x33000606
  402463:	bf 07 07 00 33                                  	mov    edi,0x33000707
  402468:	89 05 00 19 40 00                               	mov    DWORD PTR ds:0x401900,eax
  40246e:	89 0d 04 19 40 00                               	mov    DWORD PTR ds:0x401904,ecx
  402474:	89 15 08 19 40 00                               	mov    DWORD PTR ds:0x401908,edx
  40247a:	89 1d 0c 19 40 00                               	mov    DWORD PTR ds:0x40190c,ebx
  402480:	89 25 10 19 40 00                               	mov    DWORD PTR ds:0x401910,esp
  402486:	89 2d 14 19 40 00                               	mov    DWORD PTR ds:0x401914,ebp
  40248c:	89 35 18 19 40 00                               	mov    DWORD PTR ds:0x401918,esi
  402492:	89 3d 1c 19 40 00                               	mov    DWORD PTR ds:0x40191c,edi
  402498:	68 60 18 40 00                                  	push   0x401860
  40249d:	68 01 00 00 00                                  	push   0x1
  4024a2:	68 49 04 00 00                                  	push   0x449
  4024a7:	ff 35 08 18 40 00                               	push   DWORD PTR ds:0x401808
  4024ad:	ff 15 38 14 40 00                               	call   DWORD PTR ds:0x401438
  4024b3:	89 05 20 19 40 00                               	mov    DWORD PTR ds:0x401920,eax
  4024b9:	89 0d 24 19 40 00                               	mov    DWORD PTR ds:0x401924,ecx
  4024bf:	89 15 28 19 40 00                               	mov    DWORD PTR ds:0x401928,edx
  4024c5:	89 1d 2c 19 40 00                               	mov    DWORD PTR ds:0x40192c,ebx
  4024cb:	89 25 30 19 40 00                               	mov    DWORD PTR ds:0x401930,esp
  4024d1:	89 2d 34 19 40 00                               	mov    DWORD PTR ds:0x401934,ebp
  4024d7:	89 35 38 19 40 00                               	mov    DWORD PTR ds:0x401938,esi
  4024dd:	89 3d 3c 19 40 00                               	mov    DWORD PTR ds:0x40193c,edi
  4024e3:	58                                              	pop    eax
  4024e4:	89 05 18 18 40 00                               	mov    DWORD PTR ds:0x401818,eax
  4024ea:	83 3d 10 18 40 00 01                            	cmp    DWORD PTR ds:0x401810,0x1
  4024f1:	0f 85 19 00 00 00                               	jne    0x402510
  4024f7:	8b 44 24 08                                     	mov    eax,DWORD PTR [esp+0x8]
  4024fb:	c7 00 4f 57 4e 00                               	mov    DWORD PTR [eax],0x4e574f
  402501:	8b 44 24 10                                     	mov    eax,DWORD PTR [esp+0x10]
  402505:	c7 00 03 00 00 00                               	mov    DWORD PTR [eax],0x3
  40250b:	e9 0a 00 00 00                                  	jmp    0x40251a
  402510:	8b 44 24 10                                     	mov    eax,DWORD PTR [esp+0x10]
  402514:	c7 00 00 00 00 00                               	mov    DWORD PTR [eax],0x0
  40251a:	b9 01 01 00 44                                  	mov    ecx,0x44000101
  40251f:	ba 02 02 00 44                                  	mov    edx,0x44000202
  402524:	bb 03 03 00 44                                  	mov    ebx,0x44000303
  402529:	bd 05 05 00 44                                  	mov    ebp,0x44000505
  40252e:	be 06 06 00 44                                  	mov    esi,0x44000606
  402533:	bf 07 07 00 44                                  	mov    edi,0x44000707
  402538:	b8 00 00 00 00                                  	mov    eax,0x0
  40253d:	c2 10 00                                        	ret    0x10

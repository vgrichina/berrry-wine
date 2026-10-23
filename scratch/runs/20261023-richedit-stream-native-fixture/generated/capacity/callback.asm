
/home/user/wine-assembly-rich-edit-native-callback-fixture-oct23/scratch/runs/20261023-richedit-stream-native-fixture/generated/capacity/callback.bin:     file format binary


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
  402438:	89 e0                                           	mov    eax,esp
  40243a:	83 e8 28                                        	sub    eax,0x28
  40243d:	89 05 20 18 40 00                               	mov    DWORD PTR ds:0x401820,eax
  402443:	89 e0                                           	mov    eax,esp
  402445:	83 e8 14                                        	sub    eax,0x14
  402448:	89 05 24 18 40 00                               	mov    DWORD PTR ds:0x401824,eax
  40244e:	c7 44 24 d8 fe 0f ac 51                         	mov    DWORD PTR [esp-0x28],0x51ac0ffe
  402456:	c7 44 24 dc ff 0f ac 51                         	mov    DWORD PTR [esp-0x24],0x51ac0fff
  40245e:	c7 44 24 e0 00 10 ac 51                         	mov    DWORD PTR [esp-0x20],0x51ac1000
  402466:	c7 44 24 e4 01 10 ac 51                         	mov    DWORD PTR [esp-0x1c],0x51ac1001
  40246e:	c7 44 24 e8 02 10 ac 51                         	mov    DWORD PTR [esp-0x18],0x51ac1002
  402476:	68 40 18 40 00                                  	push   0x401840
  40247b:	68 01 00 00 00                                  	push   0x1
  402480:	68 49 04 00 00                                  	push   0x449
  402485:	ff 35 04 18 40 00                               	push   DWORD PTR ds:0x401804
  40248b:	ff 15 38 14 40 00                               	call   DWORD PTR ds:0x401438
  402491:	ff 05 1c 18 40 00                               	inc    DWORD PTR ds:0x40181c
  402497:	cc                                              	int3

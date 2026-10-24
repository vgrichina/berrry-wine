
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00411410 <.text+0x10410>:
  411410:	56                   	push   esi
  411411:	8b f1                	mov    esi,ecx
  411413:	57                   	push   edi
  411414:	33 ff                	xor    edi,edi
  411416:	39 7e 5c             	cmp    DWORD PTR [esi+0x5c],edi
  411419:	75 06                	jne    0x411421
  41141b:	5f                   	pop    edi
  41141c:	83 c8 ff             	or     eax,0xffffffff
  41141f:	5e                   	pop    esi
  411420:	c3                   	ret
  411421:	c7 46 20 01 00 00 00 	mov    DWORD PTR [esi+0x20],0x1
  411428:	c7 46 24 01 00 00 00 	mov    DWORD PTR [esi+0x24],0x1
  41142f:	a1 e4 f8 41 00       	mov    eax,ds:0x41f8e4
  411434:	8b c8                	mov    ecx,eax
  411436:	89 46 40             	mov    DWORD PTR [esi+0x40],eax
  411439:	8b 41 04             	mov    eax,DWORD PTR [ecx+0x4]
  41143c:	3b c7                	cmp    eax,edi
  41143e:	b8 10 00 00 00       	mov    eax,0x10
  411443:	75 05                	jne    0x41144a
  411445:	b8 20 00 00 00       	mov    eax,0x20
  41144a:	8b 16                	mov    edx,DWORD PTR [esi]
  41144c:	68 e8 03 00 00       	push   0x3e8
  411451:	8b ce                	mov    ecx,esi
  411453:	89 46 1c             	mov    DWORD PTR [esi+0x1c],eax
  411456:	89 46 18             	mov    DWORD PTR [esi+0x18],eax
  411459:	ff 52 0c             	call   DWORD PTR [edx+0xc]
  41145c:	8b 06                	mov    eax,DWORD PTR [esi]
  41145e:	6a 03                	push   0x3
  411460:	8b ce                	mov    ecx,esi
  411462:	ff 50 10             	call   DWORD PTR [eax+0x10]
  411465:	8b 16                	mov    edx,DWORD PTR [esi]
  411467:	89 7e 78             	mov    DWORD PTR [esi+0x78],edi
  41146a:	c7 46 74 5a 00 00 00 	mov    DWORD PTR [esi+0x74],0x5a
  411471:	c7 46 7c 3c 00 00 00 	mov    DWORD PTR [esi+0x7c],0x3c
  411478:	c7 86 80 00 00 00 01 	mov    DWORD PTR [esi+0x80],0x1
  41147f:	00 00 00
  411482:	89 be 84 00 00 00    	mov    DWORD PTR [esi+0x84],edi
  411488:	89 7e 14             	mov    DWORD PTR [esi+0x14],edi
  41148b:	89 7e 10             	mov    DWORD PTR [esi+0x10],edi
  41148e:	89 be 88 00 00 00    	mov    DWORD PTR [esi+0x88],edi
  411494:	89 be 94 00 00 00    	mov    DWORD PTR [esi+0x94],edi
  41149a:	8b 0d f0 f8 41 00    	mov    ecx,DWORD PTR ds:0x41f8f0
  4114a0:	6a ff                	push   0xffffffff
  4114a2:	89 8e 90 00 00 00    	mov    DWORD PTR [esi+0x90],ecx
  4114a8:	8b ce                	mov    ecx,esi
  4114aa:	89 be 98 00 00 00    	mov    DWORD PTR [esi+0x98],edi
  4114b0:	89 be 9c 00 00 00    	mov    DWORD PTR [esi+0x9c],edi
  4114b6:	89 be a0 00 00 00    	mov    DWORD PTR [esi+0xa0],edi
  4114bc:	89 7e 34             	mov    DWORD PTR [esi+0x34],edi
  4114bf:	c7 46 38 ff ff ff ff 	mov    DWORD PTR [esi+0x38],0xffffffff
  4114c6:	89 be ac 00 00 00    	mov    DWORD PTR [esi+0xac],edi
  4114cc:	89 7e 54             	mov    DWORD PTR [esi+0x54],edi
  4114cf:	ff 52 14             	call   DWORD PTR [edx+0x14]
  4114d2:	39 3d d4 f9 41 00    	cmp    DWORD PTR ds:0x41f9d4,edi
  4114d8:	75 03                	jne    0x4114dd
  4114da:	ff 4e 5c             	dec    DWORD PTR [esi+0x5c]
  4114dd:	8b 46 5c             	mov    eax,DWORD PTR [esi+0x5c]
  4114e0:	5f                   	pop    edi
  4114e1:	5e                   	pop    esi
  4114e2:	c3                   	ret


/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00411300 <.text+0x10300>:
  411300:	b8 01 00 00 00       	mov    eax,0x1
  411305:	56                   	push   esi
  411306:	89 81 a8 00 00 00    	mov    DWORD PTR [ecx+0xa8],eax
  41130c:	8b 35 d4 f9 41 00    	mov    esi,DWORD PTR ds:0x41f9d4
  411312:	33 d2                	xor    edx,edx
  411314:	3b f2                	cmp    esi,edx
  411316:	5e                   	pop    esi
  411317:	75 04                	jne    0x41131d
  411319:	8b 44 24 04          	mov    eax,DWORD PTR [esp+0x4]
  41131d:	89 51 60             	mov    DWORD PTR [ecx+0x60],edx
  411320:	89 51 64             	mov    DWORD PTR [ecx+0x64],edx
  411323:	88 91 a4 00 00 00    	mov    BYTE PTR [ecx+0xa4],dl
  411329:	8b 11                	mov    edx,DWORD PTR [ecx]
  41132b:	89 41 5c             	mov    DWORD PTR [ecx+0x5c],eax
  41132e:	ff 92 80 00 00 00    	call   DWORD PTR [edx+0x80]
  411334:	c2 04 00             	ret    0x4
  411337:	90                   	nop
  411338:	90                   	nop
  411339:	90                   	nop
  41133a:	90                   	nop
  41133b:	90                   	nop
  41133c:	90                   	nop
  41133d:	90                   	nop
  41133e:	90                   	nop
  41133f:	90                   	nop
  411340:	56                   	push   esi
  411341:	8b f1                	mov    esi,ecx
  411343:	57                   	push   edi
  411344:	33 ff                	xor    edi,edi
  411346:	39 7e 54             	cmp    DWORD PTR [esi+0x54],edi
  411349:	75 11                	jne    0x41135c
  41134b:	8b 06                	mov    eax,DWORD PTR [esi]
  41134d:	ff 50 08             	call   DWORD PTR [eax+0x8]
  411350:	85 c0                	test   eax,eax
  411352:	75 1b                	jne    0x41136f
  411354:	39 be a8 00 00 00    	cmp    DWORD PTR [esi+0xa8],edi
  41135a:	74 13                	je     0x41136f
  41135c:	8b 16                	mov    edx,DWORD PTR [esi]
  41135e:	6a 01                	push   0x1
  411360:	8b ce                	mov    ecx,esi
  411362:	ff 52 70             	call   DWORD PTR [edx+0x70]
  411365:	8b 06                	mov    eax,DWORD PTR [esi]
  411367:	8b ce                	mov    ecx,esi
  411369:	ff 90 80 00 00 00    	call   DWORD PTR [eax+0x80]
  41136f:	c7 46 68 d0 07 00 00 	mov    DWORD PTR [esi+0x68],0x7d0
  411376:	c7 46 6c 01 00 00 00 	mov    DWORD PTR [esi+0x6c],0x1
  41137d:	c7 46 70 0f 00 00 00 	mov    DWORD PTR [esi+0x70],0xf
  411384:	89 7e 78             	mov    DWORD PTR [esi+0x78],edi
  411387:	c7 46 7c 3c 00 00 00 	mov    DWORD PTR [esi+0x7c],0x3c
  41138e:	89 be 80 00 00 00    	mov    DWORD PTR [esi+0x80],edi
  411394:	89 be 84 00 00 00    	mov    DWORD PTR [esi+0x84],edi
  41139a:	a1 fc f9 41 00       	mov    eax,ds:0x41f9fc
  41139f:	8b 4e 58             	mov    ecx,DWORD PTR [esi+0x58]
  4113a2:	53                   	push   ebx
  4113a3:	99                   	cdq
  4113a4:	2b c2                	sub    eax,edx
  4113a6:	8b 1e                	mov    ebx,DWORD PTR [esi]
  4113a8:	d1 f8                	sar    eax,1
  4113aa:	2b c8                	sub    ecx,eax
  4113ac:	68 00 0f 00 00       	push   0xf00
  4113b1:	83 c1 05             	add    ecx,0x5
  4113b4:	c1 e1 0a             	shl    ecx,0xa
  4113b7:	51                   	push   ecx
  4113b8:	8b ce                	mov    ecx,esi
  4113ba:	ff 53 40             	call   DWORD PTR [ebx+0x40]
  4113bd:	89 7e 14             	mov    DWORD PTR [esi+0x14],edi
  4113c0:	89 7e 10             	mov    DWORD PTR [esi+0x10],edi
  4113c3:	89 be 88 00 00 00    	mov    DWORD PTR [esi+0x88],edi
  4113c9:	89 be 8c 00 00 00    	mov    DWORD PTR [esi+0x8c],edi
  4113cf:	8b 15 f0 f8 41 00    	mov    edx,DWORD PTR ds:0x41f8f0
  4113d5:	89 be 98 00 00 00    	mov    DWORD PTR [esi+0x98],edi
  4113db:	89 be 9c 00 00 00    	mov    DWORD PTR [esi+0x9c],edi
  4113e1:	89 be a0 00 00 00    	mov    DWORD PTR [esi+0xa0],edi
  4113e7:	89 7e 34             	mov    DWORD PTR [esi+0x34],edi
  4113ea:	8b be 04 01 00 00    	mov    edi,DWORD PTR [esi+0x104]
  4113f0:	4f                   	dec    edi
  4113f1:	89 96 90 00 00 00    	mov    DWORD PTR [esi+0x90],edx
  4113f7:	5b                   	pop    ebx
  4113f8:	78 0b                	js     0x411405
  4113fa:	57                   	push   edi
  4113fb:	8b ce                	mov    ecx,esi
  4113fd:	e8 1e 14 00 00       	call   0x412820
  411402:	4f                   	dec    edi
  411403:	79 f5                	jns    0x4113fa
  411405:	5f                   	pop    edi
  411406:	5e                   	pop    esi
  411407:	c3                   	ret

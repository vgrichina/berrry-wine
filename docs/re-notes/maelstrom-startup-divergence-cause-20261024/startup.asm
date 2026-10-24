
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

004173e0 <.text+0x163e0>:
  4173e0:	8b c1                	mov    eax,ecx
  4173e2:	99                   	cdq
  4173e3:	83 e2 07             	and    edx,0x7
  4173e6:	d3 eb                	shr    ebx,cl
  4173e8:	03 c2                	add    eax,edx
  4173ea:	c1 f8 03             	sar    eax,0x3
  4173ed:	88 1c 28             	mov    BYTE PTR [eax+ebp*1],bl
  4173f0:	5d                   	pop    ebp
  4173f1:	5b                   	pop    ebx
  4173f2:	c3                   	ret
  4173f3:	90                   	nop
  4173f4:	90                   	nop
  4173f5:	90                   	nop
  4173f6:	90                   	nop
  4173f7:	90                   	nop
  4173f8:	90                   	nop
  4173f9:	90                   	nop
  4173fa:	90                   	nop
  4173fb:	90                   	nop
  4173fc:	90                   	nop
  4173fd:	90                   	nop
  4173fe:	90                   	nop
  4173ff:	90                   	nop
  417400:	8b 4c 24 04          	mov    ecx,DWORD PTR [esp+0x4]
  417404:	8b 44 24 0c          	mov    eax,DWORD PTR [esp+0xc]
  417408:	89 01                	mov    DWORD PTR [ecx],eax
  41740a:	c3                   	ret
  41740b:	90                   	nop
  41740c:	90                   	nop
  41740d:	90                   	nop
  41740e:	90                   	nop
  41740f:	90                   	nop
  417410:	ff 25 a8 90 41 00    	jmp    DWORD PTR ds:0x4190a8
  417416:	ff 25 ac 90 41 00    	jmp    DWORD PTR ds:0x4190ac
  41741c:	ff 25 1c 90 41 00    	jmp    DWORD PTR ds:0x41901c
  417422:	cc                   	int3
  417423:	cc                   	int3
  417424:	cc                   	int3
  417425:	cc                   	int3
  417426:	cc                   	int3
  417427:	cc                   	int3
  417428:	cc                   	int3
  417429:	cc                   	int3
  41742a:	cc                   	int3
  41742b:	cc                   	int3
  41742c:	cc                   	int3
  41742d:	cc                   	int3
  41742e:	cc                   	int3
  41742f:	cc                   	int3
  417430:	ff 25 d4 90 41 00    	jmp    DWORD PTR ds:0x4190d4
  417436:	83 3d 64 0d 42 00 ff 	cmp    DWORD PTR ds:0x420d64,0xffffffff
  41743d:	75 0c                	jne    0x41744b
  41743f:	ff 74 24 04          	push   DWORD PTR [esp+0x4]
  417443:	ff 15 38 90 41 00    	call   DWORD PTR ds:0x419038
  417449:	59                   	pop    ecx
  41744a:	c3                   	ret
  41744b:	68 60 0d 42 00       	push   0x420d60
  417450:	68 64 0d 42 00       	push   0x420d64
  417455:	ff 74 24 0c          	push   DWORD PTR [esp+0xc]
  417459:	e8 74 01 00 00       	call   0x4175d2
  41745e:	83 c4 0c             	add    esp,0xc
  417461:	c3                   	ret
  417462:	ff 74 24 04          	push   DWORD PTR [esp+0x4]
  417466:	e8 cb ff ff ff       	call   0x417436
  41746b:	f7 d8                	neg    eax
  41746d:	1b c0                	sbb    eax,eax
  41746f:	59                   	pop    ecx
  417470:	f7 d8                	neg    eax
  417472:	48                   	dec    eax
  417473:	c3                   	ret
  417474:	55                   	push   ebp
  417475:	8b ec                	mov    ebp,esp
  417477:	6a ff                	push   0xffffffff
  417479:	68 60 9b 41 00       	push   0x419b60
  41747e:	68 fa 75 41 00       	push   0x4175fa
  417483:	64 a1 00 00 00 00    	mov    eax,fs:0x0
  417489:	50                   	push   eax
  41748a:	64 89 25 00 00 00 00 	mov    DWORD PTR fs:0x0,esp
  417491:	83 ec 68             	sub    esp,0x68
  417494:	53                   	push   ebx
  417495:	56                   	push   esi
  417496:	57                   	push   edi
  417497:	89 65 e8             	mov    DWORD PTR [ebp-0x18],esp
  41749a:	33 db                	xor    ebx,ebx
  41749c:	89 5d fc             	mov    DWORD PTR [ebp-0x4],ebx
  41749f:	6a 02                	push   0x2
  4174a1:	ff 15 90 90 41 00    	call   DWORD PTR ds:0x419090
  4174a7:	59                   	pop    ecx
  4174a8:	83 0d 60 0d 42 00 ff 	or     DWORD PTR ds:0x420d60,0xffffffff
  4174af:	83 0d 64 0d 42 00 ff 	or     DWORD PTR ds:0x420d64,0xffffffff
  4174b6:	ff 15 94 90 41 00    	call   DWORD PTR ds:0x419094
  4174bc:	8b 0d 58 0d 42 00    	mov    ecx,DWORD PTR ds:0x420d58
  4174c2:	89 08                	mov    DWORD PTR [eax],ecx
  4174c4:	ff 15 98 90 41 00    	call   DWORD PTR ds:0x419098
  4174ca:	8b 0d 54 0d 42 00    	mov    ecx,DWORD PTR ds:0x420d54
  4174d0:	89 08                	mov    DWORD PTR [eax],ecx
  4174d2:	a1 9c 90 41 00       	mov    eax,ds:0x41909c
  4174d7:	8b 00                	mov    eax,DWORD PTR [eax]
  4174d9:	a3 5c 0d 42 00       	mov    ds:0x420d5c,eax
  4174de:	e8 16 01 00 00       	call   0x4175f9
  4174e3:	39 1d c0 ef 41 00    	cmp    DWORD PTR ds:0x41efc0,ebx
  4174e9:	75 0c                	jne    0x4174f7
  4174eb:	68 f6 75 41 00       	push   0x4175f6
  4174f0:	ff 15 a0 90 41 00    	call   DWORD PTR ds:0x4190a0
  4174f6:	59                   	pop    ecx
  4174f7:	e8 e8 00 00 00       	call   0x4175e4
  4174fc:	68 10 b0 41 00       	push   0x41b010
  417501:	68 0c b0 41 00       	push   0x41b00c
  417506:	e8 d3 00 00 00       	call   0x4175de
  41750b:	a1 50 0d 42 00       	mov    eax,ds:0x420d50
  417510:	89 45 94             	mov    DWORD PTR [ebp-0x6c],eax
  417513:	8d 45 94             	lea    eax,[ebp-0x6c]
  417516:	50                   	push   eax
  417517:	ff 35 4c 0d 42 00    	push   DWORD PTR ds:0x420d4c
  41751d:	8d 45 9c             	lea    eax,[ebp-0x64]
  417520:	50                   	push   eax
  417521:	8d 45 90             	lea    eax,[ebp-0x70]
  417524:	50                   	push   eax
  417525:	8d 45 a0             	lea    eax,[ebp-0x60]
  417528:	50                   	push   eax
  417529:	ff 15 28 90 41 00    	call   DWORD PTR ds:0x419028
  41752f:	68 08 b0 41 00       	push   0x41b008
  417534:	68 00 b0 41 00       	push   0x41b000
  417539:	e8 a0 00 00 00       	call   0x4175de
  41753e:	83 c4 24             	add    esp,0x24
  417541:	a1 2c 90 41 00       	mov    eax,ds:0x41902c
  417546:	8b 30                	mov    esi,DWORD PTR [eax]
  417548:	89 75 8c             	mov    DWORD PTR [ebp-0x74],esi
  41754b:	80 3e 22             	cmp    BYTE PTR [esi],0x22
  41754e:	75 3a                	jne    0x41758a
  417550:	46                   	inc    esi
  417551:	89 75 8c             	mov    DWORD PTR [ebp-0x74],esi
  417554:	8a 06                	mov    al,BYTE PTR [esi]
  417556:	3a c3                	cmp    al,bl
  417558:	74 04                	je     0x41755e
  41755a:	3c 22                	cmp    al,0x22
  41755c:	75 f2                	jne    0x417550
  41755e:	80 3e 22             	cmp    BYTE PTR [esi],0x22
  417561:	75 04                	jne    0x417567
  417563:	46                   	inc    esi
  417564:	89 75 8c             	mov    DWORD PTR [ebp-0x74],esi
  417567:	8a 06                	mov    al,BYTE PTR [esi]
  417569:	3a c3                	cmp    al,bl
  41756b:	74 04                	je     0x417571
  41756d:	3c 20                	cmp    al,0x20
  41756f:	76                   	.byte 0x76


/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL_net.dll:     file format pei-i386


Disassembly of section .text:

10001280 <.text+0x280>:
10001280:	0b 00                	or     eax,DWORD PTR [eax]
10001282:	00 83 c4 04 83 c8    	add    BYTE PTR [ebx-0x377cfb3c],al
10001288:	ff 5f 5e             	call   FWORD PTR [edi+0x5e]
1000128b:	c3                   	ret
1000128c:	49                   	dec    ecx
1000128d:	3b c1                	cmp    eax,ecx
1000128f:	89 0a                	mov    DWORD PTR [edx],ecx
10001291:	7d 11                	jge    0x100012a4
10001293:	8b 4a 08             	mov    ecx,DWORD PTR [edx+0x8]
10001296:	40                   	inc    eax
10001297:	8b 34 81             	mov    esi,DWORD PTR [ecx+eax*4]
1000129a:	89 74 81 fc          	mov    DWORD PTR [ecx+eax*4-0x4],esi
1000129e:	8b 0a                	mov    ecx,DWORD PTR [edx]
100012a0:	3b c1                	cmp    eax,ecx
100012a2:	7c ef                	jl     0x10001293
100012a4:	8b 02                	mov    eax,DWORD PTR [edx]
100012a6:	5f                   	pop    edi
100012a7:	5e                   	pop    esi
100012a8:	c3                   	ret
100012a9:	90                   	nop
100012aa:	90                   	nop
100012ab:	90                   	nop
100012ac:	90                   	nop
100012ad:	90                   	nop
100012ae:	90                   	nop
100012af:	90                   	nop
100012b0:	81 ec 14 01 00 00    	sub    esp,0x114
100012b6:	33 c9                	xor    ecx,ecx
100012b8:	53                   	push   ebx
100012b9:	8b 9c 24 1c 01 00 00 	mov    ebx,DWORD PTR [esp+0x11c]
100012c0:	55                   	push   ebp
100012c1:	56                   	push   esi
100012c2:	8b 03                	mov    eax,DWORD PTR [ebx]
100012c4:	48                   	dec    eax
100012c5:	78 1a                	js     0x100012e1
100012c7:	8b 53 08             	mov    edx,DWORD PTR [ebx+0x8]
100012ca:	8d 70 01             	lea    esi,[eax+0x1]
100012cd:	8d 14 82             	lea    edx,[edx+eax*4]
100012d0:	8b 02                	mov    eax,DWORD PTR [edx]
100012d2:	8b 40 04             	mov    eax,DWORD PTR [eax+0x4]
100012d5:	3b c1                	cmp    eax,ecx
100012d7:	76 02                	jbe    0x100012db
100012d9:	8b c8                	mov    ecx,eax
100012db:	83 ea 04             	sub    edx,0x4
100012de:	4e                   	dec    esi
100012df:	75 ef                	jne    0x100012d0
100012e1:	8b 84 24 28 01 00 00 	mov    eax,DWORD PTR [esp+0x128]
100012e8:	33 d2                	xor    edx,edx
100012ea:	be e8 03 00 00       	mov    esi,0x3e8
100012ef:	57                   	push   edi
100012f0:	f7 f6                	div    esi
100012f2:	8b 3d 10 20 00 10    	mov    edi,DWORD PTR ds:0x10002010
100012f8:	89 44 24 14          	mov    DWORD PTR [esp+0x14],eax
100012fc:	8d 04 92             	lea    eax,[edx+edx*4]
100012ff:	8d 04 80             	lea    eax,[eax+eax*4]
10001302:	8d 34 80             	lea    esi,[eax+eax*4]
10001305:	c1 e6 03             	shl    esi,0x3
10001308:	41                   	inc    ecx
10001309:	89 4c 24 10          	mov    DWORD PTR [esp+0x10],ecx
1000130d:	ff d7                	call   edi
1000130f:	c7 00 00 00 00 00    	mov    DWORD PTR [eax],0x0
10001315:	8b 03                	mov    eax,DWORD PTR [ebx]
10001317:	33 c9                	xor    ecx,ecx
10001319:	48                   	dec    eax
1000131a:	89 4c 24 20          	mov    DWORD PTR [esp+0x20],ecx
1000131e:	78 1e                	js     0x1000133e
10001320:	83 f9 40             	cmp    ecx,0x40
10001323:	73 16                	jae    0x1000133b
10001325:	8b 53 08             	mov    edx,DWORD PTR [ebx+0x8]
10001328:	8b 14 82             	mov    edx,DWORD PTR [edx+eax*4]
1000132b:	8b 52 04             	mov    edx,DWORD PTR [edx+0x4]
1000132e:	89 54 8c 24          	mov    DWORD PTR [esp+ecx*4+0x24],edx
10001332:	8b 4c 24 20          	mov    ecx,DWORD PTR [esp+0x20]
10001336:	41                   	inc    ecx
10001337:	89 4c 24 20          	mov    DWORD PTR [esp+0x20],ecx
1000133b:	48                   	dec    eax
1000133c:	79 e2                	jns    0x10001320
1000133e:	8b 44 24 14          	mov    eax,DWORD PTR [esp+0x14]
10001342:	8d 4c 24 18          	lea    ecx,[esp+0x18]
10001346:	51                   	push   ecx
10001347:	89 44 24 1c          	mov    DWORD PTR [esp+0x1c],eax
1000134b:	8b 44 24 14          	mov    eax,DWORD PTR [esp+0x14]
1000134f:	6a 00                	push   0x0
10001351:	8d 54 24 28          	lea    edx,[esp+0x28]
10001355:	6a 00                	push   0x0
10001357:	52                   	push   edx
10001358:	50                   	push   eax
10001359:	89 74 24 30          	mov    DWORD PTR [esp+0x30],esi
1000135d:	e8 ee 09 00 00       	call   0x10001d50
10001362:	8b e8                	mov    ebp,eax
10001364:	ff d7                	call   edi
10001366:	83 38 04             	cmp    DWORD PTR [eax],0x4
10001369:	74 a2                	je     0x1000130d
1000136b:	85 ed                	test   ebp,ebp
1000136d:	5f                   	pop    edi
1000136e:	7e 2c                	jle    0x1000139c
10001370:	8b 33                	mov    esi,DWORD PTR [ebx]
10001372:	4e                   	dec    esi
10001373:	78 27                	js     0x1000139c
10001375:	8b 53 08             	mov    edx,DWORD PTR [ebx+0x8]
10001378:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
1000137c:	51                   	push   ecx
1000137d:	8b 04 b2             	mov    eax,DWORD PTR [edx+esi*4]
10001380:	8b 48 04             	mov    ecx,DWORD PTR [eax+0x4]
10001383:	51                   	push   ecx
10001384:	e8 c1 09 00 00       	call   0x10001d4a
10001389:	85 c0                	test   eax,eax
1000138b:	74 0c                	je     0x10001399
1000138d:	8b 53 08             	mov    edx,DWORD PTR [ebx+0x8]
10001390:	8b 04 b2             	mov    eax,DWORD PTR [edx+esi*4]
10001393:	c7 00 01 00 00 00    	mov    DWORD PTR [eax],0x1
10001399:	4e                   	dec    esi
1000139a:	79 d9                	jns    0x10001375
1000139c:	8b c5                	mov    eax,ebp
1000139e:	5e                   	pop    esi
1000139f:	5d                   	pop    ebp
100013a0:	5b                   	pop    ebx
100013a1:	81 c4 14 01 00 00    	add    esp,0x114
100013a7:	c3                   	ret
100013a8:	90                   	nop
100013a9:	90                   	nop
100013aa:	90                   	nop
100013ab:	90                   	nop
100013ac:	90                   	nop
100013ad:	90                   	nop
100013ae:	90                   	nop
100013af:	90                   	nop
100013b0:	56                   	push   esi
100013b1:	8b 74 24 08          	mov    esi,DWORD PTR [esp+0x8]
100013b5:	85 f6                	test   esi,esi
100013b7:	74 14                	je     0x100013cd
100013b9:	8b 46 08             	mov    eax,DWORD PTR [esi+0x8]
100013bc:	57                   	push   edi
100013bd:	8b 3d 18 20 00 10    	mov    edi,DWORD PTR ds:0x10002018
100013c3:	50                   	push   eax
100013c4:	ff d7                	call   edi
100013c6:	56                   	push   esi
100013c7:	ff d7                	call   edi
100013c9:	83 c4 08             	add    esp,0x8
100013cc:	5f                   	pop    edi
100013cd:	5e                   	pop    esi
100013ce:	c3                   	ret
100013cf:	90                   	nop

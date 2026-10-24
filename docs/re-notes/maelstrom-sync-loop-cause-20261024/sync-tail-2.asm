  40e446:	8b 7c 24 18          	mov    edi,DWORD PTR [esp+0x18]
  40e44a:	85 db                	test   ebx,ebx
  40e44c:	0f 85 b9 fc ff ff    	jne    0x40e10b
  40e452:	8b 15 f8 f9 41 00    	mov    edx,DWORD PTR ds:0x41f9f8
  40e458:	8b 0d 60 06 42 00    	mov    ecx,DWORD PTR ds:0x420660
  40e45e:	42                   	inc    edx
  40e45f:	33 c0                	xor    eax,eax
  40e461:	85 c9                	test   ecx,ecx
  40e463:	0f 94 c0             	sete   al
  40e466:	89 15 f8 f9 41 00    	mov    DWORD PTR ds:0x41f9f8,edx
  40e46c:	5f                   	pop    edi
  40e46d:	8b 14 85 34 fa 41 00 	mov    edx,DWORD PTR [eax*4+0x41fa34]
  40e474:	5e                   	pop    esi
  40e475:	a3 60 06 42 00       	mov    ds:0x420660,eax
  40e47a:	5d                   	pop    ebp
  40e47b:	c7 42 08 0a 00 00 00 	mov    DWORD PTR [edx+0x8],0xa
  40e482:	33 c0                	xor    eax,eax
  40e484:	5b                   	pop    ebx
  40e485:	81 c4 2c 02 00 00    	add    esp,0x22c
  40e48b:	c3                   	ret
  40e48c:	68 f0 e4 41 00       	push   0x41e4f0
  40e491:	e8 9a f5 ff ff       	call   0x40da30
  40e496:	83 c4 04             	add    esp,0x4
  40e499:	83 c8 ff             	or     eax,0xffffffff
  40e49c:	5f                   	pop    edi
  40e49d:	5e                   	pop    esi
  40e49e:	5d                   	pop    ebp
  40e49f:	5b                   	pop    ebx
  40e4a0:	81 c4 2c 02 00 00    	add    esp,0x22c
  40e4a6:	c3                   	ret
  40e4a7:	90                   	nop
  40e4a8:	90                   	nop
  40e4a9:	90                   	nop
  40e4aa:	90                   	nop
  40e4ab:	90                   	nop
  40e4ac:	90                   	nop
  40e4ad:	90                   	nop
  40e4ae:	90                   	nop
  40e4af:	90                   	nop

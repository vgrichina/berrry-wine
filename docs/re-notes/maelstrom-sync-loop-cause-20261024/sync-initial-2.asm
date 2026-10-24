  40e203:	52                   	push   edx
  40e204:	68 28 e6 41 00       	push   0x41e628
  40e209:	e8 22 f8 ff ff       	call   0x40da30
  40e20e:	83 c4 08             	add    esp,0x8
  40e211:	e9 34 02 00 00       	jmp    0x40e44a
  40e216:	8b 44 24 20          	mov    eax,DWORD PTR [esp+0x20]
  40e21a:	85 c0                	test   eax,eax
  40e21c:	7f 12                	jg     0x40e230
  40e21e:	68 0c e6 41 00       	push   0x41e60c
  40e223:	e8 08 f8 ff ff       	call   0x40da30
  40e228:	83 c4 04             	add    esp,0x4
  40e22b:	e9 1a 02 00 00       	jmp    0x40e44a
  40e230:	8b 15 f4 f9 41 00    	mov    edx,DWORD PTR ds:0x41f9f4
  40e236:	8d 70 ff             	lea    esi,[eax-0x1]
  40e239:	8b ca                	mov    ecx,edx
  40e23b:	89 74 24 1c          	mov    DWORD PTR [esp+0x1c],esi
  40e23f:	8d 04 56             	lea    eax,[esi+edx*2]
  40e242:	03 c8                	add    ecx,eax
  40e244:	8b 04 8d 3c fa 41 00 	mov    eax,DWORD PTR [ecx*4+0x41fa3c]
  40e24b:	85 c0                	test   eax,eax
  40e24d:	0f                   	.byte 0xf
  40e24e:	85 f7                	test   edi,esi

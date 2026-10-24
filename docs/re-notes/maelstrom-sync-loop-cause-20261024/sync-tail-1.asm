
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

0040e24d <.text+0xd24d>:
  40e24d:	0f 85 f7 01 00 00    	jne    0x40e44a
  40e253:	8b 4c 24 3d          	mov    ecx,DWORD PTR [esp+0x3d]
  40e257:	8b c1                	mov    eax,ecx
  40e259:	8b e9                	mov    ebp,ecx
  40e25b:	25 00 00 ff 00       	and    eax,0xff0000
  40e260:	c1 ed 10             	shr    ebp,0x10
  40e263:	0b c5                	or     eax,ebp
  40e265:	8b e9                	mov    ebp,ecx
  40e267:	c1 e5 10             	shl    ebp,0x10
  40e26a:	81 e1 00 ff 00 00    	and    ecx,0xff00
  40e270:	0b e9                	or     ebp,ecx
  40e272:	8b 0d f8 f9 41 00    	mov    ecx,DWORD PTR ds:0x41f9f8
  40e278:	c1 e8 08             	shr    eax,0x8
  40e27b:	c1 e5 08             	shl    ebp,0x8
  40e27e:	0b c5                	or     eax,ebp
  40e280:	3b c1                	cmp    eax,ecx
  40e282:	0f 84 fa 00 00 00    	je     0x40e382
  40e288:	8d 51 ff             	lea    edx,[ecx-0x1]
  40e28b:	3b c2                	cmp    eax,edx
  40e28d:	75 38                	jne    0x40e2c7
  40e28f:	50                   	push   eax
  40e290:	68 e0 e5 41 00       	push   0x41e5e0
  40e295:	e8 96 f7 ff ff       	call   0x40da30
  40e29a:	8b 0d 60 06 42 00    	mov    ecx,DWORD PTR ds:0x420660
  40e2a0:	8b 54 24 28          	mov    edx,DWORD PTR [esp+0x28]
  40e2a4:	33 c0                	xor    eax,eax
  40e2a6:	85 c9                	test   ecx,ecx
  40e2a8:	0f 94 c0             	sete   al
  40e2ab:	8b 0c 85 34 fa 41 00 	mov    ecx,DWORD PTR [eax*4+0x41fa34]
  40e2b2:	a1 58 06 42 00       	mov    eax,ds:0x420658
  40e2b7:	51                   	push   ecx
  40e2b8:	52                   	push   edx
  40e2b9:	50                   	push   eax
  40e2ba:	e8 33 52 00 00       	call   0x4134f2
  40e2bf:	83 c4 14             	add    esp,0x14
  40e2c2:	e9 83 01 00 00       	jmp    0x40e44a
  40e2c7:	8d 51 01             	lea    edx,[ecx+0x1]
  40e2ca:	51                   	push   ecx
  40e2cb:	3b c2                	cmp    eax,edx
  40e2cd:	50                   	push   eax
  40e2ce:	0f 85 9c 00 00 00    	jne    0x40e370
  40e2d4:	68 a8 e5 41 00       	push   0x41e5a8
  40e2d9:	e8 52 f7 ff ff       	call   0x40da30
  40e2de:	a1 60 06 42 00       	mov    eax,ds:0x420660
  40e2e3:	8b 54 24 2c          	mov    edx,DWORD PTR [esp+0x2c]
  40e2e7:	8b 0c 85 34 fa 41 00 	mov    ecx,DWORD PTR [eax*4+0x41fa34]
  40e2ee:	a1 58 06 42 00       	mov    eax,ds:0x420658
  40e2f3:	51                   	push   ecx
  40e2f4:	52                   	push   edx
  40e2f5:	50                   	push   eax
  40e2f6:	e8 f7 51 00 00       	call   0x4134f2
  40e2fb:	8b 3d f4 f9 41 00    	mov    edi,DWORD PTR ds:0x41f9f4
  40e301:	8b 4c 24 40          	mov    ecx,DWORD PTR [esp+0x40]
  40e305:	83 c4 18             	add    esp,0x18
  40e308:	33 c0                	xor    eax,eax
  40e30a:	85 ff                	test   edi,edi
  40e30c:	0f 94 c0             	sete   al
  40e30f:	8d 51 f6             	lea    edx,[ecx-0xa]
  40e312:	8d 74 24 46          	lea    esi,[esp+0x46]
  40e316:	8b 0c 85 24 fa 41 00 	mov    ecx,DWORD PTR [eax*4+0x41fa24]
  40e31d:	8d 1c 40             	lea    ebx,[eax+eax*2]
  40e320:	03 cb                	add    ecx,ebx
  40e322:	c1 e1 09             	shl    ecx,0x9
  40e325:	8d b9 58 fa 41 00    	lea    edi,[ecx+0x41fa58]
  40e32b:	8b ca                	mov    ecx,edx
  40e32d:	8b e9                	mov    ebp,ecx
  40e32f:	89 7c 24 14          	mov    DWORD PTR [esp+0x14],edi
  40e333:	c1 e9 02             	shr    ecx,0x2
  40e336:	f3 a5                	rep movs DWORD PTR es:[edi],DWORD PTR ds:[esi]
  40e338:	8b cd                	mov    ecx,ebp
  40e33a:	83 e1 03             	and    ecx,0x3
  40e33d:	f3 a4                	rep movs BYTE PTR es:[edi],BYTE PTR ds:[esi]
  40e33f:	8b 4c 24 1c          	mov    ecx,DWORD PTR [esp+0x1c]
  40e343:	8b 74 24 14          	mov    esi,DWORD PTR [esp+0x14]
  40e347:	03 cb                	add    ecx,ebx
  40e349:	8b 5c 24 10          	mov    ebx,DWORD PTR [esp+0x10]
  40e34d:	c1 e1 02             	shl    ecx,0x2
  40e350:	89 b1 3c fa 41 00    	mov    DWORD PTR [ecx+0x41fa3c],esi
  40e356:	89 91 0c fa 41 00    	mov    DWORD PTR [ecx+0x41fa0c],edx
  40e35c:	8b 0c 85 24 fa 41 00 	mov    ecx,DWORD PTR [eax*4+0x41fa24]
  40e363:	41                   	inc    ecx
  40e364:	89 0c 85 24 fa 41 00 	mov    DWORD PTR [eax*4+0x41fa24],ecx
  40e36b:	e9 d6 00 00 00       	jmp    0x40e446
  40e370:	68 60 e5 41 00       	push   0x41e560
  40e375:	e8 b6 f6 ff ff       	call   0x40da30
  40e37a:	83 c4 0c             	add    esp,0xc
  40e37d:	e9 c8 00 00 00       	jmp    0x40e44a
  40e382:	8b 4c 24 41          	mov    ecx,DWORD PTR [esp+0x41]
  40e386:	8b c1                	mov    eax,ecx
  40e388:	8b d9                	mov    ebx,ecx
  40e38a:	25 00 00 ff 00       	and    eax,0xff0000
  40e38f:	c1 eb 10             	shr    ebx,0x10
  40e392:	0b c3                	or     eax,ebx
  40e394:	8b d9                	mov    ebx,ecx
  40e396:	c1 e3 10             	shl    ebx,0x10
  40e399:	81 e1 00 ff 00 00    	and    ecx,0xff00
  40e39f:	0b d9                	or     ebx,ecx
  40e3a1:	c1 e8 08             	shr    eax,0x8
  40e3a4:	c1 e3 08             	shl    ebx,0x8
  40e3a7:	0b c3                	or     eax,ebx
  40e3a9:	3b c7                	cmp    eax,edi
  40e3ab:	74 34                	je     0x40e3e1
  40e3ad:	8b 0d d8 f9 41 00    	mov    ecx,DWORD PTR ds:0x41f9d8
  40e3b3:	85 c9                	test   ecx,ecx
  40e3b5:	75 1b                	jne    0x40e3d2
  40e3b7:	46                   	inc    esi
  40e3b8:	56                   	push   esi
  40e3b9:	68 18 e5 41 00       	push   0x41e518
  40e3be:	e8 6d f6 ff ff       	call   0x40da30
  40e3c3:	68 b8 0b 00 00       	push   0xbb8
  40e3c8:	e8 53 50 00 00       	call   0x413420
  40e3cd:	83 c4 0c             	add    esp,0xc
  40e3d0:	eb 09                	jmp    0x40e3db
  40e3d2:	50                   	push   eax
  40e3d3:	e8 b8 72 ff ff       	call   0x405690
  40e3d8:	83 c4 04             	add    esp,0x4
  40e3db:	8b 15 f4 f9 41 00    	mov    edx,DWORD PTR ds:0x41f9f4
  40e3e1:	8b 44 24 28          	mov    eax,DWORD PTR [esp+0x28]
  40e3e5:	8b 0c 95 24 fa 41 00 	mov    ecx,DWORD PTR [edx*4+0x41fa24]
  40e3ec:	8d 74 24 46          	lea    esi,[esp+0x46]
  40e3f0:	8d 58 f6             	lea    ebx,[eax-0xa]
  40e3f3:	8d 04 52             	lea    eax,[edx+edx*2]
  40e3f6:	03 c8                	add    ecx,eax
  40e3f8:	c1 e1 09             	shl    ecx,0x9
  40e3fb:	8d b9 58 fa 41 00    	lea    edi,[ecx+0x41fa58]
  40e401:	8b cb                	mov    ecx,ebx
  40e403:	8b e9                	mov    ebp,ecx
  40e405:	89 7c 24 14          	mov    DWORD PTR [esp+0x14],edi
  40e409:	c1 e9 02             	shr    ecx,0x2
  40e40c:	f3 a5                	rep movs DWORD PTR es:[edi],DWORD PTR ds:[esi]
  40e40e:	8b cd                	mov    ecx,ebp
  40e410:	83 e1 03             	and    ecx,0x3
  40e413:	f3 a4                	rep movs BYTE PTR es:[edi],BYTE PTR ds:[esi]
  40e415:	8b 4c 24 1c          	mov    ecx,DWORD PTR [esp+0x1c]
  40e419:	03 c1                	add    eax,ecx
  40e41b:	8b 4c 24 14          	mov    ecx,DWORD PTR [esp+0x14]
  40e41f:	c1 e0 02             	shl    eax,0x2
  40e422:	89 88 3c fa 41 00    	mov    DWORD PTR [eax+0x41fa3c],ecx
  40e428:	89 98 0c fa 41 00    	mov    DWORD PTR [eax+0x41fa0c],ebx
  40e42e:	8b 04 95 24 fa 41 00 	mov    eax,DWORD PTR [edx*4+0x41fa24]
  40e435:	8b 5c 24 10          	mov    ebx,DWORD PTR [esp+0x10]
  40e439:	40                   	inc    eax
  40e43a:	4b                   	dec    ebx
  40e43b:	89 04 95 24 fa 41 00 	mov    DWORD PTR [edx*4+0x41fa24],eax
  40e442:	89 5c 24 10          	mov    DWORD PTR [esp+0x10],ebx

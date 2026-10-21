  40418d:	83 7d 08 02          	cmp    DWORD PTR [ebp+0x8],0x2
  404191:	0f 84 f6 00 00 00    	je     0x40428d
  404197:	83 3d 40 1a 41 00 01 	cmp    DWORD PTR ds:0x411a40,0x1
  40419e:	0f 85 56 01 00 00    	jne    0x4042fa
  4041a4:	83 3d 50 f4 40 00 00 	cmp    DWORD PTR ds:0x40f450,0x0
  4041ab:	0f 8e 49 01 00 00    	jle    0x4042fa
  4041b1:	a1 a0 f4 40 00       	mov    eax,ds:0x40f4a0
  4041b6:	01 05 d0 fc 40 00    	add    DWORD PTR ds:0x40fcd0,eax
  4041bc:	83 3d d0 fc 40 00 1f 	cmp    DWORD PTR ds:0x40fcd0,0x1f
  4041c3:	7f 16                	jg     0x4041db
  4041c5:	c7 05 d0 fc 40 00 20 	mov    DWORD PTR ds:0x40fcd0,0x20
  4041cc:	00 00 00 
  4041cf:	c7 05 90 f2 40 00 00 	mov    DWORD PTR ds:0x40f290,0x0
  4041d6:	00 00 00 
  4041d9:	eb 20                	jmp    0x4041fb
  4041db:	81 3d d0 fc 40 00 40 	cmp    DWORD PTR ds:0x40fcd0,0x240
  4041e2:	02 00 00 
  4041e5:	7e 14                	jle    0x4041fb
  4041e7:	c7 05 d0 fc 40 00 40 	mov    DWORD PTR ds:0x40fcd0,0x240
  4041ee:	02 00 00 
  4041f1:	c7 05 90 f2 40 00 00 	mov    DWORD PTR ds:0x40f290,0x0
  4041f8:	00 00 00 
  4041fb:	ff 0d 90 f2 40 00    	dec    DWORD PTR ds:0x40f290
  404201:	83 3d 90 f2 40 00 00 	cmp    DWORD PTR ds:0x40f290,0x0
  404208:	0f 8f ec 00 00 00    	jg     0x4042fa
  40420e:	e8 2d 7f 00 00       	call   0x40c140
  404213:	89 45 a8             	mov    DWORD PTR [ebp-0x58],eax
  404216:	8b 45 a8             	mov    eax,DWORD PTR [ebp-0x58]
  404219:	89 45 a4             	mov    DWORD PTR [ebp-0x5c],eax
  40421c:	83 7d a4 00          	cmp    DWORD PTR [ebp-0x5c],0x0
  404220:	79 04                	jns    0x404226
  404222:	83 45 a4 07          	add    DWORD PTR [ebp-0x5c],0x7
  404226:	8b 45 a4             	mov    eax,DWORD PTR [ebp-0x5c]
  404229:	c1 f8 03             	sar    eax,0x3
  40422c:	c1 e0 03             	shl    eax,0x3
  40422f:	8b 55 a8             	mov    edx,DWORD PTR [ebp-0x58]
  404232:	29 c2                	sub    edx,eax
  404234:	89 d0                	mov    eax,edx
  404236:	8d 50 fc             	lea    edx,[eax-0x4]
  404239:	a1 30 f4 40 00       	mov    eax,ds:0x40f430
  40423e:	0f af 14 85 60 f2 40 	imul   edx,DWORD PTR [eax*4+0x40f260]
  404245:	00 
  404246:	89 d0                	mov    eax,edx
  404248:	01 c0                	add    eax,eax
  40424a:	a3 a0 f4 40 00       	mov    ds:0x40f4a0,eax
  40424f:	83 3d a0 f4 40 00 00 	cmp    DWORD PTR ds:0x40f4a0,0x0
  404256:	74 b6                	je     0x40420e
  404258:	e8 e3 7e 00 00       	call   0x40c140
  40425d:	89 c1                	mov    ecx,eax
  40425f:	a1 30 f4 40 00       	mov    eax,ds:0x40f430
  404264:	8b 14 85 60 f2 40 00 	mov    edx,DWORD PTR [eax*4+0x40f260]
  40426b:	89 d0                	mov    eax,edx
  40426d:	c1 e0 02             	shl    eax,0x2
  404270:	01 d0                	add    eax,edx
  404272:	01 c0                	add    eax,eax
  404274:	89 85 74 ff ff ff    	mov    DWORD PTR [ebp-0x8c],eax
  40427a:	89 c8                	mov    eax,ecx
  40427c:	99                   	cdq
  40427d:	f7 bd 74 ff ff ff    	idiv   DWORD PTR [ebp-0x8c]
  404283:	8d 42 05             	lea    eax,[edx+0x5]
  404286:	a3 90 f2 40 00       	mov    ds:0x40f290,eax
  40428b:	eb 6d                	jmp    0x4042fa
  40428d:	83 3d 50 1a 41 00 01 	cmp    DWORD PTR ds:0x411a50,0x1
  404294:	75 09                	jne    0x40429f
  404296:	83 2d d0 fc 40 00 20 	sub    DWORD PTR ds:0x40fcd0,0x20
  40429d:	eb 10                	jmp    0x4042af
  40429f:	83 3d 70 1a 41 00 01 	cmp    DWORD PTR ds:0x411a70,0x1
  4042a6:	75 07                	jne    0x4042af
  4042a8:	83 2d d0 fc 40 00 10 	sub    DWORD PTR ds:0x40fcd0,0x10
  4042af:	83 3d d0 fc 40 00 1f 	cmp    DWORD PTR ds:0x40fcd0,0x1f
  4042b6:	7f 0a                	jg     0x4042c2
  4042b8:	c7 05 d0 fc 40 00 20 	mov    DWORD PTR ds:0x40fcd0,0x20
  4042bf:	00 00 00 
  4042c2:	83 3d f0 f3 40 00 01 	cmp    DWORD PTR ds:0x40f3f0,0x1
  4042c9:	75 09                	jne    0x4042d4
  4042cb:	83 05 d0 fc 40 00 20 	add    DWORD PTR ds:0x40fcd0,0x20
  4042d2:	eb 10                	jmp    0x4042e4
  4042d4:	83 3d 60 fd 40 00 01 	cmp    DWORD PTR ds:0x40fd60,0x1
  4042db:	75 07                	jne    0x4042e4
  4042dd:	83 05 d0 fc 40 00 10 	add    DWORD PTR ds:0x40fcd0,0x10
  4042e4:	81 3d d0 fc 40 00 40 	cmp    DWORD PTR ds:0x40fcd0,0x240
  4042eb:	02 00 00 
  4042ee:	7e 0a                	jle    0x4042fa
  4042f0:	c7 05 d0 fc 40 00 40 	mov    DWORD PTR ds:0x40fcd0,0x240
  4042f7:	02 00 00 
  4042fa:	83 3d 40 1a 41 00 01 	cmp    DWORD PTR ds:0x411a40,0x1
  404301:	0f 85 87 00 00 00    	jne    0x40438e
  404307:	83 3d 50 f4 40 00 00 	cmp    DWORD PTR ds:0x40f450,0x0
  40430e:	7e 7e                	jle    0x40438e
  404310:	8b 15 30 f4 40 00    	mov    edx,DWORD PTR ds:0x40f430
  404316:	b8 0a 00 00 00       	mov    eax,0xa
  40431b:	2b 04 95 60 f2 40 00 	sub    eax,DWORD PTR [edx*4+0x40f260]
  404322:	89 c2                	mov    edx,eax
  404324:	a1 40 fd 40 00       	mov    eax,ds:0x40fd40
  404329:	89 d1                	mov    ecx,edx
  40432b:	99                   	cdq
  40432c:	f7 f9                	idiv   ecx
  40432e:	85 d2                	test   edx,edx
  404330:	75 5c                	jne    0x40438e
  404332:	a1 30 f4 40 00       	mov    eax,ds:0x40f430
  404337:	8b 14 85 60 f2 40 00 	mov    edx,DWORD PTR [eax*4+0x40f260]
  40433e:	89 d0                	mov    eax,edx
  404340:	c1 f8 1f             	sar    eax,0x1f
  404343:	c1 e8 1f             	shr    eax,0x1f
  404346:	8d 04 10             	lea    eax,[eax+edx*1]
  404349:	d1 f8                	sar    eax,1
  40434b:	01 c0                	add    eax,eax
  40434d:	29 c2                	sub    edx,eax
  40434f:	89 d0                	mov    eax,edx
  404351:	83 f8 01             	cmp    eax,0x1
  404354:	75 12                	jne    0x404368
  404356:	b8 01 00 00 00       	mov    eax,0x1
  40435b:	2b 05 c0 fd 40 00    	sub    eax,DWORD PTR ds:0x40fdc0
  404361:	a3 c0 fd 40 00       	mov    ds:0x40fdc0,eax
  404366:	eb 0a                	jmp    0x404372
  404368:	c7 05 c0 fd 40 00 01 	mov    DWORD PTR ds:0x40fdc0,0x1
  40436f:	00 00 00 
  404372:	83 3d c0 fd 40 00 01 	cmp    DWORD PTR ds:0x40fdc0,0x1
  404379:	75 13                	jne    0x40438e
  40437b:	a1 d0 fc 40 00       	mov    eax,ds:0x40fcd0
  404380:	89 04 24             	mov    DWORD PTR [esp],eax
  404383:	e8 52 29 00 00       	call   0x406cda
  404388:	ff 0d 50 f4 40 00    	dec    DWORD PTR ds:0x40f450
  40438e:	c7 05 70 fd 40 00 01 	mov    DWORD PTR ds:0x40fd70,0x1

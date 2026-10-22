  404278:	55                   	push   ebp
  404279:	8b ec                	mov    ebp,esp
  40427b:	53                   	push   ebx
  40427c:	56                   	push   esi
  40427d:	8b 75 08             	mov    esi,DWORD PTR [ebp+0x8]
  404280:	33 db                	xor    ebx,ebx
  404282:	3b f3                	cmp    esi,ebx
  404284:	57                   	push   edi
  404285:	75 07                	jne    0x40428e
  404287:	6a f8                	push   0xfffffff8
  404289:	e9 f1 00 00 00       	jmp    0x40437f
  40428e:	ff 75 0c             	push   DWORD PTR [ebp+0xc]
  404291:	89 1d f4 07 41 00    	mov    DWORD PTR ds:0x4107f4,ebx
  404297:	56                   	push   esi
  404298:	e8 22 01 00 00       	call   0x4043bf
  40429d:	8b f8                	mov    edi,eax
  40429f:	59                   	pop    ecx
  4042a0:	3b fb                	cmp    edi,ebx
  4042a2:	59                   	pop    ecx
  4042a3:	7d 07                	jge    0x4042ac
  4042a5:	6a f7                	push   0xfffffff7
  4042a7:	e9 d3 00 00 00       	jmp    0x40437f
  4042ac:	6a 02                	push   0x2
  4042ae:	ff 75 10             	push   DWORD PTR [ebp+0x10]
  4042b1:	56                   	push   esi
  4042b2:	e8 3b 03 00 00       	call   0x4045f2
  4042b7:	83 c4 0c             	add    esp,0xc
  4042ba:	3b c3                	cmp    eax,ebx
  4042bc:	89 86 2c 04 00 00    	mov    DWORD PTR [esi+0x42c],eax
  4042c2:	75 07                	jne    0x4042cb
  4042c4:	6a fc                	push   0xfffffffc
  4042c6:	e9 b4 00 00 00       	jmp    0x40437f
  4042cb:	68 40 9c 00 00       	push   0x9c40
  4042d0:	ff 76 04             	push   DWORD PTR [esi+0x4]
  4042d3:	e8 33 fd ff ff       	call   0x40400b
  4042d8:	6b ff 1c             	imul   edi,edi,0x1c
  4042db:	89 45 08             	mov    DWORD PTR [ebp+0x8],eax
  4042de:	8b 86 2c 04 00 00    	mov    eax,DWORD PTR [esi+0x42c]
  4042e4:	a3 fc 0e 41 00       	mov    ds:0x410efc,eax
  4042e9:	8b 8e 28 04 00 00    	mov    ecx,DWORD PTR [esi+0x428]
  4042ef:	8d 86 28 04 00 00    	lea    eax,[esi+0x428]
  4042f5:	89 0d f8 0e 41 00    	mov    DWORD PTR ds:0x410ef8,ecx
  4042fb:	89 35 f0 07 41 00    	mov    DWORD PTR ds:0x4107f0,esi
  404301:	89 1d f4 07 41 00    	mov    DWORD PTR ds:0x4107f4,ebx
  404307:	ff b4 37 84 04 00 00 	push   DWORD PTR [edi+esi*1+0x484]
  40430e:	ff 30                	push   DWORD PTR [eax]
  404310:	e8 c4 04 00 00       	call   0x4047d9
  404315:	a1 f0 07 41 00       	mov    eax,ds:0x4107f0
  40431a:	59                   	pop    ecx
  40431b:	59                   	pop    ecx
  40431c:	8b 88 24 04 00 00    	mov    ecx,DWORD PTR [eax+0x424]
  404322:	3b cb                	cmp    ecx,ebx
  404324:	74 12                	je     0x404338
  404326:	6a 64                	push   0x64
  404328:	53                   	push   ebx
  404329:	ff 75 0c             	push   DWORD PTR [ebp+0xc]
  40432c:	ff b0 20 04 00 00    	push   DWORD PTR [eax+0x420]
  404332:	ff d1                	call   ecx
  404334:	85 c0                	test   eax,eax
  404336:	7c 37                	jl     0x40436f
  404338:	53                   	push   ebx
  404339:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  40433c:	68 50 47 40 00       	push   0x404750
  404341:	68 da 46 40 00       	push   0x4046da
  404346:	e8 c5 2e 00 00       	call   0x407210
  40434b:	a1 f0 07 41 00       	mov    eax,ds:0x4107f0
  404350:	83 c4 10             	add    esp,0x10
  404353:	8b 88 24 04 00 00    	mov    ecx,DWORD PTR [eax+0x424]
  404359:	3b cb                	cmp    ecx,ebx
  40435b:	74 25                	je     0x404382
  40435d:	6a 64                	push   0x64
  40435f:	53                   	push   ebx
  404360:	ff 75 0c             	push   DWORD PTR [ebp+0xc]
  404363:	ff b0 20 04 00 00    	push   DWORD PTR [eax+0x420]
  404369:	ff d1                	call   ecx
  40436b:	85 c0                	test   eax,eax
  40436d:	7d 13                	jge    0x404382
  40436f:	ff b6 2c 04 00 00    	push   DWORD PTR [esi+0x42c]
  404375:	56                   	push   esi
  404376:	e8 1e 03 00 00       	call   0x404699
  40437b:	59                   	pop    ecx
  40437c:	59                   	pop    ecx
  40437d:	6a f5                	push   0xfffffff5
  40437f:	58                   	pop    eax
  404380:	eb 36                	jmp    0x4043b8
  404382:	ff b6 2c 04 00 00    	push   DWORD PTR [esi+0x42c]
  404388:	56                   	push   esi
  404389:	e8 0b 03 00 00       	call   0x404699
  40438e:	59                   	pop    ecx
  40438f:	89 9e 2c 04 00 00    	mov    DWORD PTR [esi+0x42c],ebx
  404395:	59                   	pop    ecx
  404396:	89 1d f8 0e 41 00    	mov    DWORD PTR ds:0x410ef8,ebx
  40439c:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  40439f:	89 1d fc 0e 41 00    	mov    DWORD PTR ds:0x410efc,ebx
  4043a5:	89 1d f0 07 41 00    	mov    DWORD PTR ds:0x4107f0,ebx
  4043ab:	ff 76 04             	push   DWORD PTR [esi+0x4]
  4043ae:	e8 a4 fc ff ff       	call   0x404057
  4043b3:	a1 f4 07 41 00       	mov    eax,ds:0x4107f4
  4043b8:	5f                   	pop    edi
  4043b9:	5e                   	pop    esi
  4043ba:	5b                   	pop    ebx
  4043bb:	5d                   	pop    ebp
  4043bc:	c2 0c 00             	ret    0xc
  404544:	55                   	push   ebp
  404545:	8b ec                	mov    ebp,esp
  404547:	8b 4d 10             	mov    ecx,DWORD PTR [ebp+0x10]
  40454a:	56                   	push   esi
  40454b:	8b 75 08             	mov    esi,DWORD PTR [ebp+0x8]
  40454e:	57                   	push   edi
  40454f:	8b 46 0c             	mov    eax,DWORD PTR [esi+0xc]
  404552:	03 c8                	add    ecx,eax
  404554:	3b 4e 14             	cmp    ecx,DWORD PTR [esi+0x14]
  404557:	72 4d                	jb     0x4045a6
  404559:	03 46 18             	add    eax,DWORD PTR [esi+0x18]
  40455c:	6a 00                	push   0x0
  40455e:	6a 00                	push   0x0
  404560:	8b f8                	mov    edi,eax
  404562:	57                   	push   edi
  404563:	ff 76 1c             	push   DWORD PTR [esi+0x1c]
  404566:	ff 15 bc d0 40 00    	call   DWORD PTR ds:0x40d0bc
  40456c:	6a 00                	push   0x0
  40456e:	68 e8 07 41 00       	push   0x4107e8
  404573:	68 30 18 00 00       	push   0x1830
  404578:	ff 36                	push   DWORD PTR [esi]
  40457a:	ff 76 1c             	push   DWORD PTR [esi+0x1c]
  40457d:	ff 15 10 d1 40 00    	call   DWORD PTR ds:0x40d110
  404583:	ff 15 c4 d0 40 00    	call   DWORD PTR ds:0x40d0c4
  404589:	a3 ec 07 41 00       	mov    ds:0x4107ec,eax
  40458e:	a1 e8 07 41 00       	mov    eax,ds:0x4107e8
  404593:	83 66 0c 00          	and    DWORD PTR [esi+0xc],0x0
  404597:	89 46 14             	mov    DWORD PTR [esi+0x14],eax
  40459a:	85 c0                	test   eax,eax
  40459c:	89 7e 18             	mov    DWORD PTR [esi+0x18],edi
  40459f:	75 05                	jne    0x4045a6
  4045a1:	6a fd                	push   0xfffffffd
  4045a3:	58                   	pop    eax
  4045a4:	eb 2a                	jmp    0x4045d0
  4045a6:	8b 46 14             	mov    eax,DWORD PTR [esi+0x14]
  4045a9:	2b 46 0c             	sub    eax,DWORD PTR [esi+0xc]
  4045ac:	3b 45 10             	cmp    eax,DWORD PTR [ebp+0x10]
  4045af:	7e 03                	jle    0x4045b4
  4045b1:	8b 45 10             	mov    eax,DWORD PTR [ebp+0x10]
  4045b4:	33 c9                	xor    ecx,ecx
  4045b6:	85 c0                	test   eax,eax
  4045b8:	7e 16                	jle    0x4045d0
  4045ba:	8b 16                	mov    edx,DWORD PTR [esi]
  4045bc:	8b 7e 0c             	mov    edi,DWORD PTR [esi+0xc]
  4045bf:	8a 14 3a             	mov    dl,BYTE PTR [edx+edi*1]
  4045c2:	8b 7d 0c             	mov    edi,DWORD PTR [ebp+0xc]
  4045c5:	88 14 39             	mov    BYTE PTR [ecx+edi*1],dl
  4045c8:	ff 46 0c             	inc    DWORD PTR [esi+0xc]
  4045cb:	41                   	inc    ecx
  4045cc:	3b c8                	cmp    ecx,eax
  4045ce:	7c ea                	jl     0x4045ba
  4045d0:	5f                   	pop    edi
  4045d1:	5e                   	pop    esi
  4045d2:	5d                   	pop    ebp
  4045d3:	c3                   	ret
  4045d4:	56                   	push   esi
  4045d5:	8b 74 24 08          	mov    esi,DWORD PTR [esp+0x8]
  4045d9:	6a 02                	push   0x2
  4045db:	8d 46 08             	lea    eax,[esi+0x8]
  4045de:	50                   	push   eax
  4045df:	56                   	push   esi
  4045e0:	e8 0d 00 00 00       	call   0x4045f2
  4045e5:	83 c4 0c             	add    esp,0xc
  4045e8:	89 86 2c 04 00 00    	mov    DWORD PTR [esi+0x42c],eax
  4045ee:	33 c0                	xor    eax,eax
  4045f0:	5e                   	pop    esi
  4045f1:	c3                   	ret
  4046da:	83 3d f4 07 41 00 00 	cmp    DWORD PTR ds:0x4107f4,0x0
  4046e1:	56                   	push   esi
  4046e2:	75 64                	jne    0x404748
  4046e4:	8b 44 24 0c          	mov    eax,DWORD PTR [esp+0xc]
  4046e8:	ff 30                	push   DWORD PTR [eax]
  4046ea:	ff 74 24 0c          	push   DWORD PTR [esp+0xc]
  4046ee:	ff 35 f8 0e 41 00    	push   DWORD PTR ds:0x410ef8
  4046f4:	e8 4b fe ff ff       	call   0x404544
  4046f9:	8b f0                	mov    esi,eax
  4046fb:	83 c4 0c             	add    esp,0xc
  4046fe:	85 f6                	test   esi,esi
  404700:	7d 0d                	jge    0x40470f
  404702:	83 fe fd             	cmp    esi,0xfffffffd
  404705:	74 41                	je     0x404748
  404707:	89 35 f4 07 41 00    	mov    DWORD PTR ds:0x4107f4,esi
  40470d:	eb 39                	jmp    0x404748
  40470f:	8b 0d f0 07 41 00    	mov    ecx,DWORD PTR ds:0x4107f0
  404715:	8b 91 24 04 00 00    	mov    edx,DWORD PTR [ecx+0x424]
  40471b:	85 d2                	test   edx,edx
  40471d:	74 2d                	je     0x40474c
  40471f:	a1 f8 0e 41 00       	mov    eax,ds:0x410ef8
  404724:	57                   	push   edi
  404725:	8b 78 18             	mov    edi,DWORD PTR [eax+0x18]
  404728:	ff 70 10             	push   DWORD PTR [eax+0x10]
  40472b:	03 78 0c             	add    edi,DWORD PTR [eax+0xc]
  40472e:	57                   	push   edi
  40472f:	6a 00                	push   0x0
  404731:	ff b1 20 04 00 00    	push   DWORD PTR [ecx+0x420]
  404737:	ff d2                	call   edx
  404739:	85 c0                	test   eax,eax
  40473b:	5f                   	pop    edi
  40473c:	7d 0e                	jge    0x40474c
  40473e:	c7 05 f4 07 41 00 f5 	mov    DWORD PTR ds:0x4107f4,0xfffffff5
  404745:	ff ff ff
  404748:	33 c0                	xor    eax,eax
  40474a:	5e                   	pop    esi
  40474b:	c3                   	ret
  40474c:	8b c6                	mov    eax,esi
  40474e:	5e                   	pop    esi
  40474f:	c3                   	ret
  404750:	83 3d f4 07 41 00 00 	cmp    DWORD PTR ds:0x4107f4,0x0
  404757:	75 3f                	jne    0x404798
  404759:	a1 fc 0e 41 00       	mov    eax,ds:0x410efc
  40475e:	56                   	push   esi
  40475f:	8b 74 24 0c          	mov    esi,DWORD PTR [esp+0xc]
  404763:	6a 00                	push   0x0
  404765:	68 e8 07 41 00       	push   0x4107e8
  40476a:	ff 36                	push   DWORD PTR [esi]
  40476c:	ff 74 24 14          	push   DWORD PTR [esp+0x14]
  404770:	ff 70 1c             	push   DWORD PTR [eax+0x1c]
  404773:	ff 15 c0 d0 40 00    	call   DWORD PTR ds:0x40d0c0
  404779:	ff 15 c4 d0 40 00    	call   DWORD PTR ds:0x40d0c4
  40477f:	a3 ec 07 41 00       	mov    ds:0x4107ec,eax
  404784:	a1 e8 07 41 00       	mov    eax,ds:0x4107e8
  404789:	3b 06                	cmp    eax,DWORD PTR [esi]
  40478b:	5e                   	pop    esi
  40478c:	74 0d                	je     0x40479b
  40478e:	c7 05 f4 07 41 00 fc 	mov    DWORD PTR ds:0x4107f4,0xfffffffc
  404795:	ff ff ff
  404798:	33 c0                	xor    eax,eax
  40479a:	c3                   	ret
  40479b:	8b 0d fc 0e 41 00    	mov    ecx,DWORD PTR ds:0x410efc
  4047a1:	01 41 18             	add    DWORD PTR [ecx+0x18],eax
  4047a4:	c3                   	ret
  40507a:	55                   	push   ebp
  40507b:	8b ec                	mov    ebp,esp
  40507d:	81 ec 24 03 00 00    	sub    esp,0x324
  405083:	8d 85 dc fc ff ff    	lea    eax,[ebp-0x324]
  405089:	56                   	push   esi
  40508a:	50                   	push   eax
  40508b:	e8 24 01 00 00       	call   0x4051b4
  405090:	85 c0                	test   eax,eax
  405092:	59                   	pop    ecx
  405093:	0f 84 16 01 00 00    	je     0x4051af
  405099:	33 f6                	xor    esi,esi
  40509b:	8d 85 dc fc ff ff    	lea    eax,[ebp-0x324]
  4050a1:	56                   	push   esi
  4050a2:	68 b5 65 40 00       	push   0x4065b5
  4050a7:	6a 01                	push   0x1
  4050a9:	50                   	push   eax
  4050aa:	e8 d1 ef ff ff       	call   0x404080
  4050af:	3b c6                	cmp    eax,esi
  4050b1:	a3 b0 0d 41 00       	mov    ds:0x410db0,eax
  4050b6:	0f 84 e6 00 00 00    	je     0x4051a2
  4050bc:	8d 8d e4 fd ff ff    	lea    ecx,[ebp-0x21c]
  4050c2:	51                   	push   ecx
  4050c3:	68 90 f3 40 00       	push   0x40f390
  4050c8:	50                   	push   eax
  4050c9:	e8 dc f0 ff ff       	call   0x4041aa
  4050ce:	85 c0                	test   eax,eax
  4050d0:	0f 85 cc 00 00 00    	jne    0x4051a2
  4050d6:	8d 85 e4 fd ff ff    	lea    eax,[ebp-0x21c]
  4050dc:	50                   	push   eax
  4050dd:	68 84 f3 40 00       	push   0x40f384
  4050e2:	ff 35 b0 0d 41 00    	push   DWORD PTR ds:0x410db0
  4050e8:	e8 bd f0 ff ff       	call   0x4041aa
  4050ed:	85 c0                	test   eax,eax
  4050ef:	0f 85 ad 00 00 00    	jne    0x4051a2
  4050f5:	83 3d 14 0f 41 00 06 	cmp    DWORD PTR ds:0x410f14,0x6
  4050fc:	74 28                	je     0x405126
  4050fe:	8d 85 e4 fd ff ff    	lea    eax,[ebp-0x21c]
  405104:	50                   	push   eax
  405105:	68 78 f3 40 00       	push   0x40f378
  40510a:	ff 35 b0 0d 41 00    	push   DWORD PTR ds:0x410db0
  405110:	e8 95 f0 ff ff       	call   0x4041aa
  405115:	85 c0                	test   eax,eax
  405117:	0f 85 85 00 00 00    	jne    0x4051a2
  40511d:	83 3d 14 0f 41 00 06 	cmp    DWORD PTR ds:0x410f14,0x6
  405124:	75 34                	jne    0x40515a
  405126:	a1 10 0f 41 00       	mov    eax,ds:0x410f10
  40512b:	83 f8 02             	cmp    eax,0x2
  40512e:	74 0f                	je     0x40513f
  405130:	83 f8 03             	cmp    eax,0x3
  405133:	74 0a                	je     0x40513f
  405135:	83 f8 05             	cmp    eax,0x5
  405138:	74 05                	je     0x40513f
  40513a:	83 f8 04             	cmp    eax,0x4
  40513d:	75 4e                	jne    0x40518d
  40513f:	8d 85 e4 fd ff ff    	lea    eax,[ebp-0x21c]
  405145:	50                   	push   eax
  405146:	68 6c f3 40 00       	push   0x40f36c
  40514b:	ff 35 b0 0d 41 00    	push   DWORD PTR ds:0x410db0
  405151:	e8 54 f0 ff ff       	call   0x4041aa
  405156:	85 c0                	test   eax,eax
  405158:	75 48                	jne    0x4051a2
  40515a:	83 3d 14 0f 41 00 07 	cmp    DWORD PTR ds:0x410f14,0x7
  405161:	75 2a                	jne    0x40518d
  405163:	a1 10 0f 41 00       	mov    eax,ds:0x410f10
  405168:	83 f8 07             	cmp    eax,0x7
  40516b:	74 05                	je     0x405172
  40516d:	83 f8 06             	cmp    eax,0x6
  405170:	75 1b                	jne    0x40518d
  405172:	8d 85 e4 fd ff ff    	lea    eax,[ebp-0x21c]
  405178:	50                   	push   eax
  405179:	68 60 f3 40 00       	push   0x40f360
  40517e:	ff 35 b0 0d 41 00    	push   DWORD PTR ds:0x410db0
  405184:	e8 21 f0 ff ff       	call   0x4041aa
  405189:	85 c0                	test   eax,eax
  40518b:	75 15                	jne    0x4051a2
  40518d:	56                   	push   esi
  40518e:	56                   	push   esi
  40518f:	ff 35 a8 0b 41 00    	push   DWORD PTR ds:0x410ba8
  405195:	6a ff                	push   0xffffffff
  405197:	ff 15 f8 d1 40 00    	call   DWORD PTR ds:0x40d1f8
  40519d:	6a 01                	push   0x1
  40519f:	58                   	pop    eax
  4051a0:	eb 0f                	jmp    0x4051b1
  4051a2:	56                   	push   esi
  4051a3:	68 98 1b 00 00       	push   0x1b98
  4051a8:	e8 f4 0c 00 00       	call   0x405ea1
  4051ad:	59                   	pop    ecx
  4051ae:	59                   	pop    ecx
  4051af:	33 c0                	xor    eax,eax
  4051b1:	5e                   	pop    esi
  4051b2:	c9                   	leave
  4051b3:	c3                   	ret
  405ea1:	55                   	push   ebp
  405ea2:	8b ec                	mov    ebp,esp
  405ea4:	81 ec 44 03 00 00    	sub    esp,0x344
  405eaa:	56                   	push   esi
  405eab:	be 18 01 00 00       	mov    esi,0x118
  405eb0:	8d 85 bc fc ff ff    	lea    eax,[ebp-0x344]
  405eb6:	56                   	push   esi
  405eb7:	50                   	push   eax
  405eb8:	68 c6 1b 00 00       	push   0x1bc6
  405ebd:	e8 49 f6 ff ff       	call   0x40550b
  405ec2:	85 c0                	test   eax,eax
  405ec4:	75 34                	jne    0x405efa
  405ec6:	8d 85 bc fc ff ff    	lea    eax,[ebp-0x344]
  405ecc:	56                   	push   esi
  405ecd:	8b 35 e0 d1 40 00    	mov    esi,DWORD PTR ds:0x40d1e0
  405ed3:	50                   	push   eax
  405ed4:	68 c8 1b 00 00       	push   0x1bc8
  405ed9:	ff 35 08 0f 41 00    	push   DWORD PTR ds:0x410f08
  405edf:	ff d6                	call   esi
  405ee1:	8d 85 00 ff ff ff    	lea    eax,[ebp-0x100]
  405ee7:	68 00 01 00 00       	push   0x100
  405eec:	50                   	push   eax
  405eed:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  405ef0:	ff 35 08 0f 41 00    	push   DWORD PTR ds:0x410f08
  405ef6:	ff d6                	call   esi
  405ef8:	eb 14                	jmp    0x405f0e
  405efa:	8d 85 00 ff ff ff    	lea    eax,[ebp-0x100]
  405f00:	68 00 01 00 00       	push   0x100
  405f05:	50                   	push   eax
  405f06:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  405f09:	e8 fd f5 ff ff       	call   0x40550b
  405f0e:	8d 85 00 ff ff ff    	lea    eax,[ebp-0x100]
  405f14:	50                   	push   eax
  405f15:	8d 85 d4 fd ff ff    	lea    eax,[ebp-0x22c]
  405f1b:	50                   	push   eax
  405f1c:	ff 15 ac d0 40 00    	call   DWORD PTR ds:0x40d0ac
  405f22:	8b 45 08             	mov    eax,DWORD PTR [ebp+0x8]
  405f25:	2d 95 1b 00 00       	sub    eax,0x1b95
  405f2a:	74 3d                	je     0x405f69
  405f2c:	48                   	dec    eax
  405f2d:	48                   	dec    eax
  405f2e:	74 39                	je     0x405f69
  405f30:	83 e8 03             	sub    eax,0x3
  405f33:	74 34                	je     0x405f69
  405f35:	83 e8 03             	sub    eax,0x3
  405f38:	74 2f                	je     0x405f69
  405f3a:	48                   	dec    eax
  405f3b:	48                   	dec    eax
  405f3c:	74 0a                	je     0x405f48
  405f3e:	48                   	dec    eax
  405f3f:	75 42                	jne    0x405f83
  405f41:	68 20 0f 41 00       	push   0x410f20
  405f46:	eb 24                	jmp    0x405f6c
  405f48:	68 60 10 41 00       	push   0x411060
  405f4d:	8d 85 00 ff ff ff    	lea    eax,[ebp-0x100]
  405f53:	ff 75 0c             	push   DWORD PTR [ebp+0xc]
  405f56:	50                   	push   eax
  405f57:	8d 85 d4 fd ff ff    	lea    eax,[ebp-0x22c]
  405f5d:	50                   	push   eax
  405f5e:	ff 15 e4 d1 40 00    	call   DWORD PTR ds:0x40d1e4
  405f64:	83 c4 10             	add    esp,0x10
  405f67:	eb 1a                	jmp    0x405f83
  405f69:	ff 75 0c             	push   DWORD PTR [ebp+0xc]
  405f6c:	8d 85 00 ff ff ff    	lea    eax,[ebp-0x100]
  405f72:	50                   	push   eax
  405f73:	8d 85 d4 fd ff ff    	lea    eax,[ebp-0x22c]
  405f79:	50                   	push   eax
  405f7a:	ff 15 e4 d1 40 00    	call   DWORD PTR ds:0x40d1e4
  405f80:	83 c4 0c             	add    esp,0xc
  405f83:	6a 01                	push   0x1
  405f85:	8d 85 bc fc ff ff    	lea    eax,[ebp-0x344]
  405f8b:	5e                   	pop    esi
  405f8c:	6a 10                	push   0x10
  405f8e:	50                   	push   eax
  405f8f:	8d 85 d4 fd ff ff    	lea    eax,[ebp-0x22c]
  405f95:	89 35 10 f2 40 00    	mov    DWORD PTR ds:0x40f210,esi
  405f9b:	50                   	push   eax
  405f9c:	6a 00                	push   0x0
  405f9e:	ff 15 50 d2 40 00    	call   DWORD PTR ds:0x40d250
  405fa4:	8b c6                	mov    eax,esi
  405fa6:	5e                   	pop    esi
  405fa7:	c9                   	leave
  405fa8:	c3                   	ret
  40626f:	83 ec 1c             	sub    esp,0x1c
  406272:	53                   	push   ebx
  406273:	55                   	push   ebp
  406274:	56                   	push   esi
  406275:	33 f6                	xor    esi,esi
  406277:	39 74 24 2c          	cmp    DWORD PTR [esp+0x2c],esi
  40627b:	57                   	push   edi
  40627c:	74 5d                	je     0x4062db
  40627e:	8b 3d 3c d2 40 00    	mov    edi,DWORD PTR ds:0x40d23c
  406284:	56                   	push   esi
  406285:	56                   	push   esi
  406286:	8d 44 24 18          	lea    eax,[esp+0x18]
  40628a:	56                   	push   esi
  40628b:	50                   	push   eax
  40628c:	ff d7                	call   edi
  40628e:	85 c0                	test   eax,eax
  406290:	0f 84 d2 00 00 00    	je     0x406368
  406296:	ff 35 cc 0e 41 00    	push   DWORD PTR ds:0x410ecc
  40629c:	ff 15 88 d2 40 00    	call   DWORD PTR ds:0x40d288
  4062a2:	85 c0                	test   eax,eax
  4062a4:	74 15                	je     0x4062bb
  4062a6:	8d 44 24 10          	lea    eax,[esp+0x10]
  4062aa:	50                   	push   eax
  4062ab:	ff 35 cc 0e 41 00    	push   DWORD PTR ds:0x410ecc
  4062b1:	ff 15 40 d2 40 00    	call   DWORD PTR ds:0x40d240
  4062b7:	85 c0                	test   eax,eax
  4062b9:	75 16                	jne    0x4062d1
  4062bb:	8d 44 24 10          	lea    eax,[esp+0x10]
  4062bf:	50                   	push   eax
  4062c0:	ff 15 44 d2 40 00    	call   DWORD PTR ds:0x40d244
  4062c6:	8d 44 24 10          	lea    eax,[esp+0x10]
  4062ca:	50                   	push   eax
  4062cb:	ff 15 48 d2 40 00    	call   DWORD PTR ds:0x40d248
  4062d1:	56                   	push   esi
  4062d2:	56                   	push   esi
  4062d3:	8d 44 24 18          	lea    eax,[esp+0x18]
  4062d7:	56                   	push   esi
  4062d8:	50                   	push   eax
  4062d9:	eb b1                	jmp    0x40628c
  4062db:	8b 1d c8 d0 40 00    	mov    ebx,DWORD PTR ds:0x40d0c8
  4062e1:	ff d3                	call   ebx
  4062e3:	8b 2d 4c d2 40 00    	mov    ebp,DWORD PTR ds:0x40d24c
  4062e9:	56                   	push   esi
  4062ea:	8b f8                	mov    edi,eax
  4062ec:	56                   	push   esi
  4062ed:	56                   	push   esi
  4062ee:	8d 44 24 1c          	lea    eax,[esp+0x1c]
  4062f2:	56                   	push   esi
  4062f3:	81 c7 f4 01 00 00    	add    edi,0x1f4
  4062f9:	50                   	push   eax
  4062fa:	ff d5                	call   ebp
  4062fc:	85 c0                	test   eax,eax
  4062fe:	74 6d                	je     0x40636d
  406300:	ff d3                	call   ebx
  406302:	3b c7                	cmp    eax,edi
  406304:	73 67                	jae    0x40636d
  406306:	83 7c 24 14 12       	cmp    DWORD PTR [esp+0x14],0x12
  40630b:	74 54                	je     0x406361
  40630d:	ff 35 cc 0e 41 00    	push   DWORD PTR ds:0x410ecc
  406313:	ff 15 88 d2 40 00    	call   DWORD PTR ds:0x40d288
  406319:	85 c0                	test   eax,eax
  40631b:	75 15                	jne    0x406332
  40631d:	8d 44 24 10          	lea    eax,[esp+0x10]
  406321:	50                   	push   eax
  406322:	ff 35 cc 0e 41 00    	push   DWORD PTR ds:0x410ecc
  406328:	ff 15 40 d2 40 00    	call   DWORD PTR ds:0x40d240
  40632e:	85 c0                	test   eax,eax
  406330:	75 24                	jne    0x406356
  406332:	56                   	push   esi
  406333:	56                   	push   esi
  406334:	8d 44 24 18          	lea    eax,[esp+0x18]
  406338:	56                   	push   esi
  406339:	50                   	push   eax
  40633a:	ff 15 3c d2 40 00    	call   DWORD PTR ds:0x40d23c
  406340:	8d 44 24 10          	lea    eax,[esp+0x10]
  406344:	50                   	push   eax
  406345:	ff 15 44 d2 40 00    	call   DWORD PTR ds:0x40d244
  40634b:	8d 44 24 10          	lea    eax,[esp+0x10]
  40634f:	50                   	push   eax
  406350:	ff 15 48 d2 40 00    	call   DWORD PTR ds:0x40d248
  406356:	56                   	push   esi
  406357:	56                   	push   esi
  406358:	56                   	push   esi
  406359:	8d 44 24 1c          	lea    eax,[esp+0x1c]
  40635d:	56                   	push   esi
  40635e:	50                   	push   eax
  40635f:	eb 99                	jmp    0x4062fa
  406361:	56                   	push   esi
  406362:	ff 15 e8 d1 40 00    	call   DWORD PTR ds:0x40d1e8
  406368:	6a 01                	push   0x1
  40636a:	58                   	pop    eax
  40636b:	eb 02                	jmp    0x40636f
  40636d:	33 c0                	xor    eax,eax
  40636f:	5f                   	pop    edi
  406370:	5e                   	pop    esi
  406371:	5d                   	pop    ebp
  406372:	5b                   	pop    ebx
  406373:	83 c4 1c             	add    esp,0x1c
  406376:	c3                   	ret
  4064e6:	55                   	push   ebp
  4064e7:	8b ec                	mov    ebp,esp
  4064e9:	81 ec 24 03 00 00    	sub    esp,0x324
  4064ef:	8d 85 dc fc ff ff    	lea    eax,[ebp-0x324]
  4064f5:	50                   	push   eax
  4064f6:	ff 75 0c             	push   DWORD PTR [ebp+0xc]
  4064f9:	ff 35 b0 0d 41 00    	push   DWORD PTR ds:0x410db0
  4064ff:	e8 a6 dc ff ff       	call   0x4041aa
  406504:	85 c0                	test   eax,eax
  406506:	75 6d                	jne    0x406575
  406508:	8d 85 e1 fd ff ff    	lea    eax,[ebp-0x21f]
  40650e:	50                   	push   eax
  40650f:	8d 85 f8 fe ff ff    	lea    eax,[ebp-0x108]
  406515:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  406518:	50                   	push   eax
  406519:	e8 a1 0a 00 00       	call   0x406fbf
  40651e:	83 7d 10 00          	cmp    DWORD PTR [ebp+0x10],0x0
  406522:	74 0f                	je     0x406533
  406524:	ff 75 10             	push   DWORD PTR [ebp+0x10]
  406527:	8d 85 f8 fe ff ff    	lea    eax,[ebp-0x108]
  40652d:	50                   	push   eax
  40652e:	e8 57 0c 00 00       	call   0x40718a
  406533:	68 90 f3 40 00       	push   0x40f390
  406538:	ff 75 0c             	push   DWORD PTR [ebp+0xc]
  40653b:	ff 15 dc d0 40 00    	call   DWORD PTR ds:0x40d0dc
  406541:	85 c0                	test   eax,eax
  406543:	75 13                	jne    0x406558
  406545:	8d 85 f8 fe ff ff    	lea    eax,[ebp-0x108]
  40654b:	50                   	push   eax
  40654c:	ff 35 94 0d 41 00    	push   DWORD PTR ds:0x410d94
  406552:	ff 15 ac d0 40 00    	call   DWORD PTR ds:0x40d0ac
  406558:	8d 85 f8 fe ff ff    	lea    eax,[ebp-0x108]
  40655e:	50                   	push   eax
  40655f:	8d 85 dc fc ff ff    	lea    eax,[ebp-0x324]
  406565:	50                   	push   eax
  406566:	ff 35 b0 0d 41 00    	push   DWORD PTR ds:0x410db0
  40656c:	e8 07 dd ff ff       	call   0x404278
  406571:	85 c0                	test   eax,eax
  406573:	74 12                	je     0x406587
  406575:	6a 00                	push   0x0
  406577:	68 98 1b 00 00       	push   0x1b98
  40657c:	e8 20 f9 ff ff       	call   0x405ea1
  406581:	59                   	pop    ecx
  406582:	33 c0                	xor    eax,eax
  406584:	59                   	pop    ecx
  406585:	c9                   	leave
  406586:	c3                   	ret
  406587:	6a 01                	push   0x1
  406589:	58                   	pop    eax
  40658a:	c9                   	leave
  40658b:	c3                   	ret
  4065b5:	6a 00                	push   0x0
  4065b7:	e8 b3 fc ff ff       	call   0x40626f
  4065bc:	85 c0                	test   eax,eax
  4065be:	59                   	pop    ecx
  4065bf:	74 05                	je     0x4065c6
  4065c1:	83 c8 ff             	or     eax,0xffffffff
  4065c4:	eb 2c                	jmp    0x4065f2
  4065c6:	83 7c 24 08 00       	cmp    DWORD PTR [esp+0x8],0x0
  4065cb:	75 23                	jne    0x4065f0
  4065cd:	8b 54 24 0c          	mov    edx,DWORD PTR [esp+0xc]
  4065d1:	85 d2                	test   edx,edx
  4065d3:	74 09                	je     0x4065de
  4065d5:	a1 c4 0b 41 00       	mov    eax,ds:0x410bc4
  4065da:	3b d0                	cmp    edx,eax
  4065dc:	73 02                	jae    0x4065e0
  4065de:	33 c0                	xor    eax,eax
  4065e0:	8b ca                	mov    ecx,edx
  4065e2:	89 15 c4 0b 41 00    	mov    DWORD PTR ds:0x410bc4,edx
  4065e8:	2b c8                	sub    ecx,eax
  4065ea:	51                   	push   ecx
  4065eb:	e8 f3 c8 ff ff       	call   0x402ee3
  4065f0:	33 c0                	xor    eax,eax
  4065f2:	c2 10 00             	ret    0x10

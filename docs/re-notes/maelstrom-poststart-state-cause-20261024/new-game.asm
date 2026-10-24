
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00406230 <.text+0x5230>:
  406230:	83 3d fc f9 41 00 01 	cmp    DWORD PTR ds:0x41f9fc,0x1
  406237:	7e 2f                	jle    0x406268
  406239:	a1 d8 f9 41 00       	mov    eax,ds:0x41f9d8
  40623e:	68 90 f9 41 00       	push   0x41f990
  406243:	68 ac f9 41 00       	push   0x41f9ac
  406248:	68 bc f9 41 00       	push   0x41f9bc
  40624d:	85 c0                	test   eax,eax
  40624f:	75 07                	jne    0x406258
  406251:	e8 9a 82 00 00       	call   0x40e4f0
  406256:	eb 05                	jmp    0x40625d
  406258:	e8 d3 8a 00 00       	call   0x40ed30
  40625d:	83 c4 0c             	add    esp,0xc
  406260:	85 c0                	test   eax,eax
  406262:	0f 8c 4c 01 00 00    	jl     0x4063b4
  406268:	8b 0d 78 f9 41 00    	mov    ecx,DWORD PTR ds:0x41f978
  40626e:	6a 09                	push   0x9
  406270:	68 00 b4 41 00       	push   0x41b400
  406275:	e8 86 d3 00 00       	call   0x413600
  40627a:	85 c0                	test   eax,eax
  40627c:	a3 48 f3 41 00       	mov    ds:0x41f348,eax
  406281:	75 18                	jne    0x40629b
  406283:	68 dc b3 41 00       	push   0x41b3dc
  406288:	e8 a3 77 00 00       	call   0x40da30
  40628d:	83 c4 04             	add    esp,0x4
  406290:	68 ff 00 00 00       	push   0xff
  406295:	ff 15 a4 90 41 00    	call   DWORD PTR ds:0x4190a4
  40629b:	8b 0d 78 f9 41 00    	mov    ecx,DWORD PTR ds:0x41f978
  4062a1:	56                   	push   esi
  4062a2:	50                   	push   eax
  4062a3:	e8 28 d6 00 00       	call   0x4138d0
  4062a8:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  4062ae:	68 ff 00 00 00       	push   0xff
  4062b3:	25 ff ff 00 00       	and    eax,0xffff
  4062b8:	6a 75                	push   0x75
  4062ba:	6a 75                	push   0x75
  4062bc:	a3 e8 f2 41 00       	mov    ds:0x41f2e8,eax
  4062c1:	e8 0a fa 00 00       	call   0x415cd0
  4062c6:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  4062cc:	68 ff 00 00 00       	push   0xff
  4062d1:	68 ff 00 00 00       	push   0xff
  4062d6:	68 ff 00 00 00       	push   0xff
  4062db:	a3 1c f3 41 00       	mov    ds:0x41f31c,eax
  4062e0:	e8 eb f9 00 00       	call   0x415cd0
  4062e5:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  4062eb:	6a 00                	push   0x0
  4062ed:	6a 00                	push   0x0
  4062ef:	6a 00                	push   0x0
  4062f1:	a3 3c f3 41 00       	mov    ds:0x41f33c,eax
  4062f6:	e8 d5 f9 00 00       	call   0x415cd0
  4062fb:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  406301:	a3 bc f2 41 00       	mov    ds:0x41f2bc,eax
  406306:	e8 45 05 01 00       	call   0x416850
  40630b:	6a 00                	push   0x0
  40630d:	e8 56 d1 00 00       	call   0x413468
  406312:	a1 bc f9 41 00       	mov    eax,ds:0x41f9bc
  406317:	8b 35 fc f9 41 00    	mov    esi,DWORD PTR ds:0x41f9fc
  40631d:	83 c4 04             	add    esp,0x4
  406320:	48                   	dec    eax
  406321:	85 f6                	test   esi,esi
  406323:	c7 05 a4 f2 41 00 01 	mov    DWORD PTR ds:0x41f2a4,0x1
  40632a:	00 00 00
  40632d:	c7 05 14 f3 41 00 00 	mov    DWORD PTR ds:0x41f314,0x0
  406334:	00 00 00
  406337:	a3 9c f2 41 00       	mov    ds:0x41f29c,eax
  40633c:	74 17                	je     0x406355
  40633e:	8b 0c b5 08 0c 42 00 	mov    ecx,DWORD PTR [esi*4+0x420c08]
  406345:	a1 ac f9 41 00       	mov    eax,ds:0x41f9ac
  40634a:	4e                   	dec    esi
  40634b:	50                   	push   eax
  40634c:	8b 11                	mov    edx,DWORD PTR [ecx]
  40634e:	ff 52 78             	call   DWORD PTR [edx+0x78]
  406351:	85 f6                	test   esi,esi
  406353:	75 e9                	jne    0x40633e
  406355:	c7 05 b0 f2 41 00 0f 	mov    DWORD PTR ds:0x41f2b0,0xf
  40635c:	00 00 00
  40635f:	c7 05 24 f7 41 00 00 	mov    DWORD PTR ds:0x41f724,0x0
  406366:	00 00 00
  406369:	c7 05 e0 f4 41 00 00 	mov    DWORD PTR ds:0x41f4e0,0x0
  406370:	00 00 00
  406373:	e8 78 01 00 00       	call   0x4064f0
  406378:	e8 23 b6 ff ff       	call   0x4019a0
  40637d:	85 c0                	test   eax,eax
  40637f:	5e                   	pop    esi
  406380:	7e 17                	jle    0x406399
  406382:	a1 a4 f2 41 00       	mov    eax,ds:0x41f2a4
  406387:	85 c0                	test   eax,eax
  406389:	74 0e                	je     0x406399
  40638b:	e8 30 00 00 00       	call   0x4063c0
  406390:	e8 0b b6 ff ff       	call   0x4019a0
  406395:	85 c0                	test   eax,eax
  406397:	7f e9                	jg     0x406382
  406399:	e8 12 05 00 00       	call   0x4068b0
  40639e:	6a 01                	push   0x1
  4063a0:	e8 c3 d0 00 00       	call   0x413468
  4063a5:	8b 0d 48 f3 41 00    	mov    ecx,DWORD PTR ds:0x41f348
  4063ab:	51                   	push   ecx
  4063ac:	e8 5f 10 01 00       	call   0x417410
  4063b1:	83 c4 08             	add    esp,0x8
  4063b4:	c3                   	ret

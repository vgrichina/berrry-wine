  403c8b:	c7 05 40 fd 40 00 00 	mov    DWORD PTR ds:0x40fd40,0x0
  403c92:	00 00 00 
  403c95:	c7 45 d4 43 01 00 00 	mov    DWORD PTR [ebp-0x2c],0x143
  403c9c:	c7 05 90 32 41 00 00 	mov    DWORD PTR ds:0x413290,0x0
  403ca3:	00 00 00 
  403ca6:	c7 05 80 f4 40 00 00 	mov    DWORD PTR ds:0x40f480,0x0
  403cad:	00 00 00 
  403cb0:	c7 05 50 1a 41 00 00 	mov    DWORD PTR ds:0x411a50,0x0
  403cb7:	00 00 00 
  403cba:	c7 05 70 1a 41 00 00 	mov    DWORD PTR ds:0x411a70,0x0
  403cc1:	00 00 00 
  403cc4:	c7 05 60 fd 40 00 00 	mov    DWORD PTR ds:0x40fd60,0x0
  403ccb:	00 00 00 
  403cce:	c7 05 f0 f3 40 00 00 	mov    DWORD PTR ds:0x40f3f0,0x0
  403cd5:	00 00 00 
  403cd8:	c7 05 c0 fd 40 00 00 	mov    DWORD PTR ds:0x40fdc0,0x0
  403cdf:	00 00 00 
  403ce2:	c7 45 d0 00 00 00 00 	mov    DWORD PTR [ebp-0x30],0x0
  403ce9:	c7 45 cc 00 00 00 00 	mov    DWORD PTR [ebp-0x34],0x0
  403cf0:	c7 05 70 f2 40 00 00 	mov    DWORD PTR ds:0x40f270,0x0
  403cf7:	00 00 00 
  403cfa:	c7 45 b8 01 00 00 00 	mov    DWORD PTR [ebp-0x48],0x1
  403d01:	c7 05 60 f4 40 00 00 	mov    DWORD PTR ds:0x40f460,0x0
  403d08:	00 00 00 
  403d0b:	e8 70 6c 00 00       	call   0x40a980
  403d10:	89 45 ac             	mov    DWORD PTR [ebp-0x54],eax
  403d13:	ff 05 40 fd 40 00    	inc    DWORD PTR ds:0x40fd40
  403d19:	c7 45 c4 00 00 00 00 	mov    DWORD PTR [ebp-0x3c],0x0
  403d20:	8d 45 d8             	lea    eax,[ebp-0x28]
  403d23:	89 04 24             	mov    DWORD PTR [esp],eax
  403d26:	e8 65 6c 00 00       	call   0x40a990
  403d2b:	85 c0                	test   eax,eax
  403d2d:	75 05                	jne    0x403d34
  403d2f:	e9 67 02 00 00       	jmp    0x403f9b
  403d34:	80 7d d8 02          	cmp    BYTE PTR [ebp-0x28],0x2

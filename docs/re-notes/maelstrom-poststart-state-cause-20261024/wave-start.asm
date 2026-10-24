
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

004064f0 <.text+0x54f0>:
  4064f0:	a1 d8 f9 41 00       	mov    eax,ds:0x41f9d8
  4064f5:	8b 0d bc f9 41 00    	mov    ecx,DWORD PTR ds:0x41f9bc
  4064fb:	53                   	push   ebx
  4064fc:	33 db                	xor    ebx,ebx
  4064fe:	a3 44 f3 41 00       	mov    ds:0x41f344,eax
  406503:	a1 9c f2 41 00       	mov    eax,ds:0x41f29c
  406508:	49                   	dec    ecx
  406509:	56                   	push   esi
  40650a:	3b c1                	cmp    eax,ecx
  40650c:	89 1d 0c f3 41 00    	mov    DWORD PTR ds:0x41f30c,ebx
  406512:	89 1d 94 f2 41 00    	mov    DWORD PTR ds:0x41f294,ebx
  406518:	89 1d ec f2 41 00    	mov    DWORD PTR ds:0x41f2ec,ebx
  40651e:	89 1d f8 f2 41 00    	mov    DWORD PTR ds:0x41f2f8,ebx
  406524:	74 05                	je     0x40652b
  406526:	e8 55 0c 00 00       	call   0x407180
  40652b:	57                   	push   edi
  40652c:	8b 3d 9c f2 41 00    	mov    edi,DWORD PTR ds:0x41f29c
  406532:	47                   	inc    edi
  406533:	6a 02                	push   0x2
  406535:	89 3d 9c f2 41 00    	mov    DWORD PTR ds:0x41f29c,edi
  40653b:	e8 b0 f1 ff ff       	call   0x4056f0
  406540:	83 c4 04             	add    esp,0x4
  406543:	be 1e 00 00 00       	mov    esi,0x1e

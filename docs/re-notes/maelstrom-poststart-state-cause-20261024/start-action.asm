
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

0040b0c0 <.text+0xa0c0>:
  40b0c0:	8b 0d 74 f9 41 00    	mov    ecx,DWORD PTR ds:0x41f974
  40b0c6:	c7 05 ac f9 41 00 03 	mov    DWORD PTR ds:0x41f9ac,0x3
  40b0cd:	00 00 00
  40b0d0:	c7 05 bc f9 41 00 01 	mov    DWORD PTR ds:0x41f9bc,0x1
  40b0d7:	00 00 00
  40b0da:	c7 05 90 f9 41 00 00 	mov    DWORD PTR ds:0x41f990,0x0
  40b0e1:	00 00 00
  40b0e4:	33 c0                	xor    eax,eax
  40b0e6:	8d 51 08             	lea    edx,[ecx+0x8]
  40b0e9:	56                   	push   esi
  40b0ea:	83 3a 00             	cmp    DWORD PTR [edx],0x0
  40b0ed:	7e 2d                	jle    0x40b11c
  40b0ef:	40                   	inc    eax
  40b0f0:	83 c2 10             	add    edx,0x10
  40b0f3:	83 f8 04             	cmp    eax,0x4
  40b0f6:	7c f2                	jl     0x40b0ea
  40b0f8:	33 d2                	xor    edx,edx
  40b0fa:	8b c2                	mov    eax,edx
  40b0fc:	25 ff 00 00 00       	and    eax,0xff
  40b101:	c1 e0 04             	shl    eax,0x4
  40b104:	03 c1                	add    eax,ecx
  40b106:	8b 70 08             	mov    esi,DWORD PTR [eax+0x8]
  40b109:	85 f6                	test   esi,esi
  40b10b:	7e 14                	jle    0x40b121
  40b10d:	66 83 78 06 05       	cmp    WORD PTR [eax+0x6],0x5
  40b112:	7c 0d                	jl     0x40b121
  40b114:	42                   	inc    edx
  40b115:	83 fa 04             	cmp    edx,0x4
  40b118:	7c e0                	jl     0x40b0fa
  40b11a:	eb 11                	jmp    0x40b12d
  40b11c:	6a 00                	push   0x0
  40b11e:	50                   	push   eax
  40b11f:	eb 03                	jmp    0x40b124
  40b121:	6a 00                	push   0x0
  40b123:	52                   	push   edx
  40b124:	6a 05                	push   0x5
  40b126:	6a 72                	push   0x72
  40b128:	e8 03 91 00 00       	call   0x414230
  40b12d:	6a 64                	push   0x64
  40b12f:	e8 ec 82 00 00       	call   0x413420
  40b134:	e8 f7 b0 ff ff       	call   0x406230
  40b139:	6a 00                	push   0x0
  40b13b:	e8 30 0e 00 00       	call   0x40bf70
  40b140:	83 c4 08             	add    esp,0x8
  40b143:	5e                   	pop    esi
  40b144:	c3                   	ret


/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

004019a0 <.text+0x9a0>:
  4019a0:	56                   	push   esi
  4019a1:	6a 00                	push   0x0
  4019a3:	e8 a8 0e 00 00       	call   0x402850
  4019a8:	83 c4 04             	add    esp,0x4
  4019ab:	e8 50 c6 00 00       	call   0x40e000
  4019b0:	85 c0                	test   eax,eax
  4019b2:	7d 11                	jge    0x4019c5
  4019b4:	68 a0 b0 41 00       	push   0x41b0a0
  4019b9:	e8 72 c0 00 00       	call   0x40da30
  4019be:	83 c4 04             	add    esp,0x4
  4019c1:	33 c0                	xor    eax,eax
  4019c3:	5e                   	pop    esi
  4019c4:	c3                   	ret
  4019c5:	a1 fc f9 41 00       	mov    eax,ds:0x41f9fc
  4019ca:	8d 70 ff             	lea    esi,[eax-0x1]
  4019cd:	85 f6                	test   esi,esi
  4019cf:	7c 12                	jl     0x4019e3
  4019d1:	8b 0c b5 0c 0c 42 00 	mov    ecx,DWORD PTR [esi*4+0x420c0c]
  4019d8:	8b 11                	mov    edx,DWORD PTR [ecx]
  4019da:	ff 92 84 00 00 00    	call   DWORD PTR [edx+0x84]
  4019e0:	4e                   	dec    esi
  4019e1:	79 ee                	jns    0x4019d1
  4019e3:	a1 14 f3 41 00       	mov    eax,ds:0x41f314
  4019e8:	85 c0                	test   eax,eax
  4019ea:	7e 07                	jle    0x4019f3
  4019ec:	b8 01 00 00 00       	mov    eax,0x1
  4019f1:	5e                   	pop    esi
  4019f2:	c3                   	ret

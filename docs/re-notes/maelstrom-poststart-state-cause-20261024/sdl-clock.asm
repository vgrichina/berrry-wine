
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL.dll:     file format pei-i386


Disassembly of section .text:

10022cd0 <.text+0x21cd0>:
10022cd0:	a1 2c 77 03 10       	mov    eax,ds:0x1003772c
10022cd5:	83 ec 08             	sub    esp,0x8
10022cd8:	85 c0                	test   eax,eax
10022cda:	74 4d                	je     0x10022d29
10022cdc:	8d 44 24 00          	lea    eax,[esp+0x0]
10022ce0:	50                   	push   eax
10022ce1:	ff 15 8c a0 02 10    	call   DWORD PTR ds:0x1002a08c
10022ce7:	8b 4c 24 00          	mov    ecx,DWORD PTR [esp+0x0]
10022ceb:	8b 15 38 77 03 10    	mov    edx,DWORD PTR ds:0x10037738
10022cf1:	a1 3c 77 03 10       	mov    eax,ds:0x1003773c
10022cf6:	2b ca                	sub    ecx,edx
10022cf8:	8b 54 24 04          	mov    edx,DWORD PTR [esp+0x4]
10022cfc:	6a 00                	push   0x0
10022cfe:	1b d0                	sbb    edx,eax
10022d00:	68 e8 03 00 00       	push   0x3e8
10022d05:	52                   	push   edx
10022d06:	51                   	push   ecx
10022d07:	e8 f4 6a 00 00       	call   0x10029800
10022d0c:	8b 0d 34 77 03 10    	mov    ecx,DWORD PTR ds:0x10037734
10022d12:	51                   	push   ecx
10022d13:	8b 0d 30 77 03 10    	mov    ecx,DWORD PTR ds:0x10037730
10022d19:	51                   	push   ecx
10022d1a:	52                   	push   edx
10022d1b:	50                   	push   eax
10022d1c:	e8 2f 6a 00 00       	call   0x10029750
10022d21:	89 54 24 04          	mov    DWORD PTR [esp+0x4],edx
10022d25:	83 c4 08             	add    esp,0x8
10022d28:	c3                   	ret
10022d29:	ff 15 14 a2 02 10    	call   DWORD PTR ds:0x1002a214
10022d2f:	8b 0d 28 77 03 10    	mov    ecx,DWORD PTR ds:0x10037728
10022d35:	3b c1                	cmp    eax,ecx
10022d37:	73 07                	jae    0x10022d40
10022d39:	2b c1                	sub    eax,ecx
10022d3b:	48                   	dec    eax
10022d3c:	83 c4 08             	add    esp,0x8
10022d3f:	c3                   	ret
10022d40:	2b c1                	sub    eax,ecx
10022d42:	83 c4 08             	add    esp,0x8
10022d45:	c3                   	ret
10022d46:	90                   	nop
10022d47:	90                   	nop
10022d48:	90                   	nop
10022d49:	90                   	nop
10022d4a:	90                   	nop
10022d4b:	90                   	nop
10022d4c:	90                   	nop
10022d4d:	90                   	nop
10022d4e:	90                   	nop
10022d4f:	90                   	nop
10022d50:	8b 44 24 04          	mov    eax,DWORD PTR [esp+0x4]
10022d54:	50                   	push   eax
10022d55:	ff 15 90 a0 02 10    	call   DWORD PTR ds:0x1002a090
10022d5b:	c3                   	ret

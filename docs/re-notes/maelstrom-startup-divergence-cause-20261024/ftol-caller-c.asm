
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00416350 <.text+0x15350>:
  416350:	8b 6c 24 10          	mov    ebp,DWORD PTR [esp+0x10]
  416354:	2b c1                	sub    eax,ecx
  416356:	81 e5 ff 00 00 00    	and    ebp,0xff
  41635c:	0f bf d1             	movsx  edx,cx
  41635f:	8b fd                	mov    edi,ebp
  416361:	89 54 24 10          	mov    DWORD PTR [esp+0x10],edx
  416365:	0f af fa             	imul   edi,edx
  416368:	40                   	inc    eax
  416369:	25 ff ff 00 00       	and    eax,0xffff
  41636e:	89 44 24 14          	mov    DWORD PTR [esp+0x14],eax
  416372:	db 44 24 10          	fild   DWORD PTR [esp+0x10]
  416376:	8b 4c 24 44          	mov    ecx,DWORD PTR [esp+0x44]
  41637a:	8b 1e                	mov    ebx,DWORD PTR [esi]
  41637c:	51                   	push   ecx
  41637d:	53                   	push   ebx
  41637e:	dc 4c 24 20          	fmul   QWORD PTR [esp+0x20]
  416382:	dc 44 24 28          	fadd   QWORD PTR [esp+0x28]
  416386:	e8 a5 10 00 00       	call   0x417430
  41638b:	0f bf d0             	movsx  edx,ax
  41638e:	33 c0                	xor    eax,eax
  416390:	8b 4e 0c             	mov    ecx,DWORD PTR [esi+0xc]
  416393:	66 8b 43 10          	mov    ax,WORD PTR [ebx+0x10]
  416397:	0f af d0             	imul   edx,eax
  41639a:	03 d7                	add    edx,edi
  41639c:	03 d1                	add    edx,ecx
  41639e:	52                   	push   edx
  41639f:	ff 96 5c 08 00 00    	call   DWORD PTR [esi+0x85c]
  4163a5:	8b 54 24 1c          	mov    edx,DWORD PTR [esp+0x1c]
  4163a9:	8b 44 24 20          	mov    eax,DWORD PTR [esp+0x20]
  4163ad:	83 c4 0c             	add    esp,0xc
  4163b0:	42                   	inc    edx
  4163b1:	03 fd                	add    edi,ebp
  4163b3:	48                   	dec    eax
  4163b4:	89 54 24 10          	mov    DWORD PTR [esp+0x10],edx
  4163b8:	89 44 24 14          	mov    DWORD PTR [esp+0x14],eax
  4163bc:	75 b4                	jne    0x416372
  4163be:	e9 81 00 00 00       	jmp    0x416444
  4163c3:	8b cf                	mov    ecx,edi
  4163c5:	8b c3                	mov    eax,ebx
  4163c7:	66 3b c8             	cmp    cx,ax
  4163ca:	0f 8f 84 00 00 00    	jg     0x416454
  4163d0:	dd 05 50 9b 41 00    	fld    QWORD PTR ds:0x419b50
  4163d6:	dc 74 24 18          	fdiv   QWORD PTR [esp+0x18]
  4163da:	8b 6c 24 10          	mov    ebp,DWORD PTR [esp+0x10]
  4163de:	2b c1                	sub    eax,ecx
  4163e0:	81 e5 ff 00 00 00    	and    ebp,0xff
  4163e6:	40                   	inc    eax
  4163e7:	0f bf d9             	movsx  ebx,cx
  4163ea:	25 ff ff 00 00       	and    eax,0xffff
  4163ef:	89 5c 24 14          	mov    DWORD PTR [esp+0x14],ebx
  4163f3:	89 44 24 10          	mov    DWORD PTR [esp+0x10],eax
  4163f7:	dd 5c 24 18          	fstp   QWORD PTR [esp+0x18]
  4163fb:	db 44 24 14          	fild   DWORD PTR [esp+0x14]
  4163ff:	8b 4c 24 44          	mov    ecx,DWORD PTR [esp+0x44]
  416403:	8b 3e                	mov    edi,DWORD PTR [esi]
  416405:	51                   	push   ecx
  416406:	57                   	push   edi
  416407:	dc 64 24 28          	fsub   QWORD PTR [esp+0x28]
  41640b:	dc 4c 24 20          	fmul   QWORD PTR [esp+0x20]
  41640f:	e8 1c 10 00 00       	call   0x417430
  416414:	0f bf d0             	movsx  edx,ax
  416417:	33 c0                	xor    eax,eax
  416419:	0f af d5             	imul   edx,ebp
  41641c:	66 8b 47 10          	mov    ax,WORD PTR [edi+0x10]
  416420:	0f af c3             	imul   eax,ebx
  416423:	03 d0                	add    edx,eax
  416425:	8b 46 0c             	mov    eax,DWORD PTR [esi+0xc]
  416428:	03 d0                	add    edx,eax
  41642a:	52                   	push   edx
  41642b:	ff 96 5c 08 00 00    	call   DWORD PTR [esi+0x85c]
  416431:	8b 44 24 1c          	mov    eax,DWORD PTR [esp+0x1c]
  416435:	83 c4 0c             	add    esp,0xc

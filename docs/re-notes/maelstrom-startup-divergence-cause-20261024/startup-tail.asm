
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00417571 <.text+0x16571>:
  417571:	89 5d d0             	mov    DWORD PTR [ebp-0x30],ebx
  417574:	8d 45 a4             	lea    eax,[ebp-0x5c]
  417577:	50                   	push   eax
  417578:	ff 15 0c 90 41 00    	call   DWORD PTR ds:0x41900c
  41757e:	f6 45 d0 01          	test   BYTE PTR [ebp-0x30],0x1
  417582:	74 11                	je     0x417595
  417584:	0f b7 45 d4          	movzx  eax,WORD PTR [ebp-0x2c]
  417588:	eb 0e                	jmp    0x417598
  41758a:	80 3e 20             	cmp    BYTE PTR [esi],0x20
  41758d:	76 d8                	jbe    0x417567
  41758f:	46                   	inc    esi
  417590:	89 75 8c             	mov    DWORD PTR [ebp-0x74],esi
  417593:	eb f5                	jmp    0x41758a
  417595:	6a 0a                	push   0xa
  417597:	58                   	pop    eax
  417598:	50                   	push   eax
  417599:	56                   	push   esi
  41759a:	53                   	push   ebx
  41759b:	53                   	push   ebx
  41759c:	ff 15 10 90 41 00    	call   DWORD PTR ds:0x419010
  4175a2:	50                   	push   eax
  4175a3:	e8 b8 02 00 00       	call   0x417860
  4175a8:	89 45 98             	mov    DWORD PTR [ebp-0x68],eax
  4175ab:	50                   	push   eax
  4175ac:	ff 15 a4 90 41 00    	call   DWORD PTR ds:0x4190a4
  4175b2:	8b 45 ec             	mov    eax,DWORD PTR [ebp-0x14]
  4175b5:	8b 08                	mov    ecx,DWORD PTR [eax]
  4175b7:	8b 09                	mov    ecx,DWORD PTR [ecx]

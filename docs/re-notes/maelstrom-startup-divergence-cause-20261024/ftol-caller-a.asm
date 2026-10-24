
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00403857 <.text+0x2857>:
  403857:	db 46 10             	fild   DWORD PTR [esi+0x10]
  40385a:	dd 44 24 38          	fld    QWORD PTR [esp+0x38]
  40385e:	d8 d9                	fcomp  st(1)
  403860:	df e0                	fnstsw ax
  403862:	25 00 41 00 00       	and    eax,0x4100
  403867:	75 06                	jne    0x40386f
  403869:	dd 5c 24 38          	fstp   QWORD PTR [esp+0x38]
  40386d:	eb 02                	jmp    0x403871
  40386f:	dd d8                	fstp   st(0)
  403871:	dd 44 24 38          	fld    QWORD PTR [esp+0x38]
  403875:	6a 01                	push   0x1
  403877:	e8 b4 3b 01 00       	call   0x417430
  40387c:	dd 44 24 34          	fld    QWORD PTR [esp+0x34]
  403880:	50                   	push   eax
  403881:	e8 aa 3b 01 00       	call   0x417430
  403886:	dd 44 24 30          	fld    QWORD PTR [esp+0x30]
  40388a:	50                   	push   eax
  40388b:	e8 a0 3b 01 00       	call   0x417430
  403890:	dd 44 24 24          	fld    QWORD PTR [esp+0x24]
  403894:	50                   	push   eax
  403895:	e8 96 3b 01 00       	call   0x417430
  40389a:	8b 0e                	mov    ecx,DWORD PTR [esi]
  40389c:	50                   	push   eax
  40389d:	e8 2e 26 01 00       	call   0x415ed0
  4038a2:	8b 0e                	mov    ecx,DWORD PTR [esi]
  4038a4:	6a 00                	push   0x0
  4038a6:	e8 75 25 01 00       	call   0x415e20

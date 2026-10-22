
/home/user/wine-assembly-aoe3-unsupported-dialog-diagnosis-oct22/scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis/original/age3.exe:     file format pei-i386


Disassembly of section .text:

008e4bc0 <.text+0x4e3bc0>:
  8e4bc0:	51                   	push   ecx
  8e4bc1:	8b 44 24 0c          	mov    eax,DWORD PTR [esp+0xc]
  8e4bc5:	53                   	push   ebx
  8e4bc6:	50                   	push   eax
  8e4bc7:	8d 4c 24 08          	lea    ecx,[esp+0x8]
  8e4bcb:	e8 d0 f8 ff ff       	call   0x8e44a0
  8e4bd0:	8b 4c 24 0c          	mov    ecx,DWORD PTR [esp+0xc]
  8e4bd4:	50                   	push   eax
  8e4bd5:	51                   	push   ecx
  8e4bd6:	b9 18 25 ce 00       	mov    ecx,0xce2518
  8e4bdb:	e8 b0 3b 03 00       	call   0x918790
  8e4be0:	8a d8                	mov    bl,al
  8e4be2:	8b 44 24 04          	mov    eax,DWORD PTR [esp+0x4]
  8e4be6:	85 c0                	test   eax,eax
  8e4be8:	74 0e                	je     0x8e4bf8
  8e4bea:	83 c0 f0             	add    eax,0xfffffff0
  8e4bed:	50                   	push   eax
  8e4bee:	b9 18 25 ce 00       	mov    ecx,0xce2518
  8e4bf3:	e8 b8 39 03 00       	call   0x9185b0
  8e4bf8:	8a c3                	mov    al,bl
  8e4bfa:	5b                   	pop    ebx
  8e4bfb:	59                   	pop    ecx
  8e4bfc:	c3                   	ret

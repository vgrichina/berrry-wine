
/home/user/wine-assembly-aoe3-unsupported-dialog-diagnosis-oct22/scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis/original/age3.exe:     file format pei-i386


Disassembly of section .text:

008e7380 <.text+0x4e6380>:
  8e7380:	51                   	push   ecx
  8e7381:	56                   	push   esi
  8e7382:	8b 74 24 10          	mov    esi,DWORD PTR [esp+0x10]
  8e7386:	85 f6                	test   esi,esi
  8e7388:	74 7d                	je     0x8e7407
  8e738a:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  8e738e:	e8 3d bc ff ff       	call   0x8e2fd0
  8e7393:	6a ff                	push   0xffffffff
  8e7395:	6a ff                	push   0xffffffff
  8e7397:	56                   	push   esi
  8e7398:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  8e739c:	e8 4f bf ff ff       	call   0x8e32f0
  8e73a1:	6a ff                	push   0xffffffff
  8e73a3:	6a ff                	push   0xffffffff
  8e73a5:	68 e8 c8 bc 00       	push   0xbcc8e8
  8e73aa:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  8e73ae:	e8 ed c2 ff ff       	call   0x8e36a0
  8e73b3:	8d 4c 24 04          	lea    ecx,[esp+0x4]
  8e73b7:	e8 14 bc ff ff       	call   0x8e2fd0
  8e73bc:	8b 54 24 0c          	mov    edx,DWORD PTR [esp+0xc]
  8e73c0:	6a 00                	push   0x0
  8e73c2:	6a 01                	push   0x1
  8e73c4:	8d 44 24 0c          	lea    eax,[esp+0xc]
  8e73c8:	50                   	push   eax
  8e73c9:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  8e73cd:	51                   	push   ecx
  8e73ce:	52                   	push   edx
  8e73cf:	b9 30 28 ce 00       	mov    ecx,0xce2830
  8e73d4:	e8 37 e6 00 00       	call   0x8f5a10
  8e73d9:	84 c0                	test   al,al
  8e73db:	8d 4c 24 04          	lea    ecx,[esp+0x4]
  8e73df:	74 18                	je     0x8e73f9
  8e73e1:	8b 44 24 14          	mov    eax,DWORD PTR [esp+0x14]
  8e73e5:	50                   	push   eax
  8e73e6:	51                   	push   ecx
  8e73e7:	b9 30 28 ce 00       	mov    ecx,0xce2830
  8e73ec:	e8 ff d4 00 00       	call   0x8f48f0
  8e73f1:	84 c0                	test   al,al
  8e73f3:	8d 4c 24 04          	lea    ecx,[esp+0x4]
  8e73f7:	75 15                	jne    0x8e740e
  8e73f9:	e8 72 c1 ff ff       	call   0x8e3570
  8e73fe:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  8e7402:	e8 69 c1 ff ff       	call   0x8e3570
  8e7407:	32 c0                	xor    al,al
  8e7409:	5e                   	pop    esi
  8e740a:	59                   	pop    ecx
  8e740b:	c2 0c 00             	ret    0xc
  8e740e:	e8 5d c1 ff ff       	call   0x8e3570
  8e7413:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  8e7417:	e8 54 c1 ff ff       	call   0x8e3570
  8e741c:	b0 01                	mov    al,0x1
  8e741e:	5e                   	pop    esi
  8e741f:	59                   	pop    ecx
  8e7420:	c2 0c 00             	ret    0xc

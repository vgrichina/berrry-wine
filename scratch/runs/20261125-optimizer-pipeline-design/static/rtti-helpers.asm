--- 0x4064e8 ---
004064e8  31 c9                        xor ecx, ecx
004064ea  53                           push ebx
004064eb  8a 4a 01                     mov cl, [edx+0x1]
004064ee  56                           push esi
004064ef  57                           push edi
004064f0  89 c3                        mov ebx, eax
004064f2  8d 74 11 0a                  lea esi, [ecx+edx+0xa]
004064f6  8b 7c 11 06                  mov edi, [ecx+edx+0x6]
004064fa  8b 16                        mov edx, [esi]
004064fc  8b 46 04                     mov eax, [esi+0x4]
004064ff  01 d8                        add eax, ebx
00406501  8b 12                        mov edx, [edx]
00406503  b9 01 00 00 00               mov ecx, 0x1
00406508  e8 27 00 00 00               call 0x406534
0040650d  83 c6 08                     add dword esi, 0x8
00406510  4f                           dec edi
00406511  7f e7                        jg short 0x4064fa
00406513  89 d8                        mov eax, ebx
00406515  5f                           pop edi
00406516  5e                           pop esi
00406517  5b                           pop ebx
00406518  c3                           ret
--- 0x406534 ---
00406534  83 f9 00                     cmp dword ecx, 0x0
00406537  0f 84 e0 00 00 00            jz 0x40661d
0040653d  50                           push eax
0040653e  53                           push ebx
0040653f  56                           push esi
00406540  57                           push edi
00406541  89 c3                        mov ebx, eax
00406543  89 d6                        mov esi, edx
00406545  89 cf                        mov edi, ecx
00406547  31 d2                        xor edx, edx
00406549  8a 06                        mov al, [esi]
0040654b  8a 56 01                     mov dl, [esi+0x1]
0040654e  3c 0a                        cmp al, 0xa
00406550  74 25                        jz short 0x406577
00406552  3c 0b                        cmp al, 0xb
00406554  74 3e                        jz short 0x406594
00406556  3c 0c                        cmp al, 0xc
00406558  74 51                        jz short 0x4065ab
0040655a  3c 0d                        cmp al, 0xd
0040655c  74 5c                        jz short 0x4065ba
0040655e  3c 0e                        cmp al, 0xe
00406560  74 76                        jz short 0x4065d8
00406562  3c 0f                        cmp al, 0xf
00406564  0f 84 84 00 00 00            jz 0x4065ee
0040656a  3c 11                        cmp al, 0x11
0040656c  0f 84 8b 00 00 00            jz 0x4065fd
00406572  e9 97 00 00 00               jmp 0x40660e
--- 0x40674c ---
0040674c  53                           push ebx
0040674d  56                           push esi
0040674e  57                           push edi
0040674f  55                           push ebp
00406750  89 c3                        mov ebx, eax
00406752  89 d6                        mov esi, edx
00406754  31 c0                        xor eax, eax
00406756  8a 41 01                     mov al, [ecx+0x1]
00406759  8d 7c 08 0a                  lea edi, [eax+ecx+0xa]
0040675d  8b 6f fc                     mov ebp, [edi-0x4]
00406760  31 c0                        xor eax, eax
00406762  8b 4f f8                     mov ecx, [edi-0x8]
00406765  51                           push ecx
00406766  8b 4f 04                     mov ecx, [edi+0x4]
00406769  29 c1                        sub ecx, eax
0040676b  7e 0b                        jle short 0x406778
0040676d  89 c2                        mov edx, eax
0040676f  01 f0                        add eax, esi
00406771  01 da                        add edx, ebx
00406773  e8 30 c9 ff ff               call 0x4030a8
00406778  8b 47 04                     mov eax, [edi+0x4]
0040677b  8b 17                        mov edx, [edi]
0040677d  8b 12                        mov edx, [edx]
0040677f  8a 0a                        mov cl, [edx]
00406781  80 f9 0a                     cmp byte cl, 0xa
00406784  74 31                        jz short 0x4067b7
00406786  80 f9 0b                     cmp byte cl, 0xb
00406789  74 3d                        jz short 0x4067c8
0040678b  80 f9 0c                     cmp byte cl, 0xc
0040678e  74 49                        jz short 0x4067d9
00406790  80 f9 0d                     cmp byte cl, 0xd
00406793  74 55                        jz short 0x4067ea
00406795  80 f9 0e                     cmp byte cl, 0xe
00406798  74 70                        jz short 0x40680a
0040679a  80 f9 0f                     cmp byte cl, 0xf
0040679d  0f 84 80 00 00 00            jz 0x406823
004067a3  80 f9 11                     cmp byte cl, 0x11
004067a6  0f 84 88 00 00 00            jz 0x406834
004067ac  b0 02                        mov al, 0x2
004067ae  5d                           pop ebp
004067af  5f                           pop edi
004067b0  5e                           pop esi
004067b1  5b                           pop ebx
004067b2  e9 31 c7 ff ff               jmp 0x402ee8
--- 0x406448 ---
00406448  85 c9                        test ecx, ecx
0040644a  0f 84 8a 00 00 00            jz 0x4064da
00406450  53                           push ebx
00406451  56                           push esi
00406452  57                           push edi
00406453  89 c3                        mov ebx, eax
00406455  89 d6                        mov esi, edx
00406457  89 cf                        mov edi, ecx
00406459  31 d2                        xor edx, edx
0040645b  8a 06                        mov al, [esi]
0040645d  8a 56 01                     mov dl, [esi+0x1]
00406460  31 c9                        xor ecx, ecx
00406462  3c 0a                        cmp al, 0xa
00406464  74 22                        jz short 0x406488
00406466  3c 0b                        cmp al, 0xb
00406468  74 1e                        jz short 0x406488
0040646a  3c 0c                        cmp al, 0xc
0040646c  74 24                        jz short 0x406492
0040646e  3c 0d                        cmp al, 0xd
00406470  74 33                        jz short 0x4064a5
00406472  3c 0e                        cmp al, 0xe
00406474  74 4d                        jz short 0x4064c3
00406476  3c 0f                        cmp al, 0xf
00406478  74 0e                        jz short 0x406488
0040647a  3c 11                        cmp al, 0x11
0040647c  74 0a                        jz short 0x406488
0040647e  b0 02                        mov al, 0x2
00406480  5f                           pop edi
00406481  5e                           pop esi
00406482  5b                           pop ebx
00406483  e9 60 ca ff ff               jmp 0x402ee8

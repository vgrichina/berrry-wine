--- 0x406577 ---
00406577  83 f9 01                     cmp dword ecx, 0x1
0040657a  89 d8                        mov eax, ebx
0040657c  7f 0a                        jg short 0x406588
0040657e  e8 b1 f3 ff ff               call 0x405934
00406583  e9 91 00 00 00               jmp 0x406619
--- 0x4067b7 ---
004067b7  8b 14 30                     mov edx, [eax+esi]
004067ba  01 d8                        add eax, ebx
004067bc  e8 c7 f1 ff ff               call 0x405988
004067c1  b8 04 00 00 00               mov eax, 0x4
004067c6  eb 7d                        jmp short 0x406845
004067c8  8b 14 30                     mov edx, [eax+esi]
004067cb  01 d8                        add eax, ebx
004067cd  e8 d2 f9 ff ff               call 0x4061a4
004067d2  b8 04 00 00 00               mov eax, 0x4
004067d7  eb 6c                        jmp short 0x406845
004067d9  8d 14 30                     lea edx, [eax+esi]
004067dc  01 d8                        add eax, ebx
004067de  e8 51 ff ff ff               call 0x406734
004067e3  b8 10 00 00 00               mov eax, 0x10
004067e8  eb 5b                        jmp short 0x406845
004067ea  31 c9                        xor ecx, ecx
004067ec  8a 4a 01                     mov cl, [edx+0x1]
004067ef  ff 74 11 02                  push [ecx+edx+0x2]
004067f3  ff 74 11 06                  push [ecx+edx+0x6]
004067f7  8b 4c 11 0a                  mov ecx, [ecx+edx+0xa]
--- 0x406806 ---
00406806  00 58 eb                     add [eax-0x15], bl
00406809  3b 31                        cmp esi, [ecx]
0040680b  c9                           leave
0040680c  8a 4a 01                     mov cl, [edx+0x1]
0040680f  8b 4c 11 02                  mov ecx, [ecx+edx+0x2]
00406813  51                           push ecx
00406814  89 d1                        mov ecx, edx
00406816  8d 14 30                     lea edx, [eax+esi]
00406819  01 d8                        add eax, ebx
0040681b  e8 2c ff ff ff               call 0x40674c
00406820  58                           pop eax
00406821  eb 22                        jmp short 0x406845
00406823  8b 14 30                     mov edx, [eax+esi]
00406826  01 d8                        add eax, ebx
00406828  e8 fb 0d 00 00               call 0x407628
0040682d  b8 04 00 00 00               mov eax, 0x4
00406832  eb 11                        jmp short 0x406845
00406834  89 d1                        mov ecx, edx
00406836  8b 14 30                     mov edx, [eax+esi]
00406839  01 d8                        add eax, ebx
--- 0x406840 ---
00406840  b8 04 00 00 00               mov eax, 0x4
00406845  03 47 04                     add eax, [edi+0x4]
00406848  83 c7 08                     add dword edi, 0x8
0040684b  4d                           dec ebp
0040684c  0f 85 14 ff ff ff            jnz 0x406766
00406852  59                           pop ecx
00406853  29 c1                        sub ecx, eax
00406855  7e 0a                        jle short 0x406861
00406857  8d 14 18                     lea edx, [eax+ebx]
0040685a  01 f0                        add eax, esi
0040685c  e8 47 c8 ff ff               call 0x4030a8
00406861  5d                           pop ebp
00406862  5f                           pop edi
00406863  5e                           pop esi
00406864  5b                           pop ebx
00406865  c3                           ret

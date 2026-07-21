# Comunidade do WhatsApp: número dos membros vem OCULTO (LID) em escala

**Data:** 2026-07-20 · **Cliente:** Tradição · **Contexto:** sorteador a partir da comunidade

## 🎯 A lição em uma linha
Membro de comunidade pode vir **sem telefone** (só `@lid`, ID anônimo que **não dá pra
enviar mensagem**). Não é garantido nem que venha, nem que falte — **quanto maior a
comunidade, menos números aparecem**. Qualquer feature que dependa disso precisa mostrar
o quanto ficou de fora.

## 📊 O dado medido (instância do Tradição, 20/07)
| Grupo | Membros | Com telefone |
|---|---|---|
| Roldão Atacadista (comunidade) | 1713 | **2** |
| Tenda Atacado (comunidade) | 462 | **2** |
| Tradição Matriz (comunidade **nossa**) | 51 | **2** |
| 🧡 Super Tradição #01 (comunidade **nossa**, nova) | 4 | **4** ✅ |
| Rio vale ofertas (grupo **comum**) | 966 | **966** ✅ |
| Ofertas Vizinhão (grupo **comum**) | 871 | **871** ✅ |
| ATACADAO SJC VALE SUL (grupo **comum**) | 324 | **324** ✅ |

## ⚠️ NÃO é "só admin vê" — hipótese descartada com dado
Primeira leitura foi que só admin tinha número visível. **Errado.** Na Super Tradição o
4º membro **não é admin** e o telefone veio normal:
```
admin=None  lid=168307118362630@lid  fone=5512997778281@s.whatsapp.net
```
(É o `+55 12 99777-8281`, que **entrou por link de convite** — então também não é
"foi adicionado manualmente pelo admin".)

Já na Tradição Matriz, os 49 não-admins vêm **todos** `phoneNumber: null`.

> ❓ **Gatilho real não identificado.** Suspeitas não confirmadas: contato salvo na agenda,
> interação prévia com a instância, ou cache de mapeamento LID→telefone do Baileys/Evolution.
> **Não assuma** que resolve sozinho — trate o telefone como opcional.

## 🪤 Armadilha de parsing
Alguns LIDs começam com "55" e parecem telefone (ex.: `55310605623350`, 14 dígitos).
Filtrar por prefixo `55` dá **falso positivo**. O teste certo é a **presença do campo
`phoneNumber`** — nunca o formato do `id`.

## 🔌 Como consultar
`GET /api/whatsapp/fetch-groups?participants=true` (param adicionado em `a11a797`;
default `false`, bem mais leve — `true` traz a lista inteira de cada grupo).

- `isCommunity: true` → **nó** da comunidade: só os admins (`size` 2–3), **não** os membros
- `isCommunityAnnounce: true` → grupo de **Avisos**: é aqui que moram os membros
- ambos `false` → grupo comum
- `participants[].admin` = `'admin' | 'superadmin' | null`
- `participants[].phoneNumber` = `55...@s.whatsapp.net` **ou ausente**

## 🧡 Comunidades do Roberto (`5512988426869`, superadmin das duas)
| Comunidade | Nó | Avisos | Membros |
|---|---|---|---|
| 🧡 Super Tradição 🧡 #01 | `120363426732746991@g.us` | `120363408347475645@g.us` | 4 |
| Tradição Matriz 🧡 | `120363371635305355@g.us` | `120363369347076325@g.us` | 51 |

Roldão e Tenda ele é **só membro** (monitora concorrente).

## ✅ Consequência de projeto
Sorteador lê os participantes do **grupo de Avisos** e sorteia entre os que têm
`phoneNumber`. **Obrigatório exibir `Membros / Sorteáveis / Sem número`** — sem isso o
sorteio parece cobrir todo mundo e pode estar cobrindo 2 de 1713.
Ver [[../modulos/marketing-whatsapp]].

## 🏷️ Tags
#whatsapp #evolution #comunidade #lid #privacidade #sorteador #tradicao

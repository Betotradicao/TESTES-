# Firewall do Roteador dos Clientes — Filtrar por IP

Pra **proteger as portas expostas** (Oracle/PG, DVR HTTP/RTSP) de scanners e botnets na internet, configurar firewall do roteador da loja pra aceitar **APENAS** conexão vinda do IP da VPS.

## 🎯 IP que precisa permitir

```
46.202.150.64   (VPS 46 — vps2-hostinger)
```

Qualquer outro IP → bloquear.

## 🏪 Nunes — MikroTik

**Acesso fisico necessario** (ou WinBox remoto se houver outra forma de admin alem da WAN).

### Portas a filtrar

| Porta externa | Servico |
|---|---|
| 10835 | PostgreSQL RP INFO |
| 38100 | DVR HTTP |
| 38101 | DVR RTSP |

### Via WinBox (visual)

1. **IP → Firewall → NAT**
2. Pra cada uma das 3 regras de port-forward existentes (dst-port=10835, 38100, 38101):
   - Duplo-clique pra editar
   - Aba **General**
   - Campo **Src. Address**: `46.202.150.64`
   - OK
3. Pronto. Soh a VPS passa pelo NAT, o resto bate na regra padrao de drop.

### Via Terminal MikroTik (mais rapido)

```mikrotik
/ip firewall nat
print where dst-port=10835 or dst-port=38100 or dst-port=38101
# anote os IDs

set [find dst-port=10835] src-address=46.202.150.64
set [find dst-port=38100] src-address=46.202.150.64
set [find dst-port=38101] src-address=46.202.150.64

print where dst-port=10835 or dst-port=38100 or dst-port=38101
# conferir que tem src-address=46.202.150.64 em cada uma
```

## 🏪 Tradicao — ⏸️ DECIDIDO NAO BLOQUEAR (2026-05-23)

### Portas que ficaram ABERTAS

| Porta externa | Servico |
|---|---|
| 11251 | Oracle Intersolid |
| 8123 | DVR HTTP |
| 5554 | DVR RTSP |

### Motivo da decisao

**Beto decidiu nao bloquear** porque o cliente nao sabe ao certo quem mais
acessa essas portas externamente — pode ter:
- Tecnico Intersolid acessando Oracle remoto pra suporte
- App de DVR no celular pra ver cameras de casa
- Integracoes de terceiros (marketing, NFe, backup)
- Software desktop do dono acessando Oracle de outro lugar

Risco de quebrar operacao > risco de ataque (por enquanto).

### Pra reconsiderar no futuro

Antes de bloquear, **listar TODOS os IPs que conectaram** nessas portas em
30 dias de log do roteador. Aí da pra fazer whitelist em vez de bloqueio
total: `46.202.150.64` + IPs conhecidos legitimos.

Mitigacoes alternativas em vigor:
- Senhas fortes no Oracle + DVR
- Monitoramento de tentativas de login no banco

Teste de exposicao pode ser re-rodado a qualquer momento (esta documentado
em [[../bugs-resolvidos/2026-05-23-portas-tradicao-expostas-decisao]]).

### Configuracao QUANDO for aplicar

Mesma logica do Nunes acima: cada regra de port-forward → restringir
Src.Address pra `46.202.150.64`. Mas hoje nao aplicar.

## ⚠️ Cuidados

- Se voce acessa o roteador remotamente pela **MESMA WAN** que vai filtrar, **voce sai junto**. Antes de aplicar, garanta:
  - Acesso fisico, OU
  - MikroTik mynetname.net pra WinBox, OU
  - VPN/Wireguard pre-configurado
- Em caso de duvida, **testa em horario sem expediente** pra poder reverter rapido sem afetar operacao

## ✅ Como testar apos aplicar

**Da VPS (Claude):**
```
nc -zv 187.90.96.96 11251   # Tradicao Oracle — deve continuar ABERTA
nc -zv hea08skfqwk.sn.mynetname.net 10835   # Nunes PG — deve continuar ABERTA
```

**De fora (servico externo tipo portchecker.io):**
- Mesmo IP+porta → deve dar **timeout/refused**

## 📚 Por que isso e importante

- Hoje, Oracle/PG/DVR estao **visiveis na internet inteira**
- Botnets escaneiam IPs publicos 24/7
- DVR Dahua/Intelbras e alvo classico de Mirai-like botnets
- Brute force em Oracle/PG com senhas comuns e questao de tempo

Com filtro por IP, **99% dos ataques automatizados** sao bloqueados antes mesmo do handshake TCP.

## 🏷️ Tags
#seguranca #firewall #mikrotik #infraestrutura #cliente

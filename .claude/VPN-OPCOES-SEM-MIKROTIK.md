# Alternativas de VPN sem comprar Mikrotik

> Este doc lista alternativas pra substituir o SSH tunnel atual (que cai e fica zumbi) por uma VPN mais robusta, **sem precisar comprar um Mikrotik**.

Cliente não quer hardware caro. Foco em **opções de baixo custo ou zero custo**, organizadas do mais barato pro mais isolado/estável.

---

## Resumo comparativo

| Opção | Custo | Estabilidade | Setup | Roda em |
|---|---|---|---|---|
| 1. **WireGuard no PC do super** | **R$0** | 🟢🟢 | 30 min | PC Windows existente |
| 2. **ZeroTier** | **R$0** | 🟢🟢 | 15 min | PC Windows existente + VPS |
| 3. **Roteador OpenWRT** | R$200-400 | 🟢🟢 | 2-3h | Roteador novo TP-Link/Xiaomi |
| 4. **Mini PC dedicado** | R$300-500 | 🟢🟢🟢 | 2h | Mini PC chinês 24/7 |
| 5. **Roteador c/ WireGuard nativo** | R$280-900 | 🟢🟢 | 1-2h | Asus/GL.iNet/TP-Link |

---

## Opção 1 — WireGuard no PC do super (CUSTO ZERO) ⭐ RECOMENDADA

### Como funciona

O PC do super já está ligado 24/7 pra rodar o SSH tunnel. **Em vez de SSH tunnel, instalar WireGuard nele.**

```
[PC Super c/ WireGuard]  ←── UDP 51820 ──→  [VPS WireGuard server]
        │                                          │
        ↓                                          ↓
  Rede 10.6.1.0/24                          Backend Docker enxerga
   - Oracle 10.6.1.100                      Oracle e DVR como locais
   - DVR    10.6.1.123
```

### Vantagens sobre SSH tunnel

- ✅ **Handshake automático a cada 25s** — não fica zumbi
- ✅ **Reconexão em <30s** automática se cair
- ✅ Sobrevive a quedas curtas de internet sem intervenção
- ✅ Roda em kernel mode → CPU baixíssima
- ✅ Encriptação ChaCha20 (mais leve e moderna que SSH)
- ✅ Suporta TCP + UDP + qualquer protocolo IP (SSH só TCP)

### Limitações

- ❌ Ainda depende do PC do dono ligado (mesma limitação do SSH tunnel)
- ❌ Se PC reiniciar, WireGuard sobe sozinho como serviço — mas se PC ficar offline, túnel cai junto

### Hardware

**Nenhum.** Usa o PC que já existe.

### Setup técnico (passo a passo)

**No lado VPS (servidor):**
```bash
# Instalar WireGuard
apt install wireguard

# Gerar chaves do servidor
wg genkey | tee /etc/wireguard/server.key | wg pubkey > /etc/wireguard/server.pub

# Criar /etc/wireguard/wg0.conf
[Interface]
PrivateKey = <server.key>
Address = 10.10.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT

[Peer]
# Tradição
PublicKey = <chave_publica_pc_super>
AllowedIPs = 10.10.0.2/32, 10.6.1.0/24

# Habilitar e iniciar
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0
```

**No lado PC do super (cliente):**
1. Baixar WireGuard for Windows: https://www.wireguard.com/install/
2. Instalar como serviço (auto-start no boot)
3. Importar config:
```ini
[Interface]
PrivateKey = <chave_privada_gerada_no_pc>
Address = 10.10.0.2/32

[Peer]
PublicKey = <chave_publica_da_vps>
Endpoint = 46.202.150.64:51820
AllowedIPs = 10.10.0.0/24
PersistentKeepalive = 25
```
4. Ativar tunnel — pronto.

**No backend Docker da VPS:**
- Atualizar config DVR/Oracle pra apontar pra IPs reais (`10.6.1.100`, `10.6.1.123`) ao invés de `172.20.0.1`
- Container precisa rotear pelo host: `network_mode: host` ou rota explícita

### Custo total: R$0
### Tempo de setup: 30 min

---

## Opção 2 — ZeroTier (CUSTO ZERO)

### Como funciona

Rede mesh peer-to-peer. Instala um agente em cada nó (PC do super e VPS), eles formam uma "rede virtual" entre si automaticamente, sem abrir portas, sem precisar IP fixo.

Diferente do Tailscale (que é proprietário), o **ZeroTier é 100% open-source** e você pode auto-hospedar o controlador depois se quiser independência total.

### Vantagens

- ✅ **Atravessa CGNAT automaticamente** — funciona mesmo onde IP fixo não funciona
- ✅ Free tier até 25 nós
- ✅ Gerenciamento via web (zerotier.com) bem simples
- ✅ Não precisa configurar firewall ou abrir portas

### Limitações

- ❌ Depende do servidor do ZeroTier (gratuito mas terceiro) — pode auto-hospedar depois
- ❌ Latência levemente maior em algumas conexões NAT (raramente perceptível)

### Setup

**Conta:** criar em `https://my.zerotier.com` → criar uma "Network" → guardar Network ID

**No PC do super:**
1. Baixar e instalar ZeroTier One: https://www.zerotier.com/download/
2. Comando: `zerotier-cli join <NETWORK_ID>`
3. Aprovar na interface web

**Na VPS:**
1. Instalar igual: `curl -s https://install.zerotier.com | bash`
2. `zerotier-cli join <NETWORK_ID>`
3. Aprovar na web

**Pronto.** Os dois ficam na mesma "rede virtual" 10.x.x.x. Backend da VPS já consegue pingar IPs internos do super.

### Custo: R$0
### Tempo de setup: 15 min

---

## Opção 3 — Roteador comum com OpenWRT (R$200-400)

### Como funciona

Compra-se um roteador comum compatível com **OpenWRT** (firmware Linux open-source) e instala. Daí roda WireGuard direto no roteador, isolado do PC do dono.

### Roteadores recomendados

| Modelo | Preço | Notas |
|---|---|---|
| **Xiaomi AX3000T** | R$280 | Wi-Fi 6, ótimo custo-benefício |
| **TP-Link Archer C7 v5** | R$200 | Mais antigo, comprovado |
| **GL.iNet AR300M** | R$300 | Já vem com OpenWRT de fábrica |

Lista completa de compatíveis: https://openwrt.org/toh/start

### Vantagens

- ✅ Isolado do PC do dono — VPN continua mesmo se PC desligar
- ✅ Hardware dedicado, baixíssimo consumo de energia
- ✅ Atualização e administração via web amigável

### Limitações

- ❌ Técnico precisa saber **flashar firmware** (instalar OpenWRT no roteador)
- ❌ Modelos errados podem virar peso de papel se algo der errado no flash

### Setup

1. Comprar roteador compatível
2. Baixar firmware OpenWRT correspondente em https://openwrt.org/toh/start
3. Flashar via interface web do roteador (ou TFTP no caso de modelos travados)
4. Instalar pacote WireGuard: `opkg install wireguard-tools luci-app-wireguard`
5. Configurar interface WireGuard pela LuCI (interface web)
6. Conectar na rede do super (entre modem e switch interno)

### Custo: R$200-400 + 2-3h técnico
### Tempo de setup: 2-3h

---

## Opção 4 — Mini PC dedicado (R$300-500)

### Como funciona

Compra-se um mini PC barato (chinês) e dedica ele só pra rodar Linux + WireGuard 24/7. Fica isolado do PC do dono e do roteador.

### Mini PCs sugeridos

| Modelo | Preço | Notas |
|---|---|---|
| **Beelink Mini S12** | R$500 | Intel N100, 8GB RAM, sobra |
| **Trigkey Green G4** | R$450 | Mesma especificação |
| **Mini PC Chuwi LarkBox** | R$350 | Compacto, mais barato |
| **Raspberry Pi 4** | R$400 | ARM, comunidade gigante |

### Vantagens

- ✅ Independente de tudo (PC do dono, roteador da operadora)
- ✅ Pode rodar outras coisas no futuro (servidor de backup local, monitor de câmeras, etc.)
- ✅ Fácil de configurar (Linux Ubuntu/Debian padrão)

### Limitações

- ❌ É um equipamento a mais que o cliente precisa cuidar
- ❌ Consumo elétrico baixo mas existente (~10W)

### Setup

1. Comprar mini PC
2. Instalar Ubuntu Server 24.04
3. `apt install wireguard`
4. Configurar igual à Opção 1, mas no mini PC ao invés do PC do dono
5. Configurar boot automático e watchdog

### Custo: R$300-500 + 2h técnico
### Tempo de setup: 2h

---

## Opção 5 — Roteador com WireGuard nativo (R$280-900)

### Como funciona

Alguns roteadores Wi-Fi modernos já vêm com WireGuard de fábrica no firmware oficial — sem precisar flashar OpenWRT.

### Modelos com WireGuard nativo

| Modelo | Preço | Tipo de WireGuard |
|---|---|---|
| **Asus RT-AX53U** | R$350 | Via Asuswrt-Merlin (firmware comunitário) |
| **GL.iNet Flint 2 (GL-MT6000)** | R$900 | Nativo, prosumer-grade ⭐ |
| **GL.iNet Slate AX (GL-AXT1800)** | R$800 | Nativo, viagem/portátil |
| **TP-Link Archer AX23** | R$280 | Via OpenWRT comunitário (não nativo) |

### Vantagens

- ✅ Plug & play em alguns modelos (GL.iNet em especial)
- ✅ Interface web amigável já pronta
- ✅ Não precisa habilidade Linux profunda

### Limitações

- ❌ Modelos da GL.iNet são caros
- ❌ Asus precisa firmware comunitário (Merlin) — flash exigido

### Custo: R$280-900
### Tempo de setup: 1-2h

---

## Recomendação de caminho progressivo

### Fase 1 — agora (R$0):
**Opção 1 ou 2** (WireGuard no PC ou ZeroTier)
- Resolve 90% dos problemas de "túnel zumbi"
- Zero custo
- Reversível: se não gostar, volta pro SSH tunnel

### Fase 2 — se Fase 1 não bastar (R$300-500):
**Opção 3 ou 4** (OpenWRT ou mini PC)
- Desacopla do PC do dono
- Mantém VPN ativa mesmo com PC desligado
- Não depende mais de um único equipamento

### Fase 3 — se quiser solução enterprise (R$800+):
**GL.iNet Flint 2** ou **Mikrotik hAP ax²**
- Hardware profissional
- Garantia, suporte, longevidade

---

## Por que NÃO usar SSH tunnel + Tunnel Manager v6 indefinidamente?

O Tunnel Manager v6 que implementamos **mitiga** mas não **resolve** o problema:
- Detecta túnel zumbi via health check API
- Reconecta automaticamente
- Mas ainda depende do `ssh.exe` que **não foi feito pra ser persistente** dessa forma
- Cada reconexão tem 30-60s de janela onde o sistema fica sem acesso ao Oracle/DVR
- Bipagens podem ficar como `[NÃO ENCONTRADO]` durante essas janelas (corrigidas depois pelo cron)

WireGuard, ao contrário, **foi desenhado especificamente** pra ser uma conexão persistente sem janelas de queda. Handshake constante, reconexão silenciosa, encriptação no kernel.

---

## Pro técnico avaliar

Perguntas pra começar:

1. **A internet do super tem CGNAT?** — testa em `meuip.com.br` vs `whatismyip.com`. Se for CGNAT, **só Opção 2 (ZeroTier) ou Opção 1 com cliente saindo** funcionam (qualquer VPN onde o super seja "servidor" não funciona).

2. **Quanto tempo você quer investir?** — Opção 2 (ZeroTier) é 15 min. Opção 1 é 30 min. Outras precisam mais trabalho.

3. **Vai escalar pra outras lojas?** — se sim, padronizar com ZeroTier (cada loja só precisa instalar agente, sem hardware). Mikrotik/OpenWRT só faz sentido pra 1-3 lojas.

4. **Tem PC ligado 24/7 hoje?** — se sim, Opção 1 é a sem dor. Se vai querer eliminar dependência de PC, Opção 3/4.

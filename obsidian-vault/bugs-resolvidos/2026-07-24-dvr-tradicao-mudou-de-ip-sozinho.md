---
tags:
  - bug-resolvido
  - dvr
  - rede
  - tradicao
data: 2026-07-24
cliente: Tradição
---

# 🌟 DVR do Tradição mudou de IP sozinho (DHCP) — como ACHAR o DVR na rede

## 🔴 Sintoma
Tela **Configurações → DVR / CFTV → Testar Conexão** → `✗ RPC2 timeout`.
Config aparentemente certa: `10.6.1.148`, portas 28100/28101, usuário admin.

## 🕵️ Diagnóstico — o funil que isolou em 4 comandos

Rodado **da VPS**, cada linha elimina uma camada:

| Teste | Resultado | O que eliminou |
|---|---|---|
| `ss -ltnp \| grep 28100` | ✅ LISTEN (sshd pid X) | túnel SSH está de pé |
| `ss -tn state established '( sport = :22 )'` | ✅ 3 sessões de `187.90.96.96` | a loja está conectada |
| **Oracle `1521`** (mesma máquina da loja) | ✅ TCP OK | **rede da loja e túnel OK** |
| `curl http://127.0.0.1:28100/` | ❌ `HTTP=000`, 10s | o **destino** do forward não responde |
| `curl http://127.0.0.1:18080/` (→ `.123`, DVR velho) | ❌ `HTTP=000` | os **dois** DVRs mudos |

> 🔑 **Oracle vivo + DVR mudo pela MESMA máquina = o problema é o aparelho, não a rede
> nem o túnel nem o código.** Esse contraste é o que economiza horas.

> 💡 **O forward morto `-R 18080:10.6.1.123:80` virou sonda grátis** do DVR velho.
> A pendência conhecida serviu de instrumento de diagnóstico.

## 🎯 Causa-raiz
O **iMHDX 5116** pegou **outro IP no DHCP**: saiu do `10.6.1.148` e foi pro **`10.6.1.110`**.
O aparelho estava **100% saudável** o tempo todo — só inalcançável no endereço configurado.
(Em 21/07 ele já tinha migrado `.123` → `.148`. É a **segunda troca em 3 dias.**)

## 🔎 COMO ACHAR O DVR QUANDO ELE SOME (receita)

Rodar **na máquina Windows da loja** (`10.6.1.171`) — ela está na mesma LAN:

```powershell
# 1. Scan assíncrono das portas 80+554 (assinatura de DVR/câmera).
#    NÃO usar 254 Start-Job — trava. Sockets assíncronos levam ~5s:
foreach ($porta in @(80,554)) {
  $t = @{}
  1..254 | ForEach-Object { $ip="10.6.1.$_"; $c=New-Object System.Net.Sockets.TcpClient
                            $t[$ip]=@{cli=$c; task=$c.ConnectAsync($ip,$porta)} }
  Start-Sleep -Milliseconds 2500
  foreach ($ip in $t.Keys) { if ($t[$ip].cli.Connected) { "$ip : $porta ABERTA" }; $t[$ip].cli.Close() }
}

# 2. Perguntar o MODELO de cada candidato (digest auth) — separa DVR de câmera:
curl.exe -s --digest -u 'admin:SENHA' "http://10.6.1.110/cgi-bin/magicBox.cgi?action=getDeviceType"
# -> type=iMHDX 5116   <- é o DVR do Vision
```

> ⚠️ **`ping` e ARP não bastam.** Nem `.148` nem `.123` apareciam no `Get-NetNeighbor` e
> nem pingavam — a varredura por **porta** foi o que achou o aparelho.

> 📌 A loja do Tradição tem **5 equipamentos Dahua/Intelbras** respondendo RPC2
> (`.110`, `.126`, `.221`, `.222`, `.223`). Todos devolvem `login challenge` — **isso NÃO
> identifica o DVR.** Só o `magicBox.cgi?action=getDeviceType` distingue:
> `.110` = **iMHDX 5116** (o nosso) · os outros 4 = MHDX 1116.

## ✅ Correção aplicada (24/07)

```powershell
# 1. tunnels.json (FONTE DE VERDADE — editar o .ps1 não adianta)
$j='C:\ProgramData\SSHTunnels\tunnels.json'; Copy-Item $j "$j.bak-20260724" -Force
(Get-Content $j -Raw) -replace '28100:10\.6\.1\.148:80','28100:10.6.1.110:80' `
                      -replace '28101:10\.6\.1\.148:554','28101:10.6.1.110:554' | Set-Content $j -Encoding UTF8
# 2. matar SÓ o ssh.exe do DVR (o do Oracle tem 1521 na linha de comando — NÃO tocar)
Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" |
  Where-Object { $_.CommandLine -like '*Loja1DVR*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
# manager ressuscita em ~10-60s com o IP novo
```
```sql
UPDATE dvr_devices SET ip='10.6.1.110', updated_at=now() WHERE id=3;  -- banco postgres_tradicao
```

**Validação (antes → depois):**

| Teste | Antes | Depois |
|---|---|---|
| `curl http://127.0.0.1:28100/` (VPS) | `HTTP=000` / 10s | **`HTTP=200` / 0,068s** |
| `RPC2_Login` | vazio | **`login challenge`** ✅ |
| Container → `172.20.0.1:28100` | — | **`HTTP=200` / 0,021s** |
| `ffprobe` RTSP canal 1 ao vivo | — | **`hevc 2880x1616`** ✅ |

## 🛡️ Prevenção — ⏳ NÃO FEITA (decisão do Roberto em 24/07: "vamos deixar como está")

**Duas trocas de IP em 3 dias.** A raiz está no próprio DVR:
```
table.Network.eth0.DhcpEnable=true    ← enquanto for true, o IP volta a dançar
```
(demais valores atuais: IP `10.6.1.110` · máscara `255.255.255.0` · gateway `10.6.1.254` ·
DNS `10.6.1.254` + `8.8.4.4` · MAC `98:e5:5b:45:04:7a`)

Quando doer de novo, há 2 saídas:
- **A) Reserva no MikroTik** (`IP → DHCP Server → Leases → Make Static` no MAC) — risco zero.
- **B) IP fixo no DVR** via `configManager.cgi` (`Network.eth0.DhcpEnable=false`) — dá pra
  fazer remotamente, **mas** o DVR reaplica a rede ao salvar: se errar, fica mudo e exige
  alguém **fisicamente na loja**. E se o `.110` estiver dentro da faixa do DHCP, pode dar
  conflito de IP no futuro.

> 🔒 **O MikroTik NÃO é alcançável da máquina da loja (`10.6.1.171`).** Medido em 24/07:
> gateway `10.6.1.254` com **8291 (Winbox), 22, 80, 443, 8728/8729 (API) e 23 todas fechadas**;
> varredura da /24 inteira não achou nenhum RouterOS; **MNDP (UDP 5678) não respondeu**.
> A gerência está bloqueada por firewall — **não é senha errada, não há porta pra bater.**
> Qualquer mexida no roteador tem que ser via Winbox do Roberto. **Não re-testar isso.**

## 🗄️ Onde mora a config (útil pra achar rápido)
- Banco do Tradição: **`postgres_tradicao`** (não `prevencao`), tabela `dvr_devices`.
- Colunas: `name` (não `nome`), `status` (não `ativo`).

## 🔗 Relacionados
- [[../modulos/dvr-cameras|DVR e Câmeras]]
- [[2026-07-15-tunel-dvr-chave-nao-autorizada-matava-oracle|Túnel DVR com chave inválida matava o Oracle]]
- [[2026-07-15-dvr-tradicao-reinicia-ao-ler-gravacao|DVR reiniciava ao dar Play — era a tomada]]

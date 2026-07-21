# 🌟 Túnel DVR com chave não autorizada derrubava o Oracle a cada 60s

**Data:** 2026-07-15 · **Cliente:** [[../clientes/tradicao|Tradição]] · **Módulos:** [[../modulos/dvr-cameras|DVR]], [[../arquitetura/oracle-intersolid|Oracle]]

## 🔥 A lição principal

**Um túnel morto no `tunnels.json` derruba TODOS os outros túneis da máquina, de minuto em minuto, para sempre.**

O `tunnel-manager.ps1` faz:

```powershell
foreach ($t in $tunnels) { if (-not (IsTunnelAlive $t)) { $caidos += $t.name } }
if ($caidos.Count -gt 0) { ReiniciarTodos $tunnels }   # mata TODOS, sobe TODOS
```

Se **um** túnel não sobe, ele **mata todos** a cada ciclo de 60s. Um túnel que nunca vai
subir (chave inválida) = **loop infinito de reinício em todos os outros**.

## 🕵️ Sintoma que chegou

"DVR não conecta, deu timeout no teste" — problema aparentemente só do DVR.

## 🔬 O que realmente estava acontecendo

1. **Maio/2026:** a chave SSH do túnel `Loja1DVR` deixou de ser aceita na VPS
   (`Permission denied (publickey)`). Túnel morre no nascimento.
2. **Contorno:** alguém pendurou o **DVR HTTP na 18080 dentro do túnel do banco**
   (`SSHTunnels\tunnels.json` → entrada `Tradicao`), que tem chave válida.
   Câmeras ao vivo voltaram; **RTSP ficou de fora** → vídeo das bipagens nunca mais carregou.
3. **Efeito colateral invisível:** o manager passou a matar o túnel do **Oracle (1521)**
   a cada 60s, há 2 meses, tentando ressuscitar o `Loja1DVR`. **256 reinícios** só no log atual.

> 🚨 **Forte suspeita:** causa-raiz do [[2026-07-10-oracle-pool-njs064-stuck|NJS-064 (pool Oracle preso em "closing")]].
> O pool tinha as conexões TCP cortadas embaixo dele de minuto em minuto. O fix no
> `oracle.service.ts` tratou o sintoma; a doença estava no túnel. **Verificar se o NJS-064
> some agora.**

## 🧭 Como diagnosticar (roteiro que funcionou)

Ordem importa — cada passo elimina uma hipótese:

| # | Teste | O que prova |
|---|---|---|
| 1 | `ss -ltn \| grep <porta>` na VPS | se a porta do túnel escuta |
| 2 | `ss -tn state established \| grep :22` na VPS | **de qual IP o túnel vem** (mata hipótese de "IP mudou") |
| 3 | `nc -zv <ip_publico> <porta_oracle>` da VPS | se o roteador ainda encaminha (Oracle = grupo de controle) |
| 4 | TCP direto no IP do DVR **pela LAN** | se o DVR está vivo e onde |
| 5 | `Get-CimInstance Win32_Process -Filter "Name='ssh.exe'"` | **quais forwards existem de verdade** (≠ do que está configurado) |
| 6 | `ssh -i <chave> -o BatchMode=yes root@vps echo ok` | **se a chave autentica** ← foi aqui que caiu |
| 7 | `tunnel-manager.log` | se está em loop de reinício |

**Passo 5 foi o que virou o jogo:** o `tunnel-service.ps1` do DVR dizia 28100/28101, mas o
processo vivo era outro, do túnel do banco, com 18080. **Config ≠ realidade.**

## ✅ Correção

Gerar o instalador em **Configurações de Tabelas → Túnel DVR**:
- Nome: **`Loja1DVR`** (⚠️ TEM que bater com a entrada existente no `tunnels.json`,
  senão cria entrada nova e a morta continua causando o loop)
- IP do DVR na rede local: `10.6.1.123`
- DVR HTTP `80` → `28100` · DVR RTSP `554` → `28101`

O instalador **gera o par de chaves e autoriza a pública sozinho**, com restrição:

```
restrict,port-forwarding,permitopen="localhost:28100",permitopen="localhost:28101" ssh-rsa ...
```

> 💡 **Nunca colar a chave crua no `authorized_keys`** — o instalador a restringe a
> port-forwarding nas portas específicas, **sem shell**. Colar na mão dá root completo.

## 📌 Config do DVR depois do túnel

| Campo | Valor |
|---|---|
| IP do DVR | `host.docker.internal` (**NÃO** o IP público) |
| Porta HTTP | `28100` |
| Porta RTSP | `28101` |

## 🧱 A SEGUNDA causa — firewall (⏸️ NÃO resolvida, Roberto adiou 15/07)

Mesmo com o túnel de pé, o vídeo **continua fora**. Teste de dentro do container:

```
172.20.0.1:1521  (Oracle) -> CONECTOU     ✅
172.20.0.1:28100 (DVR)    -> TIMEOUT      ❌
172.20.0.1:5432           -> TIMEOUT      ❌
8.8.8.8:53 (internet)     -> CONECTOU     ✅
```

O gateway é alcançável, mas **só nas portas liberadas**. `iptables -L INPUT`:

```
Chain INPUT (policy DROP)
1  ACCEPT  172.20.0.0/16 -> tcp dpt:8080
2  ACCEPT  172.20.0.0/16 -> tcp dpt:1521
```

**Não existe regra pras portas do DVR.** Origem: o hardening do [[../../.claude/REGRAS-SEGURANCA-CRIADAS|incidente do cryptominer XMRig (26/05/2026)]] fechou tudo com `policy DROP` e liberou só Oracle e 8080 — **esqueceu do DVR**. O DVR parou naquele dia.

> ⚠️ **NÃO aplicar `-s 172.20.0.0/16` sem investigar.** Roberto: *"da última vez que fizemos
> esse lance de subnet acabou que pegou a mesma rede de outros clientes"*. /16 = 65k endereços.
> Cada cliente tem rede própria (`tradicao_network`, `nunes_network`...), mas **falta confirmar
> se todas caem dentro do 172.20.x**. Se caírem, a regra atual do Oracle **já** deixa container
> de qualquer cliente alcançar o túnel do Tradição.
>
> **Regra correta provavelmente é por IP de container** (`-s 172.20.0.2/32`), não por faixa.
> Investigar as subnets de cada rede antes.

### ⚠️ Erro de diagnóstico que me custou tempo (não repetir)

Testei `172.20.0.1:28100` **da VPS** e deu OK → concluí que funcionava. Errado: **da VPS é
local, ela alcança a si mesma**. Quem precisa alcançar é o **container**, e o tráfego dele
atravessa a bridge e bate no `INPUT policy DROP`.

**Sempre testar de DENTRO do container:**

```bash
# script.js com net.connect / http.get -> pipe pro node do container
Get-Content teste.js | ssh vps2-hostinger 'docker exec -i prevencao-<cliente>-backend node'
```

O container é slim (sem `curl`, `wget`, `ps`) — usar o `node` que já está lá.

## ✅ DVR confirmado saudável (teste da LAN)

```
OPTIONS rtsp://10.6.1.123:554/  ->  RTSP/1.0 401 Unauthorized
                                    WWW-Authenticate: Digest realm="Login to 00d27f36..."
```

401 + digest challenge = servidor RTSP vivo pedindo senha. **O DVR nunca foi o problema.**

## 🚩 Pendências deixadas

1. **Duplicação:** o instalador cria a tarefa `SSH-Tunnel-Loja1DVR` **e** o manager também
   sobe o mesmo túnel pelo `tunnels.json`. Dois donos, mesmas portas. Verificar se estabiliza
   ou se precisa remover um dos dois.
2. **Roteador:** as regras NAT `8123`/`5554` do DVR sumiram (a do Oracle `11251` sobreviveu).
   Não precisa recriar — o túnel torna o port-forward desnecessário. Ver
   [[../padroes/firewall-roteador-clientes]].
3. **Bug latente no manager:** "um caiu → mata todos" é uma bomba pra qualquer cliente com
   túnel morto no inventário. Considerar reiniciar só o que caiu.

## 🏷️ Tags
#bug #dvr #tunel #ssh #oracle #tradicao #causa-raiz

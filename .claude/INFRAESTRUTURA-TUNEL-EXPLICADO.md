# Infraestrutura de Túnel — Como Funciona e Alternativas

> Documento técnico para discutir com técnico de TI alternativas pro sistema atual.

---

## 1. O Problema que Precisamos Resolver

O sistema **Prevenção no Radar** é um SaaS que roda em **servidor na nuvem (VPS Hostinger)**. Esse servidor precisa **enxergar** dois equipamentos que ficam **dentro do supermercado**:

| Equipamento | IP local | Pra quê |
|---|---|---|
| **Servidor Oracle** (ERP Intersolid) | 10.6.1.100:1521 | Ler vendas, produtos, estoque, fornecedores |
| **DVR de câmeras** (Intelbras MIB) | 10.6.1.123:80 (HTTP) e :554 (RTSP) | Gerar clipes de vídeo de cancelamentos pra Vision Palavra-Chave / Operações de Risco |

O problema:
- A VPS tem IP público fixo na internet.
- A internet do supermercado **NÃO tem IP fixo público** (é IP dinâmico via NAT do provedor — Vivo/Claro/etc).
- Os equipamentos internos (Oracle 10.6.1.100, DVR 10.6.1.123) estão em uma **rede privada** acessível só por dentro da loja.

Resultado: a VPS na nuvem **não consegue** acessar diretamente o Oracle e o DVR.

---

## 2. Solução Atual: SSH Reverse Tunnel

### O que é

Uma máquina Windows dentro do supermercado (a PC do dono) abre uma conexão SSH **saindo** pra VPS, com a flag `-R` (Reverse Tunnel). Essa flag diz:

> "VPS, abra essas portas suas. Tudo que chegar nelas, mande pra mim por dentro deste túnel, e eu encaminho pros equipamentos da rede local."

### Diagrama do fluxo

```
  ┌─────────────────────────────────────┐                   ┌────────────────────┐
  │  VPS HOSTINGER (46.202.150.64)      │                   │  REDE DO SUPER     │
  │                                     │                   │                    │
  │  ┌───────────────────────────────┐  │                   │  ┌──────────────┐  │
  │  │ Backend Docker                │  │                   │  │ PC Windows   │  │
  │  │ (container)                   │  │  ◄──── ssh -R ────│  │ (dono)       │  │
  │  │                               │  │       (1 conexão  │  │              │  │
  │  │ Quando precisa Oracle:        │  │        de saída,  │  │ Roda:        │  │
  │  │   conecta 172.20.0.1:1521 ────┼──┼──┐    SEMPRE      │  │ tunnel-mgr   │  │
  │  │                               │  │  │    aberta)     │  │              │  │
  │  │ Quando precisa DVR HTTP:      │  │  │                │  └─────┬────────┘  │
  │  │   conecta 172.20.0.1:18080 ───┼──┼──┤                │        │           │
  │  │                               │  │  │                │        │ rede     │
  │  │ Quando precisa DVR RTSP:      │  │  │                │        │ local    │
  │  │   conecta 172.20.0.1:28101 ───┼──┼──┤                │   ┌────▼────┐      │
  │  └───────────────────────────────┘  │  │                │   │ Oracle  │      │
  │                                     │  │                │   │ 10.6.1  │      │
  │  ssh.exe escutando portas:          │  │                │   │   .100  │      │
  │   - 1521  (Oracle)             ◄────┘  │                │   └─────────┘      │
  │   - 18080 (DVR HTTP)                   │                │   ┌──────────┐     │
  │   - 28101 (DVR RTSP)                   │                │   │ DVR      │     │
  │                                        │                │   │ 10.6.1   │     │
  └────────────────────────────────────────┘                │   │   .123   │     │
                                                            │   └──────────┘     │
                                                            └────────────────────┘
```

### Por que escolhemos isso

- **Não precisa de IP fixo no super** — a conexão é iniciada de dentro pra fora (igual o WhatsApp ou navegador faz).
- **Atravessa o NAT** do provedor sem problema.
- **Não precisa abrir nenhuma porta no roteador** do super.
- **Custo zero** — só precisa do PC do dono ligado e SSH instalado.

### Por que cai

1. **Internet do super oscila** — a conexão SSH morre quando perde pacote
2. **PC dorme/desliga** — sem PC = sem túnel
3. **Túnel zumbi** — às vezes o `ssh.exe` continua "vivo" mas o forward para de funcionar (sem motivo aparente)
4. **NAT do roteador** derruba conexões "ociosas" depois de minutos sem tráfego
5. **Provedor de internet** (Vivo, Claro) faz reset noturno do IP

### O que já fizemos pra mitigar

- **Tunnel Manager v6** — script PowerShell que roda 24/7 na máquina, verifica a cada 1 min se o túnel está vivo (via health check da nossa API) e reconecta automático se cair
- **Auto-reidentificar** — cron a cada 5 min na VPS que recupera bipagens marcadas como "[NÃO ENCONTRADO]" quando o túnel volta
- **Configuração de energia** — PC do dono não dorme mais, hibernate desligado

Mesmo assim, **não é ideal** — depende totalmente do PC estar ligado e funcionando 24/7.

---

## 3. Alternativas com Hardware / IP Fixo

### Opção A — IP fixo + Port Forwarding no roteador

**Como funciona:** contrata-se um IP fixo da operadora (Vivo Empresarial, Claro Empresas, Algar). O roteador do super é configurado pra encaminhar portas específicas:

- Porta `1521` externa → `10.6.1.100:1521` (Oracle)
- Porta `554` externa → `10.6.1.123:554` (DVR)
- Porta `80` externa → `10.6.1.123:80` (DVR HTTP)

A VPS conecta **direto** no IP fixo do super (sem PC intermediário, sem túnel).

| ✅ Vantagens | ❌ Desvantagens |
|---|---|
| Sem PC intermediário pra cair | Custo mensal: R$80–250 |
| Sem túnel pra zumbificar | Expõe portas pra internet → precisa firewall com whitelist da VPS |
| Conexão direta = mais rápida | Algumas operadoras só dão CGNAT (não funciona) |
| Mais profissional | Depende da operadora ter IPv4 público disponível |

**Custo estimado:** R$100/mês na operadora + 2-4h de configuração do técnico.

### Opção B — VPN Site-to-Site (mais profissional)

**Como funciona:** instala-se um roteador profissional no super (Mikrotik, pfSense, Fortinet) e configura uma **VPN permanente** entre o roteador e a VPS. Toda a rede do super fica acessível na VPS como se fosse uma rede local estendida.

Tecnologias mais usadas:
- **WireGuard** — moderno, leve, criptografado, super estável
- **OpenVPN** — clássico, bem testado
- **IPsec** — padrão antigo mas robusto

| ✅ Vantagens | ❌ Desvantagens |
|---|---|
| Conexão criptografada | Custa hardware: roteador profissional R$400–2.000 |
| **Muito** estável (raramente cai) | Precisa técnico que entenda VPN |
| Não expõe portas pra internet | Configuração inicial demorada |
| Acesso a TODA a rede local | — |
| Mesma solução é usada por bancos, hospitais, etc. | — |

**Custo estimado:** R$500–1.500 (uma vez, hardware) + 4-8h de configuração.

### Opção C — Tailscale ou ZeroTier

**Como funciona:** parecido com VPN, mas mais simples de configurar. Instala-se um agente leve em cada ponto (VPS e PC do super). Os agentes formam uma **rede virtual peer-to-peer**, sem precisar de IP fixo, sem precisar configurar roteador.

| ✅ Vantagens | ❌ Desvantagens |
|---|---|
| Configuração em 10 minutos | Depende do servidor da empresa (Tailscale/ZeroTier) |
| Free tier suficiente pra 1 super | Latência um pouco maior em alguns casos |
| Atravessa NAT automaticamente | Plano pago se quiser muitos dispositivos: ~US$5/mês |
| Pode adicionar mais clientes facilmente | — |

**Custo estimado:** R$0 (free tier) + 30 min de configuração.

### Opção D — Internet 4G/5G com IP fixo dedicado

**Como funciona:** modem 4G/5G empresarial (Vivo Empresarial, Tim Pro) com IP fixo dedicado, usado **só** pra esses serviços. A internet "normal" do super fica separada.

| ✅ Vantagens | ❌ Desvantagens |
|---|---|
| Independente da internet principal (redundância) | Custo extra: R$120–300/mês |
| Latência razoável | Mais um equipamento pra manter |
| Pode usar como backup geral | — |

---

## 4. Recomendação de Quem Entende

Em ordem de **confiabilidade × simplicidade × custo**:

### 🥇 Para hoje (curto prazo): manter SSH tunnel + monitoramento
- Já está implementado com Tunnel Manager v6
- Custo zero
- Funciona 95% do tempo
- Os 5% de falha já são auto-recuperáveis pelo cron de re-identificação

### 🥈 Para curto-médio prazo: **Tailscale**
- Instala em 10 minutos no PC do super e na VPS
- Substitui o SSH tunnel direto
- Free tier suficiente
- Não precisa mudar roteador, não precisa IP fixo
- Estabilidade muito superior ao SSH tunnel

### 🥉 Para longo prazo / múltiplos clientes: **VPN com Mikrotik**
- Investe num roteador profissional na entrada do super
- WireGuard configurado no Mikrotik
- Solução enterprise, escalável pra todas as lojas (Tradição, Nunes, MaxValle, etc.)
- O técnico de TI deve estar familiarizado com Mikrotik (é padrão no Brasil)

---

## 5. Perguntas pro técnico avaliar

1. A internet do super tem **IP público IPv4** ou está atrás de **CGNAT** do provedor?
   - Pra descobrir: acessar `https://meuip.com.br` no PC do super e comparar com o IP que aparece em sites como `https://www.whatismyip.com` — se forem diferentes, é CGNAT (não funciona com Opção A).

2. Qual roteador está instalado hoje na entrada do super? Tem suporte a VPN/WireGuard?
   - Se for um Mikrotik, TP-Link Omada, Sonicwall, Fortinet → sim.
   - Se for o roteador "padrão da operadora" (genérico Vivo/Claro) → provavelmente não tem.

3. Quanto custa um IP fixo na operadora atual?
   - Geralmente R$80–250/mês adicional.

4. Qual a tolerância pra investimento inicial em hardware?
   - Mikrotik hAP ax² (~R$800) já resolve uma loja inteira.

5. **O Sistema só roda nesse super ou em outros tbm?**
   - Tradição, Nunes, MaxValle, SuperVital, Idealmix → mesma situação em todos.
   - Se for replicar a solução, melhor escolher uma que escale bem.

---

## 6. Resumo Executivo (1 frase pro técnico)

> "O sistema na nuvem precisa acessar o Oracle (10.6.1.100:1521) e o DVR (10.6.1.123:80 e :554) que estão na rede interna do supermercado. Hoje fazemos isso via SSH reverse tunnel rodando 24/7 num PC, mas cai com frequência. Buscamos uma solução de hardware mais robusta — VPN site-to-site, IP fixo + port forwarding, ou Tailscale são as opções a avaliar."

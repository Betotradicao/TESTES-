# 🚨 INCIDENTE DE SEGURANÇA — 26/05/2026

## Resumo executivo

**O que aconteceu:** Em 25/05/2026 às 20:38, um cryptominer **XMRig (Monero)** foi instalado na VPS 46 (46.202.150.64) explorando o **noVNC exposto na porta 6080**. O malware se disfarçou de `systemd` e ficou minerando até 26/05 ~09h, quando a Hostinger detectou a CPU em 100% sustentada e pausou a VPS automaticamente.

**Detectado em:** 26/05/2026 ~10h (Hostinger pausou VPS + alerta "malware detectado").

**Status:** ✅ Neutralizado em 26/05 ~10h-11h. VPS funcional, hardening aplicado.

---

## 🎯 Fator gerador (root cause)

**noVNC exposto na porta 6080 SEM TLS** (`No SSL/TLS support — no cert file`).

Reconstrução do ataque:
1. Bot escaneou internet procurando noVNC abertos
2. Encontrou `46.202.150.64:6080` respondendo
3. Brute force VNC password (ou interceptou em claro)
4. Ganhou acesso ao desktop XFCE como **root**
5. Instalou `msr-tools` (otimiza miner XMRig)
6. Baixou binário XMRig disfarçado de `/usr/local/bin/systemd`
7. Criou 2 services systemd persistentes:
   - `systemd.service` → roda o miner (Restart=always)
   - `observed.service` → mata processos com >200% CPU **exceto** systemd (preserva CPU pro miner)
8. Adicionou chave SSH backdoor `Administrator@SRV_TRADICAO` (sem restrição)
9. Iniciou mineração pra pool `xmr.kryptex.network:8029`, carteira `47S6DU9Qm...`

**Smoking gun:** pacote `msr-tools` instalado em 25/05 ~20:38 (não existia antes, junto com criação do binário).

---

## ✅ Ações de remediação aplicadas (26/05/2026)

### 1. Neutralização do malware
- ✅ Processo XMRig (PID 1050) morto via `pkill -9 -f xmr.kryptex`
- ✅ Stop + disable: `systemd.service` e `observed.service`
- ✅ Removidos arquivos: `/usr/local/bin/systemd`, `/usr/local/bin/free_proc.sh`, `/etc/systemd/system/{systemd,observed}.service`
- ✅ Removida chave SSH backdoor `Administrator@SRV_TRADICAO` (backup em `/root/.ssh/authorized_keys.bak-20260526-095310`)
- ✅ Pacote `msr-tools` removido via `apt remove --purge`

### 2. Hardening SSH
- ✅ **Senha root** trocada por aleatória 32 chars: `nHqaiadD%+UdiH#m1elLjXW!AolzScd7` *(salvar em gerenciador de senhas)*
- ✅ `PasswordAuthentication no` em `/etc/ssh/sshd_config`
- ✅ `PermitRootLogin prohibit-password`
- ✅ Backup do sshd_config em `/etc/ssh/sshd_config.bak-20260526-*`
- ✅ Chaves SSH autorizadas atuais (`/root/.ssh/authorized_keys`):
  - `claude-vps-prevencao` (Claude — automação)
  - `claude-automation-vps2` (Claude — automação)
  - `*@tunnel` (tuneis dos clientes com `restrict,port-forwarding,permitopen=`)

### 3. fail2ban
- ✅ Instalado e ativo (`/etc/fail2ban/jail.local`)
- ✅ Config: 3 tentativas falhas em 10 min = ban 24h
- ✅ Protege porta 22 e 2222

### 4. Bloqueio de bancos pra internet (iptables)
- ✅ Script: `/usr/local/sbin/harden-firewall.sh`
- ✅ Bloqueia acesso EXTERNO a 11 portas Postgres + 22 portas MinIO dos clientes
- ✅ Permite: localhost (tuneis SSH), 172.16/12 (rede Docker), 10/8 (LAN), 100.64/10 (Tailscale)
- ✅ Cron horário em `/etc/cron.d/harden-firewall` (auto-protege clientes novos)
- ✅ Persistido via `iptables-persistent` (sobrevive a reboot)

### 5. noVNC / XFCE removidos
- ✅ Porta 6080 fechada (sem mais `0.0.0.0:6080`)
- ✅ noVNC e vncserver parados/desabilitados
- ✅ XFCE4 + lightdm + tigervnc + websockify removidos via `apt remove --purge`
- ✅ `/opt/noVNC` e `/root/.vnc` deletados

### 6. Limpeza Docker
- ✅ `docker builder prune -af` (liberou 19.75GB de cache)
- ✅ `docker image prune -af` (liberou ~18GB de imagens órfãs)
- ✅ Total liberado: ~17GB (disco antes 69%, depois 51%)

---

## 📋 Pendências de hardening (a fazer)

- ⏳ Trocar **senhas Postgres** dos clientes (caso vazou)
- ⏳ Trocar **MinIO root password** dos clientes
- ⏳ Trocar **JWT_SECRET** dos backends (invalidaria tokens, força re-login)
- ⏳ `unattended-upgrades` (patches automáticos Ubuntu)
- ⏳ **Instalar Wazuh** (EDR open-source) no VPS 31 + agente em todas VPS
- ⏳ `rkhunter` + `chkrootkit` semanal (cron)
- ⏳ Snapshots automáticos Hostinger

---

## 🔧 Arquivos importantes criados

| Arquivo | Função |
|---|---|
| `/usr/local/sbin/harden-firewall.sh` | Bloqueia bancos pra internet via iptables (detecção dinâmica) |
| `/etc/cron.d/harden-firewall` | Roda script hardening a cada hora (auto-protege clientes novos) |
| `/etc/fail2ban/jail.local` | Config fail2ban |
| `/etc/ssh/sshd_config.bak-20260526-*` | Backup sshd_config pré-hardening |
| `/root/.ssh/authorized_keys.bak-20260526-*` | Backup authorized_keys (com chave backdoor) |

---

## 🛡️ Camadas de defesa ativas agora

```
INTERNET
   ↓
[Firewall Hostinger]
   ↓
[iptables: DROP em portas Postgres/MinIO externas]
   ↓
[fail2ban: ban brute force SSH]
   ↓
[SSH: só chave, sem senha, sem root direto]
   ↓
[Containers Docker isolados em networks próprias]
```

---

## 📊 Outras descobertas relevantes

### VPS 31 (`31.97.82.235`)
- ✅ **Não foi afetada** — CPU 8%, disco 25GB, sem aviso de malware
- ✅ noVNC NÃO está exposto lá (verificar se também precisa de hardening preventivo)

### Sobre os clientes durante o incidente
- Cryptominer XMRig é "burro" — só rouba CPU, NÃO exfiltra dados
- Sem evidência de conexões saindo pra IPs estranhos (só pool xmr.kryptex)
- Sem ransomware/criptografia
- Bancos dos clientes íntegros (verificado por contagem de linhas)
- Recomendação: trocar senhas como precaução (atacante teve root, podia ter copiado)

### Bypass de autorização descoberto durante remediação
- ⚠️ Rotas Kontrata.ai não verificavam `moduleId` — bypass de menu = bypass de autorização (OWASP A01)
- ✅ Corrigido: `ProtectedRoute` agora recebe `moduleId` e redireciona pra `/perfil` se módulo não está ativo
- ✅ `/`, `/dashboard`, `*` agora usam `RedirectToFirstAllowed` (vai pra primeira tela permitida do usuário)
- Arquivos: `src/utils/modulesConfig.js`, `src/components/ProtectedRoute.jsx`, `src/App.jsx`

### Internet dos containers caiu pós-restart Docker (corrigido)
- Após operações de hardening, chain `FORWARD` ficou com policy DROP e Docker daemon perdeu regras
- Sintoma: containers sem internet (timeout em Google, SMTP, etc)
- Solução: `systemctl restart docker` recria todas as regras
- A regra de bloqueio dos bancos é reaplicada via `/usr/local/sbin/harden-firewall.sh` após restart

---

## 🚨 Sinais de comprometimento a monitorar daqui pra frente

Se vir qualquer um destes, **alerta vermelho**:

- CPU sustentada >80% sem motivo aparente
- Disco enchendo rápido sem explicação
- Processos com nomes do sistema (`systemd`, `kthread`, etc) em `/usr/local/bin/`
- Chaves SSH novas em `/root/.ssh/authorized_keys` que você não criou
- Services systemd novos em `/etc/systemd/system/` (especialmente sem prefix óbvio)
- Conexões TCP estabelecidas pra IPs/portas estranhas (`ss -tnp state established`)
- Pacotes apt instalados que você não pediu (`grep -i install /var/log/apt/history.log`)

---

## 🔗 Referências

- Tipo de malware: **XMRig** (Monero cryptominer open-source)
- Pool usado: `xmr.kryptex.network:8029`
- Carteira do atacante: `47S6DU9Qm3K848Krv6fAfZGgRn75653nbEPMxx3CYrWXBeTYnttJaWCDxDErGhH53u2cmbwahUymzPx71qDPneMsGjQ5pj4`
- CVE relacionada: brute force VNC (genérico, sem CVE específico)

---

*Documentado por Claude em 26/05/2026 durante a remediação. Atualizar este arquivo conforme novas ações forem tomadas.*

# TUNEL SSH - VPS + WINDOWS

## Visao Geral

Tuneis SSH reversos permitem que a VPS acesse servicos da rede local do cliente (Oracle, ERP, PDV) atraves de conexao SSH segura.

```
[Rede Local Cliente]                       [VPS Linux - Docker]

Oracle (10.6.1.100:1521)    <--+
                               |
Intersolid (10.6.1.102:3003)<--+---> SSH Tunnel <---> Container Backend
                               |
Windows Server (tunel)  -------+
```

## Como Funciona Agora (Via Frontend)

Os tuneis sao criados pelo FRONTEND do sistema, NAO mais manualmente:

1. Usuario configura tunel no frontend (nome, IP local, porta local, porta remota)
2. Backend gera par de chaves RSA 4096-bit
3. Chave publica adicionada ao `authorized_keys` do container E do host
4. Chave privada embutida no instalador .BAT baixado
5. Cliente executa .BAT no Windows da rede local
6. Servico PowerShell conecta via SSH reverso a VPS
7. Porta remota na VPS encaminha trafego para rede local do cliente

## Isolamento por Cliente

Cada cliente tem SSH isolado:

```yaml
# docker-compose.yml do cliente
volumes:
  # SSH isolado (cada cliente ve so seus tuneis)
  - ${CLIENT_DIR}/ssh_keys:/root/.ssh
  # SSH do HOST (para sshd autenticar)
  - /root/.ssh:/root/host_ssh
```

**Dual write:** Quando backend cria/exclui tunel, escreve em AMBOS:
- `/root/.ssh/authorized_keys` (container - para listar no frontend)
- `/root/host_ssh/authorized_keys` (host - para sshd autenticar)

**Arquivo responsavel:** `packages/backend/src/controllers/tunnel-installer.controller.ts`

## Seguranca do Tunel

- Conexao SAINTE (outbound) - nenhuma porta aberta no firewall do cliente
- Acesso LIMITADO - `permitopen` restringe portas especificas
- Sem Shell Remoto - flag `-N` e `restrict` impedem execucao de comandos
- Autenticacao por Chave SSH - RSA 4096-bit, sem senha
- Reconexao Automatica - servico PowerShell monitora a cada 30 segundos
- Fallback de porta - tenta 22, depois 443 se bloqueada

## Estrutura no Windows (Cliente)

```
C:\ProgramData\SSHTunnels\
├── tunnel_key              # Chave privada SSH
├── tunnel-service.ps1      # Servico do tunel
├── start-tunnel-service.vbs # Iniciador invisivel
├── tunnel-service.log      # Log do servico
└── ssh-port.txt            # Porta SSH detectada
```

## Tarefa Agendada

O instalador .BAT cria automaticamente:
- Nome: `SSH-Tunnel-<CLIENTE>`
- Trigger: Na inicializacao do Windows
- Delay: 1 minuto (para rede inicializar)
- Privilegio: Highest

## Verificacao

### Na VPS (verificar se tunel ta ativo):
```bash
# Ver portas de tunel ativas
ss -tlnp | grep sshd

# Ver authorized_keys do host
cat /root/.ssh/authorized_keys | grep @tunnel

# Ver authorized_keys isolado de um cliente
cat /root/clientes/<CLIENTE>/ssh_keys/authorized_keys
```

### No Windows (verificar se servico ta rodando):
```powershell
# Ver processos SSH
Get-Process ssh

# Ver log do servico
Get-Content "C:\ProgramData\SSHTunnels\tunnel-service.log" -Tail 20
```

## Configuracao Oracle via Tunel

| Ambiente | Host Oracle | Via |
|----------|-------------|-----|
| Local (dev) | `10.6.1.100` | Direto na rede |
| VPS (Docker) | `host.docker.internal` | Tunel SSH reverso |

Na VPS, `extra_hosts: host.docker.internal:host-gateway` no docker-compose permite container acessar portas do host.

## Regras UFW na VPS

Containers Docker precisam acessar portas dos tuneis. Regras UFW necessarias:

```bash
ufw allow from 172.20.0.0/16 to any port <PORTA> proto tcp comment '<SERVICO> Tunnel'
```

## Erros Comuns

| Erro | Causa | Solucao |
|------|-------|---------|
| ORA-12170 (timeout) | Tunel inativo ou firewall | Verificar `ss -tlnp`, verificar UFW |
| NJS-138 (Thin mode) | Sem Oracle Instant Client | Usar node:18-slim com Oracle Client |
| OFFLINE no frontend | Chave nao chegou no host | Verificar volume `/root/.ssh:/root/host_ssh` |
| Connection refused | Porta nao escutando | Verificar tunel no Windows + GatewayPorts |

## GatewayPorts

Em `/etc/ssh/sshd_config` da VPS:
```
GatewayPorts yes
```

Necessario para tunel escutar em todas as interfaces.

---

**Atualizado em:** 09/02/2026

# SAI TAILSCALE ENTRA TUNEL LOCAL

## Resumo
Substituição do Tailscale por túnel SSH reverso para conexão entre a VPS (145.223.92.152) e a rede local (10.6.1.x).

## Por que mudamos?
- Tailscale estava causando problemas de conexão
- Túnel SSH é mais simples e confiável
- Não precisa de software adicional instalado

## Como funciona agora

### Arquitetura
```
[VPS 145.223.92.152]  <---SSH Tunnel--->  [Windows 10.6.1.171]  --->  [APIs locais]
     porta 3003       ←────────────────→    porta 3003         --->  Intersolid 10.6.1.102:3003
     porta 8080       ←────────────────→    porta 8080         --->  Zanthus 10.6.1.101:80
```

### Configurações no Banco de Dados
| Chave | Valor Antigo | Valor Novo |
|-------|--------------|------------|
| intersolid_api_url | http://10.6.1.102 | http://172.18.0.1 |
| intersolid_port | 3003 | 3003 |
| zanthus_api_url | http://10.6.1.101 | http://172.18.0.1 |
| zanthus_port | (vazio) | 8080 |

**Nota:** `172.18.0.1` é o gateway da rede Docker, que permite o container do backend acessar o túnel SSH no host da VPS.

## Scripts do Túnel SSH

Localização: `C:\Users\Administrator\Desktop\ssh-tunnel\`

### Arquivos
1. **start-tunnel.bat** - Inicia o túnel manualmente (para testes)
2. **ssh-tunnel.ps1** - Script PowerShell com reconexão automática
3. **install-service.ps1** - Instala como tarefa agendada no Windows
4. **README.txt** - Instruções de uso

### Comando do Túnel
```bash
ssh -R 3003:10.6.1.102:3003 -R 8080:10.6.1.101:80 -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 root@145.223.92.152
```

Parâmetros:
- `-R 3003:10.6.1.102:3003` - Redireciona porta 3003 da VPS para Intersolid
- `-R 8080:10.6.1.101:80` - Redireciona porta 8080 da VPS para Zanthus
- `-N` - Não executa comando remoto (só túnel)
- `-o ServerAliveInterval=30` - Envia ping a cada 30 segundos
- `-o ServerAliveCountMax=3` - Desconecta após 3 pings sem resposta

## Serviço Windows

### Tarefa Agendada
- **Nome:** SSH-Tunnel-Intersolid
- **Execução:** Automática no boot do Windows
- **Reconexão:** Automática a cada 10 segundos se cair

### Comandos úteis (PowerShell)
```powershell
# Ver status
Get-ScheduledTask -TaskName "SSH-Tunnel-Intersolid" | Select-Object TaskName, State

# Iniciar
Start-ScheduledTask -TaskName "SSH-Tunnel-Intersolid"

# Parar
Stop-ScheduledTask -TaskName "SSH-Tunnel-Intersolid"

# Ver logs
Get-Content C:\Users\Administrator\Desktop\ssh-tunnel\tunnel.log -Tail 20
```

## Configuração SSH na VPS

### Arquivo: /etc/ssh/sshd_config
```
GatewayPorts yes
AllowTcpForwarding yes
```

### Chave SSH autorizada
A chave pública do Windows (Administrator@SRV_TRADICAO) foi adicionada em:
`/root/.ssh/authorized_keys`

## Troubleshooting

### Túnel não conecta
1. Verificar se o serviço está rodando no Windows
2. Verificar se a porta não está ocupada na VPS:
   ```bash
   netstat -tlnp | grep -E '3003|8080'
   ```
3. Liberar portas ocupadas:
   ```bash
   fuser -k 3003/tcp
   fuser -k 8080/tcp
   ```

### Erro ECONNREFUSED no teste de conexão
1. Verificar se o túnel está ativo
2. Verificar se está usando IP `172.18.0.1` (gateway Docker)
3. Não usar `localhost` ou `127.0.0.1` (não funciona de dentro do container)

### API retorna erro de autenticação
- Intersolid usa Basic Auth: usuário ROBERTO, senha 312013@#
- Zanthus não usa autenticação

## O que foi removido

### Configurações Tailscale deletadas do banco:
- tailscale_vps_ip
- tailscale_client_ip
- tailscale_client_subnet

### Nota sobre seed-configurations.ts
O arquivo `packages/backend/src/scripts/seed-configurations.ts` ainda contém referências ao Tailscale (linhas 116-127). Essas configurações NÃO são mais utilizadas e podem ser removidas em uma atualização futura.

## Data da mudança
14 de Janeiro de 2026

## Autor
Claude Code (assistente de programação)

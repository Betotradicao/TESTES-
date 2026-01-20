# TÚNEL SSH - VPS + WINDOWS

Documentação completa de como criar túneis SSH reversos entre uma máquina Windows e uma VPS Linux.

---

## Visão Geral

O túnel SSH reverso permite que a VPS acesse serviços da rede local do cliente (como ERP Intersolid e PDV Zanthus) através de uma conexão SSH segura.

```
[Rede Local Cliente]                    [VPS Linux]

Intersolid (10.6.1.102:3003) <---+
                                 |
Zanthus (10.6.1.101:80)    <-----+----> SSH Tunnel <----> localhost:3003
                                 |                        localhost:8080
Windows Server (túnel)     ------+
```

---

## Pré-requisitos

### Na máquina Windows:
- OpenSSH Client instalado (vem por padrão no Windows 10/Server 2019+)
- Chave SSH configurada (`C:\Users\Administrator\.ssh\id_rsa`)
- Acesso à rede local dos servidores (Intersolid, Zanthus, etc.)

### Na VPS Linux:
- SSH Server rodando
- Chave pública do Windows adicionada em `/root/.ssh/authorized_keys`
- Portas liberadas no firewall (se necessário)

---

## Estrutura de Arquivos

```
C:\ProgramData\SSHTunnels\
├── start-tunnels.ps1           # Script PowerShell (alternativo)
├── start-tunnels-hidden.vbs    # Script VBS (100% invisível)
└── TUNEL VPS + WINDOWS.md      # Esta documentação
```

---

## Arquivos Criados

### 1. Script VBS (Invisível) - `start-tunnels-hidden.vbs`

Este é o script principal usado. Executa sem abrir nenhuma janela.

```vbs
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""Start-Process ssh -ArgumentList '-R 3003:10.6.1.102:3003 root@46.202.150.64 -N -o ServerAliveInterval=60' -WindowStyle Hidden; Start-Process ssh -ArgumentList '-R 8080:10.6.1.101:80 root@46.202.150.64 -N -o ServerAliveInterval=60' -WindowStyle Hidden""", 0, False
```

**Parâmetros SSH:**
- `-R 3003:10.6.1.102:3003` - Túnel reverso: VPS:3003 → Intersolid:3003
- `-R 8080:10.6.1.101:80` - Túnel reverso: VPS:8080 → Zanthus:80
- `-N` - Não executar comando remoto (apenas túnel)
- `-o ServerAliveInterval=60` - Mantém conexão ativa enviando ping a cada 60s

### 2. Script PowerShell (Alternativo) - `start-tunnels.ps1`

Versão mais simples em PowerShell:

```powershell
# Tunnel VPS 46 - Script Simples
Start-Process ssh -ArgumentList '-R 3003:10.6.1.102:3003 root@46.202.150.64 -N -o ServerAliveInterval=60' -WindowStyle Hidden
Start-Process ssh -ArgumentList '-R 8080:10.6.1.101:80 root@46.202.150.64 -N -o ServerAliveInterval=60' -WindowStyle Hidden
```

---

## Configuração da Tarefa Agendada

### Criar tarefa via linha de comando:

```cmd
schtasks /create /tn "SSH-Tunnel-VPS46" /tr "wscript.exe \"C:\ProgramData\SSHTunnels\start-tunnels-hidden.vbs\"" /sc onstart /delay 0001:00 /rl highest /f
```

**Parâmetros:**
- `/tn "SSH-Tunnel-VPS46"` - Nome da tarefa
- `/tr "wscript.exe ..."` - Comando a executar (script VBS)
- `/sc onstart` - Executar na inicialização do sistema
- `/delay 0001:00` - Aguardar 1 minuto após boot (para rede inicializar)
- `/rl highest` - Executar com privilégios elevados
- `/f` - Forçar criação (sobrescreve se existir)

### Comandos úteis:

```cmd
# Listar tarefa
schtasks /query /tn "SSH-Tunnel-VPS46"

# Executar manualmente
schtasks /run /tn "SSH-Tunnel-VPS46"

# Excluir tarefa
schtasks /delete /tn "SSH-Tunnel-VPS46" /f
```

---

## Configuração da Chave SSH

### 1. Gerar chave (se não existir):

```powershell
ssh-keygen -t rsa -b 4096 -f "$env:USERPROFILE\.ssh\id_rsa" -N '""'
```

### 2. Copiar chave pública para a VPS:

```powershell
# Exibir chave pública
Get-Content "$env:USERPROFILE\.ssh\id_rsa.pub"

# Copiar manualmente para a VPS em /root/.ssh/authorized_keys
```

Ou via SSH (se já tiver acesso):
```powershell
type $env:USERPROFILE\.ssh\id_rsa.pub | ssh root@IP_DA_VPS "cat >> ~/.ssh/authorized_keys"
```

### 3. Testar conexão:

```powershell
ssh -o BatchMode=yes root@46.202.150.64 "echo OK"
```

---

## Verificação e Troubleshooting

### Verificar processos SSH rodando:

```powershell
Get-Process ssh
```

### Testar túneis na VPS:

```bash
# Na VPS, testar porta 3003 (Intersolid)
curl -s http://127.0.0.1:3003/

# Testar porta 8080 (Zanthus)
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/
```

### Matar processos SSH (se necessário):

```powershell
Get-Process ssh | Stop-Process -Force
```

### Ver logs de erro do SSH:

```powershell
# Executar SSH manualmente para ver erros
ssh -v -R 3003:10.6.1.102:3003 root@46.202.150.64 -N
```

---

## Configuração por Cliente

### VPS 46 - Tradição (46.202.150.64)

| Serviço | IP Local | Porta Local | Porta VPS |
|---------|----------|-------------|-----------|
| Intersolid ERP | 10.6.1.102 | 3003 | 3003 |
| Zanthus PDV | 10.6.1.101 | 80 | 8080 |

### VPS 145 - Outros clientes (145.223.92.152)

Configurar conforme necessidade do cliente.

---

## Resumo dos Comandos

```cmd
# Criar pasta
mkdir C:\ProgramData\SSHTunnels

# Criar script VBS
echo Set WshShell = CreateObject("WScript.Shell") > C:\ProgramData\SSHTunnels\start-tunnels-hidden.vbs
echo WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""Start-Process ssh -ArgumentList '-R PORTA:IP:PORTA root@VPS -N -o ServerAliveInterval=60' -WindowStyle Hidden""", 0, False >> C:\ProgramData\SSHTunnels\start-tunnels-hidden.vbs

# Criar tarefa agendada
schtasks /create /tn "SSH-Tunnel-NOME" /tr "wscript.exe \"C:\ProgramData\SSHTunnels\start-tunnels-hidden.vbs\"" /sc onstart /delay 0001:00 /rl highest /f

# Testar execução
schtasks /run /tn "SSH-Tunnel-NOME"

# Verificar processos
powershell Get-Process ssh
```

---

## Notas Importantes

1. **Delay de 1 minuto**: Necessário para garantir que a rede esteja disponível após o boot.

2. **Script VBS vs PowerShell**: O VBS é preferível pois não abre nenhuma janela visível.

3. **ServerAliveInterval**: Mantém a conexão ativa. Sem isso, conexões ociosas podem ser fechadas.

4. **Reconexão automática**: Os scripts atuais NÃO reconectam automaticamente se a conexão cair. Para isso, seria necessário um script mais complexo com loop de verificação.

5. **Múltiplos túneis**: Cada túnel é um processo SSH separado. Podem ser combinados em um único comando SSH se necessário.

---

*Documentação criada em: 20/01/2026*
*Autor: Claude Code*

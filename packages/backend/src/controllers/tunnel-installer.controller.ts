import { Request, Response } from 'express';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';

/**
 * Controller para gerar instaladores de túnel SSH seguros
 *
 * SEGURANÇA:
 * - Túnel SSH reverso é SEGURO por design (conexão sainte do cliente)
 * - Parâmetro -N impede execução de comandos (só túnel de dados)
 * - Chaves SSH dedicadas por cliente (geradas automaticamente)
 * - Restrição no authorized_keys limita acesso apenas às portas configuradas
 * - Chave privada embutida no instalador (transmitida via HTTPS)
 */
export class TunnelInstallerController {

  /**
   * GET /api/tunnel-installer/info
   * Retorna informações sobre o instalador de túnel
   */
  async getInfo(req: Request, res: Response) {
    return res.json({
      success: true,
      info: {
        title: 'Instalador de Túnel SSH Seguro',
        description: 'Configura conexão segura entre a rede local do cliente e a VPS',
        security: [
          'Conexão SAINTE (outbound) - nenhuma porta aberta no firewall do cliente',
          'Acesso LIMITADO - VPS só acessa IPs/portas específicas configuradas',
          'Sem Shell Remoto - parâmetro -N impede execução de comandos',
          'Autenticação por Chave SSH - sem senha, impossível brute force',
          'Reconexão Automática - serviço monitora e reconecta se cair'
        ],
        requirements: {
          windows: 'Windows 10/Server 2019+ com OpenSSH Client',
          linux: 'Qualquer distribuição com SSH client'
        }
      }
    });
  }

  /**
   * POST /api/tunnel-installer/generate
   * Gera scripts de instalação personalizados para o cliente
   */
  async generateInstaller(req: Request, res: Response) {
    try {
      const {
        clientName,       // Nome do cliente (ex: "Tradicao")
        vpsIp,            // IP da VPS (ex: "46.202.150.64")
        tunnels           // Array de túneis [{name, localIp, localPort, remotePort}]
      } = req.body;

      if (!clientName || !vpsIp || !tunnels || tunnels.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Campos obrigatórios: clientName, vpsIp, tunnels'
        });
      }

      // Validar túneis
      for (const tunnel of tunnels) {
        if (!tunnel.name || !tunnel.localIp || !tunnel.localPort || !tunnel.remotePort) {
          return res.status(400).json({
            success: false,
            error: 'Cada túnel precisa: name, localIp, localPort, remotePort'
          });
        }
      }

      return res.json({
        success: true,
        clientName,
        vpsIp,
        tunnels,
        message: 'Use /download/bat para baixar o instalador completo ou /download/discover para descoberta de rede'
      });
    } catch (error: any) {
      console.error('Erro ao gerar instalador:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar instalador',
        message: error.message
      });
    }
  }

  /**
   * Testa conectividade TCP numa porta (cross-platform, sem dependência de powershell)
   */
  private testPort(port: number, timeout: number = 3000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, 'localhost');
    });
  }

  /**
   * POST /api/tunnel-installer/test
   * Testa se os túneis estão funcionando (verifica portas no localhost)
   */
  async testTunnels(req: Request, res: Response) {
    try {
      const { tunnels } = req.body;

      if (!tunnels || tunnels.length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum túnel para testar' });
      }

      const results = [];
      for (const tunnel of tunnels) {
        const port = parseInt(tunnel.remotePort, 10);
        const name = tunnel.name || `Porta ${port}`;
        let status = 'offline';
        let message = '';

        try {
          const isOpen = await this.testPort(port);
          if (isOpen) {
            status = 'online';
            message = `Porta ${port} acessível - túnel ativo!`;
          } else {
            message = `Porta ${port} não responde - túnel pode estar desconectado`;
          }
        } catch (err: any) {
          message = `Erro ao testar porta ${port}: ${err.message}`;
        }

        results.push({ name, port, status, message });
      }

      const allOnline = results.every(r => r.status === 'online');
      const anyOnline = results.some(r => r.status === 'online');

      return res.json({
        success: true,
        status: allOnline ? 'online' : anyOnline ? 'partial' : 'offline',
        results
      });
    } catch (error: any) {
      console.error('Erro ao testar túneis:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao testar túneis',
        message: error.message
      });
    }
  }

  /**
   * POST /api/tunnel-installer/download/:type
   * Faz download de um script específico
   */
  async downloadScript(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const {
        clientName,
        vpsIp,
        tunnels
      } = req.body;

      let content: string;
      let filename: string;
      let contentType: string;

      // Script de descoberta não precisa de tunnels/vpsIp
      if (type === 'discover') {
        const name = (clientName || 'cliente').toLowerCase().replace(/\s+/g, '-');
        const scripts = this.generateScripts(clientName || 'Cliente', '', [], '');
        content = scripts.discoverNetwork;
        filename = `descobrir-rede-${name}.bat`;
        contentType = 'application/x-bat';
      } else if (type === 'bat') {
        // Validar dados completos
        if (!clientName || !vpsIp || !tunnels || tunnels.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Dados incompletos. Preencha nome do cliente, IP da VPS e pelo menos um túnel.'
          });
        }

        // Gerar par de chaves SSH e instalar no authorized_keys
        const { privateKey } = this.generateAndInstallKeyPair(clientName, tunnels);

        // Gerar scripts com a chave privada embutida
        const scripts = this.generateScripts(clientName, vpsIp, tunnels, privateKey);
        content = scripts.bat;
        filename = `install-tunnel-${clientName.toLowerCase().replace(/\s+/g, '-')}.bat`;
        contentType = 'application/x-bat';
      } else {
        return res.status(400).json({
          success: false,
          error: 'Tipo de script inválido. Use: discover ou bat'
        });
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(content);
    } catch (error: any) {
      console.error('Erro ao gerar download:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar download',
        message: error.message
      });
    }
  }

  /**
   * Gera par de chaves SSH e adiciona pública ao authorized_keys da VPS
   * PRIVATE METHOD
   */
  private generateAndInstallKeyPair(clientName: string, tunnels: any[]): { privateKey: string; publicKey: string } {
    const sanitized = clientName.replace(/[^a-zA-Z0-9]/g, '');
    const tmpDir = os.tmpdir();
    const keyPath = path.join(tmpDir, `tunnel_key_${sanitized}_${Date.now()}`);

    // Limpar chaves temp anteriores
    try { fs.unlinkSync(keyPath); } catch {}
    try { fs.unlinkSync(keyPath + '.pub'); } catch {}

    // Gerar par de chaves
    execSync(`ssh-keygen -t rsa -b 4096 -f "${keyPath}" -N "" -C "${sanitized}@tunnel"`, {
      stdio: 'pipe'
    });

    const privateKey = fs.readFileSync(keyPath, 'utf8');
    const publicKey = fs.readFileSync(keyPath + '.pub', 'utf8').trim();

    // Limpar arquivos temporários
    try { fs.unlinkSync(keyPath); } catch {}
    try { fs.unlinkSync(keyPath + '.pub'); } catch {}

    // Montar restrição para authorized_keys
    const portRestrictions = tunnels.map(t => `permitopen="localhost:${t.remotePort}"`).join(',');
    const restriction = `restrict,port-forwarding,${portRestrictions}`;
    const authorizedKeysLine = `${restriction} ${publicKey}`;

    // Detectar caminho do authorized_keys
    let authorizedKeysPath: string;
    if (process.platform === 'win32') {
      // Windows - usar pasta do usuário atual
      authorizedKeysPath = path.join(os.homedir(), '.ssh', 'authorized_keys');
    } else {
      // Linux (VPS) - usar /root
      authorizedKeysPath = '/root/.ssh/authorized_keys';
    }

    // Garantir que a pasta .ssh existe
    const sshDir = path.dirname(authorizedKeysPath);
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
    }

    // Remover chaves antigas do mesmo cliente (se existir)
    if (fs.existsSync(authorizedKeysPath)) {
      const existing = fs.readFileSync(authorizedKeysPath, 'utf8');
      const lines = existing.split('\n').filter(line =>
        !line.includes(`${sanitized}@tunnel`)
      );
      fs.writeFileSync(authorizedKeysPath, lines.join('\n'));
    }

    // Adicionar nova chave
    fs.appendFileSync(authorizedKeysPath, '\n' + authorizedKeysLine + '\n');

    console.log(`[Tunnel] Chave SSH gerada e instalada para cliente: ${clientName}`);
    console.log(`[Tunnel] authorized_keys atualizado: ${authorizedKeysPath}`);

    return { privateKey, publicKey };
  }

  /**
   * Gera todos os scripts necessários
   * PRIVATE METHOD
   */
  private generateScripts(clientName: string, vpsIp: string, tunnels: any[], privateKey: string) {
    const sanitizedName = clientName.replace(/[^a-zA-Z0-9]/g, '');
    const taskName = `SSH-Tunnel-${sanitizedName}`;

    // Gerar linhas de variáveis para cada túnel
    const tunnelVars = tunnels.map((t, i) =>
      `$TUNNEL${i + 1}_NAME = "${t.name}"\n$TUNNEL${i + 1}_LOCAL_IP = "${t.localIp}"\n$TUNNEL${i + 1}_LOCAL_PORT = "${t.localPort}"\n$TUNNEL${i + 1}_REMOTE_PORT = "${t.remotePort}"`
    ).join('\n\n');

    // Gerar inicializações de túneis
    const tunnelInits = tunnels.map((_, i) => `$tunnel${i + 1} = $null`).join('\n');

    // Script PowerShell principal (com -i para chave privada)
    const powershell = `# ============================================================
# SERVICO DE TUNEL SSH - ${clientName.toUpperCase()}
# Gerado automaticamente pelo Prevencao no Radar
# ============================================================
#
# SEGURANCA:
# - Conexao SAINTE (outbound) - nenhuma porta aberta no firewall
# - Parametro -N impede execucao de comandos remotos
# - Chave SSH dedicada para este cliente
# - Reconexao automatica se conexao cair
# - Fallback automatico: porta 22 -> 443 se bloqueada
#
# ============================================================

$VPS_IP = "${vpsIp}"
$SSH_PORTS = @(22, 443)  # Tenta 22 primeiro, fallback para 443
$ACTIVE_SSH_PORT = $null
$SSH_KEY = "C:\\ProgramData\\SSHTunnels\\tunnel_key"

# Configuracao dos Tuneis
${tunnelVars}

$LOG_FILE = "C:\\ProgramData\\SSHTunnels\\tunnel-service.log"
$PORT_FILE = "C:\\ProgramData\\SSHTunnels\\ssh-port.txt"

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $LOG_FILE -Append -Encoding UTF8
}

function Test-TunnelConnection {
    param($ProcessId)
    if ($ProcessId -eq $null) { return $false }
    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    return ($proc -ne $null -and -not $proc.HasExited)
}

function Find-SSHPort {
    # Se ja tem porta salva e funciona, usar ela
    if (Test-Path $PORT_FILE) {
        $savedPort = Get-Content $PORT_FILE -ErrorAction SilentlyContinue
        if ($savedPort) {
            try {
                $tcp = New-Object System.Net.Sockets.TcpClient
                $result = $tcp.BeginConnect($VPS_IP, [int]$savedPort, $null, $null)
                $wait = $result.AsyncWaitHandle.WaitOne(5000, $false)
                if ($wait -and $tcp.Connected) {
                    $tcp.Close()
                    Write-Log "Porta SSH salva OK: $savedPort"
                    return [int]$savedPort
                }
                $tcp.Close()
            } catch {}
        }
    }

    # Testar cada porta
    foreach ($port in $SSH_PORTS) {
        Write-Log "Testando conexao SSH na porta $port..."
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $result = $tcp.BeginConnect($VPS_IP, $port, $null, $null)
            $wait = $result.AsyncWaitHandle.WaitOne(5000, $false)
            if ($wait -and $tcp.Connected) {
                $tcp.Close()
                Write-Log "Porta SSH $port: CONECTOU!"
                # Salvar porta que funcionou
                $port | Out-File -FilePath $PORT_FILE -Encoding UTF8
                return $port
            }
            $tcp.Close()
            Write-Log "Porta SSH $port: sem resposta"
        } catch {
            Write-Log "Porta SSH $port: erro - $_"
        }
    }

    Write-Log "ERRO: Nenhuma porta SSH disponivel (testou: $($SSH_PORTS -join ', '))"
    return $null
}

function Start-Tunnel {
    param($LocalIP, $LocalPort, $RemotePort, $Name, $SSHPort)

    # SEGURANCA: -N impede execucao de comandos (so tunel)
    # -i especifica a chave privada dedicada
    # -o BatchMode=yes impede prompts interativos
    # -o ExitOnForwardFailure=yes encerra se tunel falhar (permite reconexao)
    $sshArgs = "-i $SSH_KEY -p $SSHPort -R \${RemotePort}:\${LocalIP}:\${LocalPort} root@\${VPS_IP} -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=no -o BatchMode=yes -o ExitOnForwardFailure=yes"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "ssh"
    $psi.Arguments = $sshArgs
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden

    $process = [System.Diagnostics.Process]::Start($psi)
    Write-Log "Tunnel $Name iniciado na porta SSH $SSHPort (PID: $($process.Id))"
    return $process
}

# Limpar log antigo se maior que 1MB
if (Test-Path $LOG_FILE) {
    $logSize = (Get-Item $LOG_FILE).Length
    if ($logSize -gt 1MB) {
        Remove-Item $LOG_FILE -Force
        Write-Log "Log limpo (tamanho anterior: $([math]::Round($logSize/1MB, 2)) MB)"
    }
}

Write-Log "=========================================="
Write-Log "SERVICO DE TUNEL INICIADO - ${clientName}"
Write-Log "VPS: $VPS_IP"
Write-Log "Portas SSH configuradas: $($SSH_PORTS -join ', ') (fallback automatico)"
${tunnels.map(t => `Write-Log "${t.name}: ${t.localIp}:${t.localPort} -> VPS:${t.remotePort}"`).join('\n')}
Write-Log "=========================================="

${tunnelInits}
$checkInterval = 30  # Verificar a cada 30 segundos
$portCheckInterval = 0  # Forcar verificacao de porta na primeira iteracao

while ($true) {
    try {
        # Verificar/detectar porta SSH a cada 10 minutos ou quando necessario
        $portCheckInterval++
        if ($ACTIVE_SSH_PORT -eq $null -or $portCheckInterval -ge 20) {
            $newPort = Find-SSHPort
            if ($newPort -ne $null -and $newPort -ne $ACTIVE_SSH_PORT) {
                if ($ACTIVE_SSH_PORT -ne $null) {
                    Write-Log "PORTA SSH MUDOU: $ACTIVE_SSH_PORT -> $newPort (reconectando todos os tuneis...)"
                    # Matar todos os tuneis existentes para reconectar na nova porta
${tunnels.map((_, i) => `                    if ($tunnel${i + 1} -ne $null -and $tunnel${i + 1}.Id) { try { Stop-Process -Id $tunnel${i + 1}.Id -Force -ErrorAction SilentlyContinue } catch {} }
                    $tunnel${i + 1} = $null`).join('\n')}
                }
                $ACTIVE_SSH_PORT = $newPort
            }
            $portCheckInterval = 0
        }

        if ($ACTIVE_SSH_PORT -eq $null) {
            Write-Log "Sem porta SSH disponivel. Tentando novamente em 30s..."
            Start-Sleep -Seconds 30
            continue
        }

${tunnels.map((t, i) => `
        # Verificar e iniciar Tunnel ${i + 1} (${t.name})
        if (-not (Test-TunnelConnection $tunnel${i + 1}?.Id)) {
            if ($tunnel${i + 1} -ne $null) {
                Write-Log "Tunnel ${t.name} caiu! Reconectando na porta SSH $ACTIVE_SSH_PORT..."
            }
            $tunnel${i + 1} = Start-Tunnel -LocalIP $TUNNEL${i + 1}_LOCAL_IP -LocalPort $TUNNEL${i + 1}_LOCAL_PORT -RemotePort $TUNNEL${i + 1}_REMOTE_PORT -Name $TUNNEL${i + 1}_NAME -SSHPort $ACTIVE_SSH_PORT
            Start-Sleep -Seconds 2
        }`).join('\n')}

        # Aguardar antes da proxima verificacao
        Start-Sleep -Seconds $checkInterval

    } catch {
        Write-Log "ERRO: $_"
        Start-Sleep -Seconds 5
    }
}
`;

    // Codificar PS1 do serviço em Base64 para embutir no BAT
    const ps1Base64 = Buffer.from(powershell, 'utf8').toString('base64');
    const ps1Chunks: string[] = [];
    for (let i = 0; i < ps1Base64.length; i += 900) {
      ps1Chunks.push(ps1Base64.substring(i, i + 900));
    }
    const ps1EchoLines = ps1Chunks.map((chunk, i) => {
      const op = i === 0 ? '>' : '>>';
      return `echo ${chunk} ${op} "%TEMP%\\tunnel-ps1.b64"`;
    }).join('\n');

    // Codificar chave privada em Base64 para embutir no BAT
    const keyBase64 = Buffer.from(privateKey, 'utf8').toString('base64');
    const keyChunks: string[] = [];
    for (let i = 0; i < keyBase64.length; i += 900) {
      keyChunks.push(keyBase64.substring(i, i + 900));
    }
    const keyEchoLines = keyChunks.map((chunk, i) => {
      const op = i === 0 ? '>' : '>>';
      return `echo ${chunk} ${op} "%TEMP%\\tunnel-key.b64"`;
    }).join('\n');

    // Script BAT de instalação completa (tudo em 1 arquivo, 1 execução)
    const bat = `@echo off
chcp 65001 >nul 2>&1
title Instalador de Tunel SSH - ${clientName}
REM ============================================================
REM INSTALADOR DE TUNEL SSH - ${clientName.toUpperCase()}
REM Execute como ADMINISTRADOR
REM Este arquivo unico instala tudo automaticamente
REM ============================================================

echo.
echo ============================================================
echo    INSTALADOR DE TUNEL SSH SEGURO
echo    Cliente: ${clientName}
echo    VPS: ${vpsIp}
echo    Portas SSH: 22 (padrao) / 443 (fallback automatico)
echo ============================================================
echo.

REM Verificar se esta rodando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Execute este script como ADMINISTRADOR!
    echo Clique com botao direito e escolha "Executar como administrador"
    echo.
    pause
    exit /b 1
)

echo [1/9] Limpando instalacao anterior (se existir)...
REM Parar servico existente
powershell -Command "Get-Process ssh -ErrorAction SilentlyContinue | Stop-Process -Force" 2>nul
schtasks /delete /tn "${taskName}" /f 2>nul
REM Resetar permissoes e apagar arquivos antigos
if exist "C:\\ProgramData\\SSHTunnels\\tunnel_key" (
    icacls "C:\\ProgramData\\SSHTunnels\\tunnel_key" /reset >nul 2>&1
    del /f "C:\\ProgramData\\SSHTunnels\\tunnel_key" 2>nul
)
del /f "C:\\ProgramData\\SSHTunnels\\tunnel-service.ps1" 2>nul
del /f "C:\\ProgramData\\SSHTunnels\\start-tunnel-service.vbs" 2>nul
del /f "C:\\ProgramData\\SSHTunnels\\tunnel-service.log" 2>nul
del /f "C:\\ProgramData\\SSHTunnels\\ssh-port.txt" 2>nul
echo     Limpeza concluida!

echo [2/9] Criando pasta de instalacao...
mkdir "C:\\ProgramData\\SSHTunnels" 2>nul

echo [3/9] Gravando chave privada SSH...
${keyEchoLines}
powershell -Command "$b64 = (Get-Content '%TEMP%\\tunnel-key.b64' -Raw) -replace '\\s',''; [System.IO.File]::WriteAllText('C:\\ProgramData\\SSHTunnels\\tunnel_key', [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)))"
del "%TEMP%\\tunnel-key.b64" 2>nul

if not exist "C:\\ProgramData\\SSHTunnels\\tunnel_key" (
    echo     ERRO: Falha ao criar chave privada!
    pause
    exit /b 1
)
echo     Chave privada criada!

echo [4/9] Configurando permissoes da chave...
icacls "C:\\ProgramData\\SSHTunnels\\tunnel_key" /inheritance:r /grant:r "%USERNAME%":R >nul 2>&1
echo     Permissoes configuradas!

echo [5/9] Criando script do servico de tunel...
${ps1EchoLines}
powershell -Command "$b64 = (Get-Content '%TEMP%\\tunnel-ps1.b64' -Raw) -replace '\\s',''; [System.IO.File]::WriteAllText('C:\\ProgramData\\SSHTunnels\\tunnel-service.ps1', [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)))"
del "%TEMP%\\tunnel-ps1.b64" 2>nul

if not exist "C:\\ProgramData\\SSHTunnels\\tunnel-service.ps1" (
    echo     ERRO: Falha ao criar script do servico!
    pause
    exit /b 1
)
echo     tunnel-service.ps1 criado!

echo [6/9] Criando iniciador invisivel...
echo Set WshShell = CreateObject("WScript.Shell") > "C:\\ProgramData\\SSHTunnels\\start-tunnel-service.vbs"
echo WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File ""C:\\ProgramData\\SSHTunnels\\tunnel-service.ps1""", 0, False >> "C:\\ProgramData\\SSHTunnels\\start-tunnel-service.vbs"
echo     start-tunnel-service.vbs criado!

echo [7/9] Testando conectividade SSH com a VPS...
echo     Testando porta 22...
powershell -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient; $r = $tcp.BeginConnect('${vpsIp}', 22, $null, $null); $w = $r.AsyncWaitHandle.WaitOne(5000, $false); if ($w -and $tcp.Connected) { $tcp.Close(); '22' | Out-File '%TEMP%\\ssh-port-test.txt' -NoNewline } else { $tcp.Close() } } catch {}"
if exist "%TEMP%\\ssh-port-test.txt" (
    echo     Porta 22: OK!
    set SSH_PORT=22
    del "%TEMP%\\ssh-port-test.txt" 2>nul
    goto :port_found
)

echo     Porta 22 bloqueada. Testando porta 443...
powershell -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient; $r = $tcp.BeginConnect('${vpsIp}', 443, $null, $null); $w = $r.AsyncWaitHandle.WaitOne(5000, $false); if ($w -and $tcp.Connected) { $tcp.Close(); '443' | Out-File '%TEMP%\\ssh-port-test.txt' -NoNewline } else { $tcp.Close() } } catch {}"
if exist "%TEMP%\\ssh-port-test.txt" (
    echo     Porta 443: OK!
    set SSH_PORT=443
    del "%TEMP%\\ssh-port-test.txt" 2>nul
    goto :port_found
)

echo.
echo     AVISO: Nenhuma porta SSH acessivel (22 e 443 bloqueadas)
echo     O servico vai continuar tentando automaticamente apos instalacao.
echo     Verifique o firewall ou peca ao admin da VPS liberar a porta 443.
echo.
set SSH_PORT=22

:port_found
echo     Porta SSH selecionada: %SSH_PORT%
echo %SSH_PORT% > "C:\\ProgramData\\SSHTunnels\\ssh-port.txt"

echo [8/9] Criando tarefa agendada (inicia com Windows)...
schtasks /delete /tn "${taskName}" /f 2>nul
schtasks /create /tn "${taskName}" /tr "wscript.exe \\"C:\\ProgramData\\SSHTunnels\\start-tunnel-service.vbs\\"" /sc onstart /delay 0001:00 /rl highest /f

if %errorLevel% neq 0 (
    echo ERRO: Falha ao criar tarefa agendada!
    pause
    exit /b 1
)

echo [9/9] Iniciando servico...
wscript.exe "C:\\ProgramData\\SSHTunnels\\start-tunnel-service.vbs"

echo.
echo ============================================================
echo    INSTALACAO CONCLUIDA!
echo ============================================================
echo.
echo Tudo instalado em: C:\\ProgramData\\SSHTunnels\\
echo   - tunnel_key                 (chave privada SSH)
echo   - tunnel-service.ps1         (servico do tunel)
echo   - start-tunnel-service.vbs   (iniciador invisivel)
echo   - ssh-port.txt               (porta SSH detectada)
echo.
echo O tunel inicia automaticamente quando o Windows ligar.
echo Porta SSH: %SSH_PORT% (fallback automatico se mudar)
echo.
echo Para verificar se esta funcionando:
echo   powershell Get-Process ssh
echo   powershell Get-Content "C:\\ProgramData\\SSHTunnels\\tunnel-service.log" -Tail 10
echo.
pause
`;

    // Script PowerShell para verificação da máquina local
    const psDiscoverScript = `$ErrorActionPreference = 'SilentlyContinue'

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '   VERIFICACAO DA MAQUINA - ${clientName.toUpperCase()}' -ForegroundColor Cyan
Write-Host '   Prevencao no Radar' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''

Write-Host '  INFORMACOES DESTA MAQUINA' -ForegroundColor Cyan
Write-Host '  =========================' -ForegroundColor Cyan
Write-Host ''

$localIPs = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -ExpandProperty IPAddress
Write-Host '  IPs desta maquina:' -ForegroundColor Green
foreach ($ip in $localIPs) {
    Write-Host "    -> $ip" -ForegroundColor Yellow
}
Write-Host ''
Write-Host "  Nome do computador: $env:COMPUTERNAME" -ForegroundColor White
Write-Host "  Sistema: $([System.Environment]::OSVersion.VersionString)" -ForegroundColor White
Write-Host ''

Write-Host '  SERVICOS ATIVOS NESTA MAQUINA' -ForegroundColor Cyan
Write-Host '  ==============================' -ForegroundColor Cyan
Write-Host ''

$ports = @(
    @{Port=1521; Name='Oracle Database'},
    @{Port=80; Name='HTTP (Zanthus/Web)'},
    @{Port=8080; Name='HTTP Alternativo'},
    @{Port=3003; Name='Intersolid'},
    @{Port=3000; Name='API/NodeJS'},
    @{Port=5432; Name='PostgreSQL'},
    @{Port=3306; Name='MySQL'},
    @{Port=1433; Name='SQL Server'},
    @{Port=8888; Name='Zanthus PDV'},
    @{Port=443; Name='HTTPS'},
    @{Port=22; Name='SSH'},
    @{Port=3389; Name='Acesso Remoto (RDP)'}
)

$foundLocal = @()
foreach ($p in $ports) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect('127.0.0.1', $p.Port)
        $tcp.Close()
        Write-Host "  [ATIVO] Porta $($p.Port) - $($p.Name)" -ForegroundColor Green
        $foundLocal += $p
    } catch {
        Write-Host "  [ -- ] Porta $($p.Port) - $($p.Name)" -ForegroundColor DarkGray
    }
}

Write-Host ''
Write-Host '  ============================================' -ForegroundColor Cyan
Write-Host '  RESUMO - ENVIE PARA O SUPORTE' -ForegroundColor Cyan
Write-Host '  ============================================' -ForegroundColor Cyan
Write-Host ''
Write-Host "  Cliente: ${clientName}" -ForegroundColor White
$myIP = if ($localIPs -is [array]) { $localIPs[0] } else { $localIPs }
Write-Host "  IP principal: $myIP" -ForegroundColor White
Write-Host "  Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm')" -ForegroundColor White
Write-Host ''

if ($foundLocal.Count -gt 0) {
    Write-Host '  Servicos encontrados nesta maquina:' -ForegroundColor Green
    foreach ($s in $foundLocal) {
        Write-Host "    -> $($s.Name) (porta $($s.Port))" -ForegroundColor Yellow
    }
} else {
    Write-Host '  Nenhum servico conhecido encontrado nesta maquina.' -ForegroundColor Red
}

Write-Host ''
Write-Host '  ============================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '  NOTA: Os enderecos IP e credenciais dos bancos de' -ForegroundColor Gray
Write-Host '  dados devem ser fornecidos pelo TI do cliente.' -ForegroundColor Gray
Write-Host ''
Write-Host 'Pressione qualquer tecla para fechar...' -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
`;

    // Codificar o PS1 em Base64 e dividir em chunks para não estourar limite CMD (8191 chars)
    const psBase64 = Buffer.from(psDiscoverScript, 'utf8').toString('base64');
    const chunkSize = 900;
    const chunks: string[] = [];
    for (let i = 0; i < psBase64.length; i += chunkSize) {
      chunks.push(psBase64.substring(i, i + chunkSize));
    }

    // Gerar linhas echo - primeira usa >, resto usa >>
    const echoLines = chunks.map((chunk, i) => {
      const op = i === 0 ? '>' : '>>';
      return `echo ${chunk} ${op} "%TEMP%\\discover-radar.b64"`;
    }).join('\n');

    // BAT que grava base64 em arquivo, decodifica e executa
    const discoverNetwork = `@echo off
chcp 65001 >nul 2>&1
title Descoberta de Rede - ${clientName} - Prevencao no Radar
echo.
echo ============================================================
echo    DESCOBERTA DE REDE - ${clientName.toUpperCase()}
echo    Prevencao no Radar - Detector de Servicos
echo ============================================================
echo.
echo Preparando script de deteccao...

REM Gravar base64 em arquivo temporario (em partes)
${echoLines}

REM Decodificar base64 para PS1
powershell -Command "$b64 = (Get-Content '%TEMP%\\discover-radar.b64' -Raw) -replace '\\s',''; [System.IO.File]::WriteAllText('%TEMP%\\descobrir-rede.ps1', [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)))"

REM Verificar se o arquivo foi criado
if not exist "%TEMP%\\descobrir-rede.ps1" (
    echo.
    echo ERRO: Falha ao criar script de deteccao!
    echo Tente executar como Administrador.
    echo.
    pause
    exit /b 1
)

echo Script criado com sucesso!
echo.
echo Iniciando deteccao de servicos na rede...
echo.

REM Executar o script PowerShell
powershell -ExecutionPolicy Bypass -File "%TEMP%\\descobrir-rede.ps1"

REM Limpar arquivos temporarios
del "%TEMP%\\discover-radar.b64" 2>nul
del "%TEMP%\\descobrir-rede.ps1" 2>nul

echo.
echo Pressione qualquer tecla para fechar...
pause >nul
`;

    // Converter BATs para CRLF (CMD do Windows exige \r\n)
    const toCRLF = (s: string) => s.replace(/\r?\n/g, '\r\n');

    return {
      bat: toCRLF(bat),
      discoverNetwork: toCRLF(discoverNetwork),
      taskName
    };
  }
}

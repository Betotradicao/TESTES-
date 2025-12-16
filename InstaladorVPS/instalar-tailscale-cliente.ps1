# ============================================
# INSTALADOR TAILSCALE - CLIENTE (WINDOWS)
# Sistema: Prevenção no Radar
# ============================================

Write-Host "╔════════════════════════════════════════════════════════════╗"
Write-Host "║                                                            ║"
Write-Host "║     INSTALADOR TAILSCALE - CLIENTE (WINDOWS/ERP)          ║"
Write-Host "║                                                            ║"
Write-Host "╚════════════════════════════════════════════════════════════╝"
Write-Host ""

# Verificar se está rodando como Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERRO: Execute este script como Administrador!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Clique com o botão direito no PowerShell e selecione 'Executar como Administrador'" -ForegroundColor Yellow
    pause
    exit 1
}

# ============================================
# DETECTAR REDE LOCAL
# ============================================

Write-Host "🔍 Detectando rede local..."
Write-Host ""

# Pegar o IP e máscara da interface de rede ativa (geralmente Ethernet ou Wi-Fi)
$networkAdapter = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual"
} | Select-Object -First 1

if (-not $networkAdapter) {
    Write-Host "❌ Não foi possível detectar a rede local automaticamente" -ForegroundColor Red
    $localNetwork = Read-Host "Digite a rede local no formato CIDR (ex: 10.6.1.0/24)"
} else {
    $ip = $networkAdapter.IPAddress
    $prefix = $networkAdapter.PrefixLength

    # Calcular o endereço de rede
    $ipBytes = [System.Net.IPAddress]::Parse($ip).GetAddressBytes()
    $maskBytes = [System.Net.IPAddress]::Parse("255.255.255.0").GetAddressBytes()

    $networkBytes = @()
    for ($i = 0; $i -lt 4; $i++) {
        $networkBytes += $ipBytes[$i] -band $maskBytes[$i]
    }

    $networkAddress = [String]::Join(".", $networkBytes)
    $localNetwork = "$networkAddress/$prefix"

    Write-Host "✅ Rede local detectada: $localNetwork" -ForegroundColor Green
    Write-Host "   IP deste computador: $ip" -ForegroundColor Cyan
    Write-Host ""

    $confirmNetwork = Read-Host "Esta rede está correta? (S/n)"
    if ($confirmNetwork -eq "n" -or $confirmNetwork -eq "N") {
        $localNetwork = Read-Host "Digite a rede local no formato CIDR (ex: 10.6.1.0/24)"
    }
}

Write-Host ""

# ============================================
# VERIFICAR SE TAILSCALE JÁ ESTÁ INSTALADO
# ============================================

Write-Host "🔍 Verificando se Tailscale está instalado..."

$tailscalePath = "C:\Program Files\Tailscale\tailscale.exe"
$tailscaleInstalled = Test-Path $tailscalePath

if ($tailscaleInstalled) {
    Write-Host "✅ Tailscale já está instalado" -ForegroundColor Green
} else {
    Write-Host "📦 Tailscale não encontrado. Iniciando instalação..." -ForegroundColor Yellow
    Write-Host ""

    # Baixar instalador
    $installerUrl = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
    $installerPath = "$env:TEMP\tailscale-setup.exe"

    Write-Host "⬇️  Baixando Tailscale..."
    try {
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
        Write-Host "✅ Download concluído" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erro ao baixar Tailscale: $_" -ForegroundColor Red
        pause
        exit 1
    }

    # Instalar
    Write-Host ""
    Write-Host "📦 Instalando Tailscale..."
    try {
        Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait
        Write-Host "✅ Tailscale instalado com sucesso" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erro ao instalar Tailscale: $_" -ForegroundColor Red
        pause
        exit 1
    }

    # Limpar arquivo temporário
    Remove-Item $installerPath -ErrorAction SilentlyContinue
}

Write-Host ""

# ============================================
# PERGUNTAR AUTHKEY (OPCIONAL)
# ============================================

Write-Host "🔑 Autenticação do Tailscale"
Write-Host ""
Write-Host "Você tem uma Auth Key do Tailscale?"
Write-Host "(Se não tiver, será necessário autenticar no navegador)"
Write-Host ""
$authKey = Read-Host "Cole a Auth Key aqui (ou deixe vazio para autenticar manualmente)"

Write-Host ""

# ============================================
# CONECTAR AO TAILSCALE
# ============================================

Write-Host "🚀 Conectando ao Tailscale..."
Write-Host ""

if ($authKey) {
    # Conectar com Auth Key
    Write-Host "🔐 Usando Auth Key para conectar automaticamente..."
    & $tailscalePath up --authkey=$authKey --advertise-routes=$localNetwork --accept-routes
} else {
    # Conectar manualmente (abre navegador)
    Write-Host "🌐 Abrindo navegador para autenticação manual..."
    Write-Host "   Uma janela do navegador será aberta. Faça login na sua conta Tailscale."
    Write-Host ""
    & $tailscalePath up --advertise-routes=$localNetwork --accept-routes
}

Write-Host ""

# Aguardar conexão
Write-Host "⏳ Aguardando conexão..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Obter IP do Tailscale
$tailscaleIP = & $tailscalePath ip -4 2>$null

if ($tailscaleIP) {
    Write-Host "✅ Conectado com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 IP Tailscale deste computador: $tailscaleIP" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Tailscale iniciado, mas IP ainda não disponível" -ForegroundColor Yellow
    Write-Host "   Execute 'tailscale ip -4' para ver o IP após a autenticação" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗"
Write-Host "║                                                            ║"
Write-Host "║            ✅ INSTALAÇÃO CONCLUÍDA!                        ║"
Write-Host "║                                                            ║"
Write-Host "╚════════════════════════════════════════════════════════════╝"
Write-Host ""
Write-Host "📝 PRÓXIMOS PASSOS IMPORTANTES:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Acesse o painel do Tailscale: https://login.tailscale.com/admin/machines" -ForegroundColor White
Write-Host ""
Write-Host "2. Encontre este computador na lista (nome: $env:COMPUTERNAME)" -ForegroundColor White
Write-Host ""
Write-Host "3. Clique nos 3 pontinhos → 'Edit route settings'" -ForegroundColor White
Write-Host ""
Write-Host "4. MARQUE A CHECKBOX da rede: $localNetwork" -ForegroundColor Green
Write-Host ""
Write-Host "5. Clique em 'Salvar'" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
Write-Host "⚠️  SEM ESTE PASSO, A VPS NÃO CONSEGUIRÁ ACESSAR O ERP!" -ForegroundColor Red
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

if ($tailscaleIP) {
    Write-Host "📋 INFORMAÇÕES PARA CONFIGURAR NA VPS:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   IP Tailscale do Cliente: $tailscaleIP" -ForegroundColor Green
    Write-Host "   Rede Local: $localNetwork" -ForegroundColor Green
    Write-Host ""
}

Write-Host ""
pause

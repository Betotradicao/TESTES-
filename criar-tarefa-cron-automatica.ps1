# Script para criar tarefa agendada de verificação automática
# Executa a cada 2 minutos - COMPLETAMENTE AUTOMÁTICO - SEM JANELAS

$taskName = "Prevencao-Verificacao-Automatica"
$scriptPath = "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main\packages\backend"
$nodePath = (Get-Command node).Source  # Pega caminho completo do Node

Write-Host "Criando tarefa automática (sem janelas)..." -ForegroundColor Yellow
Write-Host ""

# Remove tarefa se já existir
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Usa XML direto para criar a tarefa (SEM JANELAS VISÍVEIS)
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Verificação automática de vendas da Zanthus - Cruza com bipagens a cada 2 minutos (executa em segundo plano, sem janelas)</Description>
  </RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <Repetition>
        <Interval>PT2M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>$(Get-Date -Format "yyyy-MM-ddTHH:mm:ss")</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$env:USERDOMAIN\$env:USERNAME</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT5M</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$nodePath</Command>
      <Arguments>dist/commands/daily-verification.command.js</Arguments>
      <WorkingDirectory>$scriptPath</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

# Salva XML temporário
$tempXml = "$env:TEMP\prevencao-task.xml"
$xml | Out-File -FilePath $tempXml -Encoding unicode

# Registra tarefa usando XML
schtasks /create /tn "$taskName" /xml "$tempXml" /f

# Remove arquivo temporário
Remove-Item $tempXml -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  TAREFA CRIADA COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Nome da tarefa: $taskName" -ForegroundColor Cyan
Write-Host "Frequência: A cada 2 minutos" -ForegroundColor Cyan
Write-Host "Execução: EM SEGUNDO PLANO (SEM JANELAS)" -ForegroundColor Yellow
Write-Host ""
Write-Host "A tarefa vai rodar AUTOMATICAMENTE em segundo plano!" -ForegroundColor Yellow
Write-Host "NÃO vai abrir janelas pretas!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Para verificar:"
Write-Host "1. Abra o 'Agendador de Tarefas' do Windows"
Write-Host "2. Procure por: $taskName"
Write-Host "3. Veja o histórico de execuções"
Write-Host ""

# Inicia a tarefa imediatamente
Write-Host "Iniciando primeira execução agora..." -ForegroundColor Yellow
schtasks /run /tn "$taskName"

Write-Host ""
Write-Host "Pronto! A tarefa está rodando em segundo plano!" -ForegroundColor Green
Write-Host ""

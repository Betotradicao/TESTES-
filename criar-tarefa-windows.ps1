# Script para criar tarefa agendada do Windows para iniciar o sistema automaticamente
# Execute este script como Administrador

$action = New-ScheduledTaskAction -Execute "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main\INICIAR-TUDO.bat"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

$task = New-ScheduledTask -Action $action -Principal $principal -Trigger $trigger -Settings $settings

Register-ScheduledTask -TaskName "PrevencaoNoRadar_AutoStart" -InputObject $task -Force

Write-Host "✅ Tarefa criada com sucesso!" -ForegroundColor Green
Write-Host "O sistema agora iniciará automaticamente quando o Windows reiniciar." -ForegroundColor Green
Write-Host ""
Write-Host "Para verificar a tarefa:" -ForegroundColor Yellow
Write-Host "  taskschd.msc" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para testar a tarefa:" -ForegroundColor Yellow
Write-Host "  schtasks /run /tn PrevencaoNoRadar_AutoStart" -ForegroundColor Cyan

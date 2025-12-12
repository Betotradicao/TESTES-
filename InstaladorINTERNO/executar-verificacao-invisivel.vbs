' Script VBS para executar verificação de forma COMPLETAMENTE INVISÍVEL
' Não mostra NENHUMA janela - executa em background total

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Caminho do backend
strBackendPath = "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main\packages\backend"

' Comando para executar (node + comando de verificação)
strCommand = "cmd /c cd /d """ & strBackendPath & """ && node dist/commands/daily-verification.command.js"

' Executa o comando INVISÍVEL (0 = janela oculta, False = não espera terminar)
objShell.Run strCommand, 0, False

' Limpa objetos da memória
Set objShell = Nothing
Set objFSO = Nothing

Set WshShell = CreateObject("WScript.Shell")
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")

appDir = "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main"

' Loop infinito para monitorar
Do While True
    ' Verificar se o backend esta rodando
    Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where CommandLine Like '%npm run dev%' And CommandLine Like '%backend%'")
    backendRunning = (colProcesses.Count > 0)

    ' Verificar se o frontend esta rodando
    Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where CommandLine Like '%npm run dev%' And CommandLine Like '%frontend%'")
    frontendRunning = (colProcesses.Count > 0)

    ' Verificar se o scanner esta rodando
    Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where CommandLine Like '%scanner_service.py%'")
    scannerRunning = (colProcesses.Count > 0)

    ' Se algum nao esta rodando, reiniciar todos
    If Not backendRunning Or Not frontendRunning Or Not scannerRunning Then
        ' Limpar processos antigos
        WshShell.Run "wmic process where ""name='node.exe'"" delete", 0, False
        WshShell.Run "wmic process where ""name='python.exe'"" delete", 0, False
        WshShell.Run "wmic process where ""name='pythonw.exe'"" delete", 0, False

        ' Aguardar 3 segundos
        WScript.Sleep 3000

        ' Iniciar Backend
        WshShell.CurrentDirectory = appDir & "\packages\backend"
        WshShell.Run "cmd /c npm run dev", 0, False

        ' Aguardar 5 segundos
        WScript.Sleep 5000

        ' Iniciar Frontend
        WshShell.CurrentDirectory = appDir & "\packages\frontend"
        WshShell.Run "cmd /c npm run dev", 0, False

        ' Aguardar 3 segundos
        WScript.Sleep 3000

        ' Iniciar Scanner Service
        WshShell.CurrentDirectory = "C:\Users\Administrator\Desktop\barcode-service-main\INSTALADOR"
        WshShell.Run "pythonw scanner_service.py", 0, False
    End If

    ' Aguardar 30 segundos antes de verificar novamente
    WScript.Sleep 30000
Loop

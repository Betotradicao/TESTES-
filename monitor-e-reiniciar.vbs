Set WshShell = CreateObject("WScript.Shell")
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main"

' Loop infinito para monitorar
Do While True
    ' Verificar se PostgreSQL esta rodando
    Set objExec = WshShell.Exec("cmd /c sc query postgresql-x64-15")
    strPgOutput = objExec.StdOut.ReadAll()
    postgresRunning = InStr(strPgOutput, "RUNNING") > 0

    If Not postgresRunning Then
        ' Iniciar PostgreSQL
        WshShell.Run "cmd /c sc start postgresql-x64-15", 0, True
        WScript.Sleep 3000
    End If

    ' Verificar se PM2 esta rodando os processos
    Set objExec = WshShell.Exec("cmd /c pm2 jlist")
    strOutput = objExec.StdOut.ReadAll()

    backendRunning = InStr(strOutput, "@market-security/backend") > 0 And InStr(strOutput, """online""") > 0
    frontendRunning = InStr(strOutput, "@market-security/frontend") > 0 And InStr(strOutput, """online""") > 0

    ' Verificar se o scanner esta rodando
    Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where CommandLine Like '%scanner_service.py%'")
    scannerRunning = (colProcesses.Count > 0)

    ' Verificar se MinIO esta rodando
    Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'minio.exe'")
    minioRunning = (colProcesses.Count > 0)

    ' Verificar se Ngrok esta rodando
    Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'ngrok.exe'")
    ngrokRunning = (colProcesses.Count > 0)

    ' Se algum nao esta rodando, reiniciar
    If Not backendRunning Or Not frontendRunning Then
        ' Reiniciar via PM2 (invisivel)
        WshShell.CurrentDirectory = appDir
        WshShell.Run "cmd /c pm2 restart ecosystem.config.js", 0, True
        WScript.Sleep 5000
    End If

    If Not scannerRunning Then
        ' Reiniciar Scanner Service (invisivel)
        If fso.FolderExists("C:\Users\Administrator\Desktop\barcode-service-main\INSTALADOR") Then
            WshShell.CurrentDirectory = "C:\Users\Administrator\Desktop\barcode-service-main\INSTALADOR"
            WshShell.Run "pythonw scanner_service.py", 0, False
            WScript.Sleep 3000
        End If
    End If

    If Not minioRunning Then
        ' Carregar credenciais do .env
        envFile = appDir & "\.env"
        minioUser = "f0a02f9d4320abc34679f4742eecbad1"
        minioPassword = "3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55"

        If fso.FileExists(envFile) Then
            Set objFile = fso.OpenTextFile(envFile, 1)
            Do Until objFile.AtEndOfStream
                line = objFile.ReadLine
                If InStr(line, "MINIO_ROOT_USER=") = 1 Then
                    minioUser = Mid(line, Len("MINIO_ROOT_USER=") + 1)
                ElseIf InStr(line, "MINIO_ROOT_PASSWORD=") = 1 Then
                    minioPassword = Mid(line, Len("MINIO_ROOT_PASSWORD=") + 1)
                End If
            Loop
            objFile.Close
        End If

        ' Reiniciar MinIO (invisivel)
        WshShell.CurrentDirectory = appDir
        WshShell.Run "cmd /c set MINIO_ROOT_USER=" & minioUser & "&& set MINIO_ROOT_PASSWORD=" & minioPassword & "&& minio.exe server minio-data --console-address :9011 --address :9010", 0, False
        WScript.Sleep 5000
    End If

    If Not ngrokRunning Then
        ' Reiniciar Ngrok (invisivel)
        WshShell.CurrentDirectory = appDir
        WshShell.Run appDir & "\ngrok.exe start --all --config """ & appDir & "\ngrok.yml""", 0, False
        WScript.Sleep 3000
    End If

    ' Aguardar 30 segundos antes de verificar novamente
    WScript.Sleep 30000
Loop

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Diretorio da aplicacao
appDir = "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main"

' Carregar credenciais do arquivo .env se existir
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

' 1. Iniciar PostgreSQL local (se nao estiver rodando)
WshShell.Run "cmd /c sc start postgresql-x64-15", 0, True
WScript.Sleep 3000

' 2. Parar todos os processos node antigos
WshShell.Run "cmd /c taskkill /F /IM node.exe /FI ""WINDOWTITLE ne N/A""", 0, True
WshShell.Run "cmd /c taskkill /F /IM nodemon.exe", 0, True

' 3. Parar processos PM2 antigos do Market Security
WshShell.Run "cmd /c pm2 delete @market-security/backend", 0, True
WshShell.Run "cmd /c pm2 delete @market-security/frontend", 0, True

' 4. Matar processos MinIO antigos
WshShell.Run "cmd /c taskkill /F /IM minio.exe", 0, True

' Aguardar 3 segundos
WScript.Sleep 3000

' 5. Iniciar MinIO de forma invisivel (usando variáveis de ambiente do Windows)
Set envVars = WshShell.Environment("Process")
envVars("MINIO_ROOT_USER") = minioUser
envVars("MINIO_ROOT_PASSWORD") = minioPassword

WshShell.CurrentDirectory = appDir
WshShell.Run appDir & "\minio.exe server " & appDir & "\minio-data --console-address :9011 --address :9010", 0, False

' Aguardar 5 segundos para MinIO iniciar
WScript.Sleep 5000

' 6. Iniciar Backend e Frontend via PM2 (invisivel)
WshShell.CurrentDirectory = appDir
WshShell.Run "cmd /c pm2 start ecosystem.config.js", 0, True

' Aguardar 8 segundos para backend/frontend iniciarem
WScript.Sleep 8000

' 7. Salvar configuracao PM2 para auto-start
WshShell.Run "cmd /c pm2 save", 0, True

' 8. Iniciar Scanner Service (invisivel com pythonw)
If fso.FolderExists("C:\Users\Administrator\Desktop\barcode-service-main\INSTALADOR") Then
    WshShell.CurrentDirectory = "C:\Users\Administrator\Desktop\barcode-service-main\INSTALADOR"
    WshShell.Run "pythonw scanner_service.py", 0, False
End If

Set fso = Nothing
Set WshShell = Nothing

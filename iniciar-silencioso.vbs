Set WshShell = CreateObject("WScript.Shell")

' Diretorio da aplicacao
appDir = "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main"

' Limpar processos antigos
WshShell.Run "wmic process where ""name='node.exe'"" delete", 0, False
WshShell.Run "wmic process where ""name='python.exe'"" delete", 0, False
WshShell.Run "wmic process where ""name='pythonw.exe'"" delete", 0, False
WshShell.Run "wmic process where ""name='minio.exe'"" delete", 0, False

' Aguardar 3 segundos
WScript.Sleep 3000

' Iniciar MinIO
WshShell.CurrentDirectory = appDir
WshShell.Run "cmd /c set MINIO_ROOT_USER=f0a02f9d4320abc34679f4742eecbad1&& set MINIO_ROOT_PASSWORD=3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55&& minio.exe server minio-data --console-address :9001 --address :9000", 0, False

' Aguardar 5 segundos para MinIO iniciar
WScript.Sleep 5000

' Iniciar Backend
WshShell.CurrentDirectory = appDir & "\packages\backend"
WshShell.Run "cmd /c npm run dev", 0, False

' Aguardar 5 segundos para backend iniciar
WScript.Sleep 5000

' Iniciar Frontend
WshShell.CurrentDirectory = appDir & "\packages\frontend"
WshShell.Run "cmd /c npm run dev", 0, False

' Aguardar 3 segundos
WScript.Sleep 3000

' Iniciar Scanner Service
WshShell.CurrentDirectory = "C:\Users\Administrator\Desktop\barcode-service-main\INSTALADOR"
WshShell.Run "pythonw scanner_service.py", 0, False

Set WshShell = Nothing

@echo off
echo ========================================
echo 🧹 LIMPANDO E REINICIANDO SISTEMA
echo ========================================
echo.

echo 1️⃣  Matando processos Node.js...
wmic process where "name='node.exe'" delete 2>nul
timeout /t 2 /nobreak >nul
echo    ✅ Processos mortos!
echo.

echo 2️⃣  Limpando cache do TypeScript...
cd packages\backend
rd /s /q .ts-node 2>nul
rd /s /q node_modules\.cache 2>nul
cd ..\..
echo    ✅ Cache limpo!
echo.

echo 3️⃣  Iniciando Backend (porta 3001)...
start "Backend" cmd /c "cd packages\backend && npm run dev"
timeout /t 3 /nobreak >nul
echo    ✅ Backend iniciando...
echo.

echo 4️⃣  Iniciando Frontend (porta 3004)...
start "Frontend" cmd /c "cd packages\frontend && npm run dev"
echo    ✅ Frontend iniciando...
echo.

echo ========================================
echo ✅ SISTEMA INICIADO COM SUCESSO!
echo ========================================
echo.
echo 🌐 Frontend: http://localhost:3004
echo 🔧 Backend:  http://localhost:3001
echo 📚 Swagger:  http://localhost:3001/api-docs
echo.
echo Pressione qualquer tecla para fechar...
pause >nul

@echo off
echo 🧹 Limpando cache do TypeScript...
rd /s /q .ts-node 2>nul
rd /s /q node_modules\.cache 2>nul
echo ✅ Cache limpo!
echo.
echo 🚀 Iniciando backend...
npm run dev

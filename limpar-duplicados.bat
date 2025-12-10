@echo off
echo ========================================
echo   LIMPANDO DADOS DUPLICADOS
echo ========================================
echo.
echo ATENCAO: Este script vai apagar TODAS as bipagens,
echo sessoes de equipamentos e equipamentos do banco!
echo.
echo Pressione CTRL+C para cancelar ou
pause
echo.

echo Executando limpeza do banco de dados...
echo.

docker exec -i market-security-db psql -U admin -d market_security << EOF
-- Limpar todas as bipagens
TRUNCATE TABLE bips CASCADE;

-- Limpar sessões de equipamentos
TRUNCATE TABLE equipment_sessions CASCADE;

-- Limpar equipamentos
DELETE FROM equipments WHERE id > 0;

-- Resetar sequências
ALTER SEQUENCE bips_id_seq RESTART WITH 1;
ALTER SEQUENCE equipment_sessions_id_seq RESTART WITH 1;
ALTER SEQUENCE equipments_id_seq RESTART WITH 1;

-- Confirmar
SELECT 'Banco de dados limpo com sucesso!' as status;
EOF

echo.
echo ========================================
echo   LIMPEZA CONCLUIDA!
echo ========================================
echo.
echo Agora execute: parar.bat
echo Depois execute: iniciar.bat
echo.
pause

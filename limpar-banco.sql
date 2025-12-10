-- Script para limpar dados duplicados e resetar o banco

-- Limpar todas as bipagens
TRUNCATE TABLE bips CASCADE;

-- Limpar sessões de equipamentos
TRUNCATE TABLE equipment_sessions CASCADE;

-- Limpar equipamentos (mas manter a estrutura)
DELETE FROM equipments WHERE id > 0;

-- Resetar sequências
ALTER SEQUENCE bips_id_seq RESTART WITH 1;
ALTER SEQUENCE equipment_sessions_id_seq RESTART WITH 1;
ALTER SEQUENCE equipments_id_seq RESTART WITH 1;

-- Mensagem de confirmação
SELECT 'Banco de dados limpo com sucesso!' as status;

-- Script para limpar todos os equipamentos e resetar a sequência
-- Execute este script para começar do zero com os scanners

-- 1. Apagar todas as sessões de equipamentos (relacionamento)
DELETE FROM equipment_sessions;

-- 2. Atualizar bipagens para remover referência aos equipamentos
UPDATE bips SET equipment_id = NULL WHERE equipment_id IS NOT NULL;

-- 3. Apagar todos os equipamentos
DELETE FROM equipments;

-- 4. Resetar a sequência para começar do ID 1
ALTER SEQUENCE equipments_id_seq RESTART WITH 1;

-- Verificar se limpou tudo
SELECT COUNT(*) as total_equipments FROM equipments;
SELECT COUNT(*) as total_sessions FROM equipment_sessions;

-- Mensagem de sucesso
SELECT 'Equipamentos limpos com sucesso! Próximo ID será 1' as status;

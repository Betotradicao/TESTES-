-- Script de teste para inserir 3 exemplos de validação IA
-- Execute após rodar as migrations normais

-- Exemplo 1: POUCO SUSPEITO (🟢 Verde 95%)
-- Alcatra escaneada corretamente, posição e cor OK
INSERT INTO bips (
  ean,
  event_date,
  bip_price_cents,
  product_id,
  product_description,
  product_full_price_cents_kg,
  product_discount_price_cents_kg,
  bip_weight,
  status,
  validacao_codigo,
  validacao_status,
  validacao_foto,
  validacao_detalhes
) VALUES (
  '7891234567890',
  NOW() - INTERVAL '5 minutes',
  4580,
  '03704',
  'ALCATRA BOVINA KG',
  4580,
  NULL,
  1.000,
  'pending',
  95.00,
  'OK',
  '/uploads/validacoes/alcatra_ok.jpg',
  '{
    "posicao": 98,
    "cor": 94,
    "tamanho": 93,
    "produto_esperado": "ALCATRA BOVINA KG"
  }'::jsonb
);

-- Exemplo 2: SUSPEITO (🟡 Amarelo 72%)
-- Picanha escaneada mas está em posição suspeita
INSERT INTO bips (
  ean,
  event_date,
  bip_price_cents,
  product_id,
  product_description,
  product_full_price_cents_kg,
  product_discount_price_cents_kg,
  bip_weight,
  status,
  validacao_codigo,
  validacao_status,
  validacao_foto,
  validacao_detalhes
) VALUES (
  '7891234567891',
  NOW() - INTERVAL '3 minutes',
  7890,
  '03710',
  'PICANHA BOVINA KG',
  7890,
  NULL,
  0.850,
  'pending',
  72.00,
  'SUSPEITO',
  '/uploads/validacoes/picanha_suspeito.jpg',
  '{
    "posicao": 58,
    "cor": 85,
    "tamanho": 73,
    "produto_esperado": "PICANHA BOVINA KG"
  }'::jsonb
);

-- Exemplo 3: MUITO SUSPEITO (🔴 Vermelho 45%)
-- Frango escaneado mas produto parece ser carne vermelha
INSERT INTO bips (
  ean,
  event_date,
  bip_price_cents,
  product_id,
  product_description,
  product_full_price_cents_kg,
  product_discount_price_cents_kg,
  bip_weight,
  status,
  validacao_codigo,
  validacao_status,
  validacao_foto,
  validacao_detalhes
) VALUES (
  '7891234567892',
  NOW() - INTERVAL '1 minute',
  2180,
  '04501',
  'PEITO FRANGO KG',
  2180,
  NULL,
  1.200,
  'pending',
  45.00,
  'MUITO_SUSPEITO',
  '/uploads/validacoes/frango_muito_suspeito.jpg',
  '{
    "posicao": 42,
    "cor": 38,
    "tamanho": 55,
    "produto_esperado": "PEITO FRANGO KG"
  }'::jsonb
);

-- Mensagem de confirmação
SELECT 'Dados de teste inseridos com sucesso!' as status,
       COUNT(*) as total_bipagens_com_validacao
FROM bips
WHERE validacao_codigo IS NOT NULL;

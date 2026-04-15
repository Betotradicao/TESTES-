# Feature: Vision Palavra-Chave v2 (substituindo v1)

**Data:** 2026-03
**Módulo:** [[../modulos/vision-palavra-chave|Vision Palavra-Chave]]

## 🎯 O que mudou
Versão nova (`VisionPalavraChave2.jsx`) **substituiu** a versão antiga.

### Recursos novos v2:
- **Finalizadoras reais** (não hardcoded)
- **Operador** (via `TAB_CUPOM_FINALIZADORA`, mesmo método da tela de Risco)
- **Barcode** exibido nas linhas
- **Cancelamentos** separados (item, cupom, venda)
- **Vídeo DVR** por PDV (busca contextual)

## 📝 Commits chave
- `13bed57` — Vision Palavra Chave 2 - busca Oracle com vídeo DVR por PDV
- `d043fdf` — finalizadoras reais, operador, barcode, cancelamentos
- `4b2a69d` — campos e tabelas faltantes no TABLE_CATALOG
- `3364d93` — migrar 7 services para MappingService (zero hardcode)
- `28994d4` — renomear Vision Palavra Chave 2 para Vision Palavra Chave (versão final)
- `9770c69` — remover submenu antigo do Sidebar

## ⚠️ Lições
- Operador via `TAB_CUPOM_FINALIZADORA` é mais confiável que via `TAB_PRODUTO_PDV`
- Sempre usar MappingService; zero hardcode (ver [[../arquitetura/mapeamento-tabelas|Mapeamento de Tabelas]])

## 🏷️ Tags
#feature #vision #mapeamento #2026-03

# Feature: White-Label — personalização de logo e nome

**Data:** 2026-03 (commit `c271488`)
**Impacto:** Todos os clientes

## 🎯 O que mudou
Sidebar agora suporta personalização por cliente:
- **Logo customizado** (upload por cliente)
- **Nome da empresa** configurável
- Substitui o logo/nome "Radar 360" genérico

## 🎨 Onde muda a UI
- Sidebar (logo e nome no topo)
- Tela de Login (logo principal)
- Cabeçalhos

## ⚙️ Configuração
Via `configurations` table — chaves:
- `company_logo_url`
- `company_name`

## 🏷️ Tags
#feature #white-label #ui #branding #2026-03

# Fix: Salvar bipagem mesmo quando Oracle offline

**Data:** 2026-03 (commits `cc44ba9`, `7b17e2c`)
**Módulo:** [[../modulos/bipagens|Bipagens]]

## 🐛 Problema
Quando ERP Oracle estava offline, bipagens eram **perdidas** porque o backend tentava buscar o produto antes de salvar.

## ✅ Fix
Agora a bipagem é salva **sempre**, mesmo se o produto não for encontrado no Oracle. Informação de produto é preenchida depois (quando Oracle voltar) via job de reconciliação.

## 📝 Lições
- Em fluxos críticos (captura de dados em tempo real), **NUNCA** bloquear salvamento por dependência externa
- Usar padrão "escrever primeiro, enriquecer depois"
- Gestão de indisponibilidade de ERP é requisito, não exceção

## 🏷️ Tags
#fix #bipagens #resiliencia #oracle #2026-03

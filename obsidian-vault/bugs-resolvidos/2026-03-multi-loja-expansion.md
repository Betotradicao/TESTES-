# Feature: Expansão Multi-Loja (dezenas de telas)

**Data:** 2026-03
**Impacto:** Todos os clientes multi-loja ([[../clientes/supervital|SuperVital]] e futuros)

## 🎯 O que mudou
Propagação do conceito "multi-loja" para telas que só suportavam loja única.

### Telas atualizadas
- **Bipagens** — multi-loja (`06d1b17`)
- **Resultados do Dia** — filtro multi-loja (`92474c7`)
- **Ativar Produtos** — filtra por loja, "TODAS" sem filtro (`27cec0c`)
- **Configurações** — todas as telas (`65239a3`)
- **Prevenção Tributária** — `lojaSelecionada` (`7a70b31`)
- **Prioridade Reposição** — TODAS soma lojas, codLoja opcional (`1e36e86`)
- **Entradas e Saídas** — recarrega ao mudar loja (`ff63088`)
- **Demonstrativo de Caixa** — filtro loja (`b1e66b2`)
- **Pedidos de Compra** — filtro COD_LOJA (`f24e9cb`, `58817f7`)
- **Compra e Venda** — filtro COD_LOJA, Inativa Seção, ordenação (`6455f35`)

## ⚠️ Padrão "TODAS"
Quando o usuário seleciona "TODAS", o filtro `codLoja` é **omitido** do backend (não é enviado como 0 ou "all"). Cada endpoint precisa ignorar `codLoja` quando vier undefined.

## 🐛 Cuidados
- `codLoja` pode chegar como `'0'` (string) → comparar com `!== undefined && !== ''`
- `useEffect` precisa ter `lojaSelecionada` na dependência pra recarregar

## 🏷️ Tags
#feature #multi-loja #expansion #2026-03

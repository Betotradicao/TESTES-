# Rupturas

Controla produtos em ruptura (falta de estoque), verificações de gôndola e auditorias.

## 📂 Arquivos
- `RupturaResultados.jsx` — listagem de rupturas identificadas
- `RupturaLancadorItens.jsx` — lançar itens em ruptura manualmente
- `RupturaVerificacao.jsx` — verificação no dia
- `RupturaResultadosAuditorias.jsx` — resultados por auditoria
- `RupturaIndustria.jsx` — ruptura na indústria/fornecedor

## 🔗 Tabelas ERP
- TAB_PRODUTO, TAB_RUPTURA, TAB_FORNECEDOR

## 🎯 Fluxo
1. Operador faz "verificação" passando pelas gôndolas
2. Sistema registra itens em ruptura
3. Gera auditoria e aponta responsáveis
4. Módulo **Ruptura Indústria** rastreia culpa do fornecedor

## 📊 Relatório final: PDF **e** Excel no WhatsApp (20/08/2026)

Ao finalizar a auditoria, o grupo recebe **dois anexos**: o PDF (ler no celular) e um
`.xlsx` (filtrar, ordenar, somar). O PDF sozinho não deixava trabalhar os números —
que é o que se faz com uma auditoria de ruptura.

- Gerador reutilizável: `services/report-excel.service.ts` — recebe colunas/linhas e
  devolve **Buffer** (não escreve em disco; o PDF usa `/uploads/temp` e já sobrou lixo lá).
- `exceljs` **já estava** no `package.json`. Não precisou instalar nada.
- A planilha traz as **13 colunas do PDF + STATUS**. O STATUS existe porque o PDF separa
  em duas tabelas (Não Encontrado / Em Estoque) e numa planilha única isso se perderia.
- **Textos não truncados** de propósito: o PDF corta descrição em 35 e fornecedor em 10
  caracteres por falta de espaço; truncar na planilha quebraria PROCV e filtro.
- Cabeçalho congelado, autofiltro e linha de **TOTAL** somando P.VENDA e P.LUCRO.

> ⚠️ **`mimetype` é obrigatório pro .xlsx.** A Evolution nunca recebia esse campo — pro PDF
> ela acerta no chute, pro xlsx não: o anexo chega genérico e o celular não oferece
> "abrir no Excel". `sendDocumentBuffer` passou a aceitar mimetype.

> 🛡️ **Planilha nunca derruba a auditoria:** se a geração ou o envio do xlsx falhar, o PDF
> segue sozinho e a finalização retorna sucesso. Anexo extra não pode virar bloqueio.

📌 Existem **7 relatórios** no mesmo formato (perdas, ruptura, produção, abastecimento,
prazo fornecedores, cortes, atrasos). Só **ruptura** foi feito — decisão do Roberto em
20/08. Os outros são baratos de ligar: reusar `ReportExcelService.gerar`.

## 🔗 Grupo de Similares (22/08/2026)

Produtos com o mesmo número em **Configurar Peculiaridades** são substitutos.
Se **qualquer um** do grupo tem estoque, nenhum deles entra na pesquisa de ruptura.

`services/grupo-similar.service.ts` · configurado em `products.grupo_similar`.

> ⚠️ A tela existia desde 04/2026 mas **a regra nunca tinha sido implementada** —
> e a gravação também estava quebrada. Ver
> [[../bugs-resolvidos/2026-08-22-grupo-similar-nunca-funcionou]].

> 🔑 O serviço consulta o estoque do **grupo inteiro** no Oracle, não só dos itens
> candidatos: o produto com estoque não está na lista de ruptura, justamente por
> ter estoque.

## 🏷️ Tags
#modulo #prevencao #rupturas

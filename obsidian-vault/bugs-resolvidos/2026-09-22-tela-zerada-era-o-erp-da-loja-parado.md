# 🔍 Tela zerada não é bug do Radar até você perguntar ao Oracle qual foi a última venda

**Data:** 2026-09-22 · **Cliente:** [[../clientes/supervital|SuperVital]] (vale para todos) · **Módulos:** [[../modulos/gestao-inteligente|Gestão Inteligente]], Sells Sync

## 🔥 A lição principal

Quando a tela zera, o instinto é caçar bug no Radar. **Uma consulta de 10 segundos no Oracle
do cliente decide de que lado está o problema** — e evita horas caçando defeito onde não tem.

```
SELECT MAX(DTA_SAIDA) FROM INTERSOLID.TAB_PRODUTO_PDV
```

- Devolveu **hoje** → o dado existe, o defeito é **nosso** (query, filtro, mapeamento, sync)
- Devolveu **dias atrás** → o **ERP da loja parou de gravar venda**. Nada no Radar conserta

Script pronto: **`scripts/ultima-venda-oracle.js`** (roda dentro do container, só SELECT).
Ele traz junto o **`SYSDATE` do Oracle da loja** e a **contagem por dia/loja dos últimos 7 dias**.

## 🕵️ O caso que originou

Sintoma: Gestão Inteligente com **tudo R$ 0,00** no dia, mas os comparativos
(Mês Passado / Ano Passado) preenchidos e corretos. Log do backend limpo, sem erro:

```
[SellsSync] Iniciando sync para 2026-09-22...
[SellsSync] Nenhuma venda encontrada no Oracle
[SellsSync] Sync concluído em 0s
```

> ⚠️ **"Nenhuma venda encontrada no Oracle" é uma resposta, não um erro.** O sync fez o
> trabalho dele. Sem cruzar com o ERP, essa linha parece falha do Radar — e não é.

O que a consulta mostrou:

```
RELOGIO DO ORACLE DA LOJA: 22/09/2026 10:03:38     ← Oracle de pé, hora certa
ULTIMA DATA DE VENDA:      20/09/2026              ← domingo

20/09  loja 1 -> 3940 itens | loja 2 -> 2436
19/09  loja 1 -> 6045 itens | loja 2 -> 3065
18/09  loja 1 -> 4328 itens | loja 2 -> 2611
(21/09 e 22/09: ZERO nas duas lojas)
```

**Duas lojas, dois dias úteis inteiros, zero.** Isso não é atraso de carga — é **parada**.
O Oracle está vivo e respondendo; o que parou foi a **gravação de venda do PDV na
retaguarda Intersolid**, dentro da loja.

## 🧭 Como interpretar o resultado

| O que a consulta mostra | Leitura |
|---|---|
| `SYSDATE` responde | o Oracle **está de pé** — não é queda de banco |
| Última venda = hoje | dado existe → **defeito nosso** |
| Última venda = dias atrás, **todas as lojas** | **integração PDV → retaguarda parada** |
| Última venda = dias atrás, **uma loja só** | problema **daquela** loja (link/servidor/PDV) |
| Um dia inteiro falta no meio | conferir se a loja abriu (feriado/domingo) antes de gritar |

⚠️ **Sempre quebrar por loja** em cliente multi-loja. "Zerou tudo" e "zerou a loja 2" têm
causas diferentes e destinos diferentes.

## ⏱️ Não confundir com o outro bug do mesmo dia

Na véspera o mesmo cliente estava zerado por
[[2026-09-21-teste-falho-desliga-a-integracao-inteira|`status` travado da conexão]]. São
distinguíveis pelo log, sem adivinhação:

| Log | Causa |
|---|---|
| `ORA-12170` | link do cliente fora |
| `ORA-00904 invalid identifier` | link voltou, `status` travado |
| **`Nenhuma venda encontrada no Oracle`** (sem erro) | **conexão OK — o ERP da loja é que não tem o dado** |

**A ordem certa é essa:** primeiro confirmar que a conexão está sã (sem ORA-*), **só então**
perguntar ao Oracle pela última venda. Invertido, você culpa o ERP de um problema nosso.

## ➡️ O que pedir para a loja

Não adianta pedir "reinicia o sistema". O pedido específico:

> *"A venda dos PDVs não está subindo para a retaguarda Intersolid desde domingo (20/09).
> O Oracle está no ar. Verificar o serviço de integração/carga do PDV para a retaguarda."*

## 🔗 Relacionados
- [[2026-09-21-teste-falho-desliga-a-integracao-inteira|Teste falho desliga a integração]]
- [[../padroes/regras-ssh-windows|Consulta avulsa no Oracle: mande um ARQUIVO]]
- [[../clientes/supervital|SuperVital]]

## 🏷️ Tags
#diagnostico #oracle #erp #supervital #gestao-inteligente #sells-sync

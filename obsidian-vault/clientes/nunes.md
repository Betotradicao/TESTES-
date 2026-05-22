# Nunes

Cliente com **ERP diferente dos demais** — usa **RP INFO com PostgreSQL** (não Oracle Intersolid).

## ⚠️ ATENÇÃO ESPECIAL
**Nunes NÃO é Oracle.** Tem código bifurcado em várias partes do backend pra suportar Postgres. Antes de alterar query, verificar se existe versão `*PostgresErp` do método.

## 🔌 ERP
- **Banco:** PostgreSQL 17.5 (não Oracle)
- **Sistema ERP:** RP INFO
- **Conexão (2026-05-22):** Direta via DDNS do MikroTik — **sem túnel SSH**
  - **Host Nuvem (VPS/Docker):** `hea08skfqwk.sn.mynetname.net:10835`
  - **Host Local (rede interna):** `192.168.102.10:10835`
  - O sistema usa Host Local em dev, Host Nuvem rodando na VPS via Docker
- **Database:** `erp`
- **Usuário:** `bi`
- **Senha:** `Nunes@2026` (atualizada 2026-05-22)
- **Tabelas principais:**
  - `vdonlineprod` — vendas tempo real (~últimos 13 dias)
  - `vdadet{MMYY}` — venda detalhada histórica (particionada por mês, ex: `vdadet0426`)
  - `movprodd{MMYY}` — movimento produtos (Venda Flex EVD) particionada por mês
  - `movfpdvc` — movimento financeiro PDV cupom

## 🏗️ Bifurcação no código
Backend tem padrão:
```typescript
const dbType = await this.detectActiveDbType();
if (dbType === 'postgresql') {
  return this.buscarXPostgresErp(...);
}
// ... código Oracle padrão
```

Métodos já bifurcados (exemplos):
- `buscarVendasPorSetorPeriodoPostgresErp`
- `buscarIndicadoresPeriodoPostgresErp`
- `BipWebhookService.fetchProductFromERP` (2026-05-12) — chama `fetchProductFromOracle` ou `fetchProductFromPostgres` conforme `getActiveErpType()`. Era hardcoded Oracle, quebrava bipagens do Nunes com `[NÃO ENCONTRADO]` infinito + log poluído de `ORA-12170`.

## 🔑 Regra de ouro

**Tudo que toca o ERP do Nunes (PostgreSQL) DEVE ser bifurcado.**
- Bifurcar localmente no método que faz a query, **não** trocar tudo pra Postgres.
- Os 4 clientes Oracle (Tradição, SuperVital, MaxValle, Idealmix) DEVEM continuar usando o caminho Oracle, intocado.
- O caminho Postgres é caminho NOVO ao lado, selecionado por `getActiveErpType()` (`is_default` + `status='active'` na `database_connections`).
- **Nunca** colocar fallback cruzado (ex: "se Oracle falhar tenta Postgres") — vai mascarar erros reais.

Ver feature completa: [[../bugs-resolvidos/2026-04-bifurcacao-postgresql-nunes|Bifurcação PostgreSQL para Nunes]]

## ⚠️ Cuidados ao implementar
- Ao adicionar query nova que lê dados do ERP, criar **as duas versões** (Oracle + Postgres)
- Média linear (histórico do ano anterior) pode não existir no Nunes — variável `skipML`
- Filtros de TIPO_SAIDA podem ter códigos diferentes em cada ERP
- `vdonlineprod` só tem ~13 dias — pra períodos anteriores usar `vdadet{MMYY}`
- Custo PG ✅ correto = `mprd_ctmedio + mprd_ctvenda` em `movprodd{MMYY}` com filtro `dcto_tipo='EVP'`. Detalhes na seção "Fórmula de Custo" abaixo + [[../bugs-resolvidos/2026-05-22-custo-nunes-formula-correta]]

## 🏷️ Cadastro de Produtos (`produtos`)
Tabela principal: `public.produtos` (campos prefixados `prod_`).
- `prod_codigo` — numeric(8,0). **Códigos MISTOS de 5 e 6 dígitos** (22.3k de 5 dígitos + 32.5k de 6 dígitos). Não há padrão único.
- `prod_codbarras` — varchar(13). EAN.
- `prod_descricao` — nome.
- `prod_balanca` — **convenção do RP INFO usa 3 valores, NÃO o 'S' do Oracle Intersolid:**
  - `'P'` = Pesável (~919 produtos) — vendido por peso
  - `'U'` = Unidade (~262 produtos) — vendido por unidade na balança
  - `'N'` = Não é balança (~53.9k)
- Outras: `prod_grup_codigo/nome`, `prod_dpto_codigo`, `prod_marca`, `prod_peso`, `prod_dataalt`.

⚠️ Qualquer query/filtro de "produto de balança" no Nunes precisa usar `prod_balanca IN ('P','U')`, não `= 'S'`.

## 🔢 EAN de balança (formato brasileiro)
Bipagem de produto de balança vem como EAN-13 começando com `2`:
- Formato: `2 + PLU(6) + valor(5) + DV(1)`
- Exemplo: `2400750000066` → PLU=`400750`, valor=`00006` (R$ 0,06), DV=`6`
- Sistema bipagens precisa decompor o EAN e buscar o PLU em `produtos.prod_codigo` filtrando `prod_balanca IN ('P','U')`. Se cair em produto com `prod_balanca='N'`, é EAN bipado incorretamente (não era balança).

## 💰 Fórmula de Custo (✅ validada 99,85% em 2026-05-22)

**Bater 100% com o app oficial do RP INFO** (fonte da verdade do Roberto):

```sql
SELECT SUM(mprd_ctmedio + mprd_ctvenda) AS custo_real
FROM movprodd{MMYY}                         -- particionada (ex: movprodd0526 = maio/26)
WHERE mprd_datamvto::date = :data
  AND mprd_unid_codigo::int = :cod_loja
  AND mprd_dcto_tipo = 'EVP';               -- ⚠️ OBRIGATÓRIO (Estoque Venda PDV)
```

**Por que `movprodd` e não `vdonlineprod`:**
- `vdonlineprod` tem venda + custo de entrada cru (sem PIS/Cofins apurados)
- `movprodd{MMYY}` é movimento contábil completo: `ctmedio` (custo médio puro) + `ctvenda` (ICMS+PIS+Cofins consolidado)

**`mprd_dcto_tipo='EVP'` é essencial** — sem isso pega entradas de fornecedor (EAQ), transferências, devoluções, etc. → custo inflado absurdamente.

**Diff residual:** ~0,15% (R$ 19,86 em R$ 12.829 — caso 21/05/2026 Loja 1). Origem provável: apuração mensal de crédito PIS/Cofins. Aceitável pra dashboard gerencial.

⚠️ **Particionamento por mês**: a tabela muda nome todo mês (`movprodd0526`, `movprodd0626`, ...). Em queries que abrangem mais de um mês precisa de UNION ALL ou montar nome dinâmico.

Investigação completa: [[../bugs-resolvidos/2026-05-22-custo-nunes-formula-correta]]
Fórmula antiga errada (~1,5% off): `vopr_custoentrada * qtde + vopr_icmsvalor` em `vdonlineprod` — substituir.

## 🧾 Como o RP INFO marca cancelamentos (crítico pra Vision)

| Conceito | Como está no RP INFO | Coluna chave |
|---|---|---|
| **Canc. Item / Canc. Venda** | Linha em `vdonlineprod` com valor negativo | `vopr_valor < 0` |
| **Canc. Cupom** | Cupom em `vdonlinec` com referência a outro | `vopc_cupomref IS NOT NULL AND != ''` |
| **Total cancelamentos do turno** (agregado) | `movfpdvc.mpdc_cancelamentos` (por PDV/turno) | - |
| **Desconto** | `vdonlineprod.vopr_desconto > 0` | - |

**NÃO funciona no RP INFO:**
- `vopr_cancmotivo` / `vopc_cancmotivo` — estas colunas **nunca são preenchidas**
- `vopr_tiporeg` — só existe `'IT'`, não tem tipo pra cancelamento

Ver fix completo em [[../bugs-resolvidos/2026-04-16-nunes-vision-canc-desconto|Vision filtros CANC/Desconto do Nunes]].

## 💵 Cédula entregue pelo cliente (Dinheiro)

**Funciona no Nunes** (RP INFO) — diferente dos clientes Intersolid.

| Coluna em `public.vdonlinefi` | Significado |
|---|---|
| `vofi_valor` | Cédula bruta entregue pelo cliente |
| `vofi_troco` | Troco devolvido |
| `vofi_valor - vofi_troco` | Valor líquido da compra |

Exposto na coluna "Cédula" do Vision Palavra-Chave (verde). Útil para rastreamento forense (notas falsas, diferenças de caixa).

**Intersolid (Tradição, SuperVital, MaxValle) NÃO captura essa info** — confirmado em 1.34M transações: `VAL_TROCO=0` sempre, `VAL_RECEBIDO=VAL_LIQUIDO` sempre. Coluna mostra "-" pra esses clientes.

## 🎥 DVR / Câmeras (FUNCIONANDO ✅)

### Rede e portas
- **DVR local:** `192.168.102.169` — modelo **iMHDX 3132** (Dahua/Intelbras)
- **Codec nativo:** **H.265 (HEVC)** — converte para H.264 via FFmpeg (ver [[../modulos/dvr-cameras|DVR e Câmeras]])
- **Portas VPS do túnel SSH** (mantido — só o ERP migrou pra DDNS):
  - HTTP: `38100`
  - RTSP: `38101`
- **Host no sistema:** `host.docker.internal` (nunca o IP local do DVR)

### Particularidades do Nunes
- **Hora do RP INFO vem SEM `:`** (ex: `063825`) → sistema converte pra `06:38:25` antes de montar URL RTSP (senão dá "Data NaN")
- **H.265 → H.264** obrigatório (browsers não suportam HEVC). Delay de ~5-10s no primeiro carregamento de vídeo
- **Túnel em pasta separada:** `C:\ProgramData\SSHTunnels-NunesDVR\` no Windows da loja
- **Serviço Windows:** `SSH-Tunnel-NunesDVR`

### Fluxo de exibição (resumo)
1. Frontend pede vídeo para o PDV X no horário Y
2. Backend monta URL RTSP: `rtsp://admin:{pass}@host.docker.internal:38101/cam/playback?channel={ch}&starttime={t}&endtime={t+N}`
3. FFmpeg abre o RTSP via TCP, transcodifica H.265→H.264 com `libx264 -preset ultrafast -crf 28`
4. MP4 fragmentado é enviado como pipe HTTP ao browser
5. `<video>` reproduz via MSE

Ver fluxo técnico completo em [[../modulos/dvr-cameras|DVR e Câmeras]].

## 🏷️ Tags
#cliente #postgres #rp-info #bifurcacao-especial #dvr #h265

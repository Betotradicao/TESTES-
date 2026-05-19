# Nunes

Cliente com **ERP diferente dos demais** — usa **RP INFO com PostgreSQL** (não Oracle Intersolid).

## ⚠️ ATENÇÃO ESPECIAL
**Nunes NÃO é Oracle.** Tem código bifurcado em várias partes do backend pra suportar Postgres. Antes de alterar query, verificar se existe versão `*PostgresErp` do método.

## 🔌 ERP
- **Banco:** PostgreSQL (não Oracle)
- **Sistema ERP:** RP INFO
- **Host ERP:** `192.168.102.10:10835` (via túnel — no container usar `172.20.0.1:10835`)
- **Database:** `erp`
- **Usuário:** `bi`
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
- Custo PG = `vopr_custoentrada * qtde + vopr_icmsvalor` (fórmula atual em [[gestao-inteligente.service.ts]])

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

## 💰 Fórmula de Custo (aproximação atual)
Fórmula nossa bate dentro de ~1,5% do "custo" que o app do RP INFO mostra. Diferença vem de impostos adicionais (PIS/COFINS com crédito, ICMS desonerado, apurações mensais) que nosso sistema não reproduz. É **aproximação gerencial**, não apuração fiscal.

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

## 🎥 DVR / Câmeras (FUNCIONANDO ✅)

### Rede e portas
- **DVR local:** `192.168.102.169` — modelo **iMHDX 3132** (Dahua/Intelbras)
- **Codec nativo:** **H.265 (HEVC)** — converte para H.264 via FFmpeg (ver [[../modulos/dvr-cameras|DVR e Câmeras]])
- **Portas VPS do túnel:**
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

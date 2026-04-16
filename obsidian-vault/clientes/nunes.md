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

Ver feature completa: [[../bugs-resolvidos/2026-04-bifurcacao-postgresql-nunes|Bifurcação PostgreSQL para Nunes]]

## ⚠️ Cuidados ao implementar
- Ao adicionar query nova que lê dados do ERP, criar **as duas versões** (Oracle + Postgres)
- Média linear (histórico do ano anterior) pode não existir no Nunes — variável `skipML`
- Filtros de TIPO_SAIDA podem ter códigos diferentes em cada ERP
- `vdonlineprod` só tem ~13 dias — pra períodos anteriores usar `vdadet{MMYY}`
- Custo PG = `vopr_custoentrada * qtde + vopr_icmsvalor` (fórmula atual em [[gestao-inteligente.service.ts]])

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

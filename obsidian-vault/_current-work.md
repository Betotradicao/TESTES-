# 🚧 Trabalho em Andamento

## Sessão 2026-05-22 — Custo real Nunes documentado ✅

### Status: Descobertas no vault

Investigação completa salva em [[bugs-resolvidos/2026-05-22-custo-nunes-formula-correta]] e nota do [[clientes/nunes|Nunes]] atualizada.

**Resumo da descoberta:**
- Fórmula correta: `SUM(mprd_ctmedio + mprd_ctvenda)` em `movprodd{MMYY}` com filtro `mprd_dcto_tipo = 'EVP'`
- Bate 99,85% com o app oficial do RP INFO (R$ 12.849,34 vs 12.829,48 — diff R$ 19,86)
- Filtro `dcto_tipo='EVP'` é OBRIGATÓRIO — sem ele pega EAQ/ESE/EDC/etc e infla
- Substitui fórmula antiga `vopr_custoentrada * qtde + vopr_icmsvalor` (errava ~1,5%)
- Diff residual 0,15% provável crédito PIS/Cofins apurado mensalmente (aceitável)

### ⏸️ Pendente — aplicar no código
Arquivo: `packages/backend/src/services/gestao-inteligente.service.ts`
Caminho Postgres do Nunes — substituir fórmula. Aguardando OK do Roberto pra implementar.

### ✅ Conexão Nunes atualizada (2026-05-22)
Migrou do túnel SSH pra conexão **direta via DDNS MikroTik**:
- Host Nuvem: `hea08skfqwk.sn.mynetname.net:10835`
- Host Local: `192.168.102.10:10835`
- Testado e funcionando — query custo 21/05 retornou R$ 12.849,34 conforme documentado.

DVR continua via túnel SSH (portas 38100/38101) — só o ERP migrou pra DDNS.

## 📋 Pendências de sessões anteriores
1. **49 bipagens Tradicao "ready" sem arquivo** — aguardando OK pro UPDATE bips SET clip_status=NULL
2. **Filtro IP roteador** Tradicao/Nunes (presencial)
3. **Cliente Fratelli** — esperando portas abrirem
4. **Fornecedor Pedido Público** — backend + frontend prontos, falta validar fluxo e fazer deploy

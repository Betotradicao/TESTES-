# Onde paramos

## 01/11/2026 — Tradição caído de novo (6ª vez) ✅ restart 21:37 UTC, 0 falhas

- ✅ Sensor "manco" do watchdog **montado e testado** (5 cenários ok) →
  [[arquitetura/radar-watchdog]] · `InstaladorVPS/radar-watchdog/`
- ✅ **Instalado** 01/11 18:58 BRT (backup `.bak-2026-11-01`), ciclo real rodou limpo
- Próxima queda: conferir `/opt/radar-watchdog/watchdog.log` — deve ter `RESTART ... manco`
- Não commitado (`InstaladorVPS/radar-watchdog/` + vault).

## 09/10/2026 — Tradição caído (5ª vez do bug "não abre conexão nova") ✅ resolvido

- Perícia + restart 15:34 UTC, 0 falhas depois →
  [[bugs-resolvidos/2026-08-22-backend-nao-abre-conexao-nova-watchdog-nao-ve]]
- Em aberto (decisão do Roberto): sensor de falha de cron no watchdog / `UV_THREADPOOL_SIZE=16`

## 22/09/2026 — SuperVital: encerrado do nosso lado ✅

**Conexão curada.** O *Testar* da tela resolveu: `status=active`, mapeamentos carregados,
Gestão Inteligente rodando com as 2 lojas, `ORA-00904` sumiu.

**A tela zerada do dia NÃO era nossa:** o Oracle da loja não recebe venda desde 20/09 porque
a **frente de caixa (sistema de terceiro) parou de enviar para o Intersolid**. Roberto já
conhece o comportamento. Volta sozinho quando a loja religar o envio.

**Bug nosso encontrado no caminho, e parado por decisão:** o Sells Sync só sincroniza a data
de HOJE, então o dia que a frente de caixa atrasa fica vazio na `sells` para sempre.
⛔ **Roberto decidiu em 22/09: deixar como está.** Não re-oferecer.

Notas desta sequência:
- [[bugs-resolvidos/2026-09-21-teste-falho-desliga-a-integracao-inteira]] — `status` travado (Salvar ≠ Testar)
- [[bugs-resolvidos/2026-09-22-tela-zerada-era-o-erp-da-loja-parado]] — como provar em 1 consulta
- [[bugs-resolvidos/2026-09-22-sells-sync-so-olha-hoje-dia-perdido-nunca-volta]] — ⛔ parado
- Script novo: `scripts/ultima-venda-oracle.js`

⚠️ **Não commitado** — nada foi enviado. Mudanças locais: as notas do vault + o script.

## ⏳ Ainda aberto (de antes)

- **Festival do Suíno (Tradição)** — pendente confirmar preço 9,99 + lista, zerar o PLU 6927
  (OSSO/SEBO) no Intersolid e conferir o PLU 14427
- **Quinta do 10** — conferir os itens em amarelo (desconto >40% = custo velho provável)
- **`Login.jsx`** com a correção do autofill, não commitada — decidir se entra ou reverte
  → [[bugs-resolvidos/2026-09-07-login-autofill-chrome-senha-vazia]]
- **IA da balança** parada em 62,7%; próximo passo é alargar a janela (`INICIO_S` em
  `balanca.service.ts`) → [[modulos/ia-reconhecimento-balanca]]
- **Tradição / watchdog** — Roberto decidiu em 15/09: não mexer, restart manual

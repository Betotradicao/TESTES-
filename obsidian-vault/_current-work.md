# 🚧 Trabalho em Andamento

## Sessão atual (2026-05-20) — Pré-clipes Vision Palavra-Chave

### Status: ⏸️ Aguardando observação ao longo do dia

Feature **pré-geração de clipes DVR** está deployada no **Tradição** e funcionando. Botão Play do Vision Palavra-Chave vira verde quando o clipe foi pré-gerado, toca instantâneo.

Doc completa: [[bugs-resolvidos/2026-05-pre-clipes-vision-palavra-chave]]

### Config final do cron (após tuning)
- **Frequência:** a cada 30min (`*/30 * * * *`)
- **Limite por execução:** 10 clipes
- **Jitter:** 0-3min no início (evita pico simultâneo com outras lojas)
- **Janela de busca:** últimas 48h
- **Retenção:** 2 dias (cron limpa às 3:05 da manhã)
- **Ordem:** mais recente → mais antigo (`eventos.reverse()`)
- **Defesa:** `try/catch` no save absorve duplicate key (race condition)

### Caso de uso alvo
Auditor abre Vision Palavra-Chave **hoje de manhã** e quer ver vídeos de eventos de **ontem**. Como o cron rodou ao longo do dia anterior, todos os eventos de ontem já estão verdes.

### Cenário de bootstrap (já passou)
Primeira vez que ligamos, fila de ~100 eventos das últimas 48h. Com 10/exec a cada 30min, zera em ~5-6h. Daí em diante regime normal.

### Deployado em
- ✅ Tradição (commits `e8b7ad1` + `617bff2`)
- ✅ Nunes (mesmo commit; bifurca pra PG automaticamente)
- ✅ SuperVital (cron roda mas pula loja — sem `dvr_devices` configurado)
- ✅ MaxValle (cron roda mas pula loja — sem `dvr_devices` + Oracle inativo)
- ⏸️ Idealmix (não deployado — usuario pediu pra pular)

Quando configurarem `dvr_devices.cameras_pdv` no SuperVital ou MaxValle, a feature comeca a gerar clipes sozinha sem precisar mexer em codigo.

### Próximas ações esperadas
1. Usuário observa Tradição ao longo do dia
2. Se OK: deploy nos outros 4 clientes
3. Se precisar ajuste: discutir e novo commit

### Estado git
Branch `TESTE` em sincronia com `origin/TESTE`. Último commit: `617bff2`.

### Pendências de outras tarefas
- Whitelabel da Mameva (pausado anteriormente — ver [[arquitetura/whitelabel]])

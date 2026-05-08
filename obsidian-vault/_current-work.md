# 🚧 Trabalho em Andamento

## Sessão atual (2026-05-08)

### Tarefa
Planejando implementação de **whitelabel** — cliente Mameva quer revender com domínio próprio (`mameva.com.br`).

**👉 DOC DE REFERÊNCIA: [[arquitetura/whitelabel]]**
Se este chat cair, ler primeiro esse doc — tem estado atual + plano + rollback completo.

### Estado
- ✅ Investigação feita: domínio hardcoded em `InstaladorVPS/install-multitenant.sh:134`
- ✅ Levantamento dos 12 arquivos de UI com "Radar 360"/"Prevenção no Radar" hardcoded (lista no doc)
- ✅ Confirmado: `client_brand_name` e `client_logo_url` em `configurations` JÁ existem (Logo.jsx + EmpresaConfigTab.jsx leem)
- ✅ Doc criado: `obsidian-vault/arquitetura/whitelabel.md`
- ✅ Index do vault atualizado com link
- ⏸️ **Aguardando OK do usuário** pra começar a implementação fase 1 (3-4h)

### Decisões pendentes
- DPO Radar 360 continua sendo `dpo@prevencaonoradar.com.br` mesmo no whitelabel? (provavelmente sim — você é Operador real)
- Cliente piloto: subdomínio real ou `mameva-teste.local` via hosts file?

### Próximo passo
Esperar confirmação. Quando OK, fazer fase 1:
1. Modificar instalador pra aceitar `CUSTOM_DOMAIN` opcional
2. Trocar 12 hardcodes pra ler `client_brand_name` (com fallback "Radar 360")
3. EmpresaConfigTab ganhar campos extras (cor primária, favicon, title, DPO email)

### Pendências de outras tarefas
- Deploy nos clientes restantes do commit `3b4be94` (fix módulos no banco): SuperVital, MaxValle, Nunes, Idealmix
- Já no ar: novacentral, tradicao, mameva

### Estado git
Branch `TESTE`, tudo commitado/pushado. Últimos commits:
- `3b4be94` fix(modulos): config sai do localStorage e vai pro banco
- `c90b8f5` feat(rh-curriculos): coluna Idade + filtros normalizam acentos
- `bd39e6d` feat(rh): vagas com selecao de candidatos + curriculo publico com vagas

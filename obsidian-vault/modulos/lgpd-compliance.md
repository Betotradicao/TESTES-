# LGPD Compliance - Plano de Adequação

**Status:** 📋 Pendente de implementação | Revisado em 2026-04-24

Plano para adequar o Radar 360 à LGPD (Lei 13.709/2018) sem contratar advogado inicialmente. Foco em **minimizar risco de vazamento + multa** mesmo sem aconselhamento jurídico profissional.

## 🎭 Papel do Radar 360 na LGPD

- **Nosso papel**: **OPERADOR** (processamos dados em nome dos clientes)
- **Cliente (Tradição, Nunes, SuperVital, etc)**: **CONTROLADOR** (decide finalidade/meios)
- **Titulares dos dados**: colaboradores + candidatos a vagas

## 📋 Registros obrigatórios no Brasil

**NÃO existe registro prévio obrigatório** em nenhum órgão público pra operar/comercializar.

- **ANPD** (gov.br/anpd) é só regulador — notificação só em caso de **incidente de vazamento** (prazo ~48h após ciência)
- CNPJ regular e NF-e para faturar é o suficiente no âmbito tributário

## 🛠️ Fase 1 — Implementações técnicas (prioridade)

Previnem vazamento técnico e dão ferramenta pra cumprir direitos do titular.

### 1.1 Consentimento no formulário público `/curriculo`
- Checkbox obrigatório antes de enviar: "Li e aceito a Política de Privacidade. Autorizo o uso dos meus dados pra processo seletivo."
- Campo `curriculos.consentimento_aceito BOOLEAN` + `curriculos.consentimento_versao VARCHAR` + `curriculos.consentimento_em TIMESTAMP`
- Versionar a política (se mudar, pedir novo consentimento)

### 1.2 Logs de auditoria
- Tabela `audit_logs`: id, user_id, action (`read`/`update`/`delete`/`export`), entity (`curriculo`/`colaborador`/`aso`), entity_id, ip, user_agent, created_at, diff_json
- Middleware express que registra automaticamente em endpoints sensíveis (`/rh/*`, `/curriculos/*`, `/companies/*`)
- Retenção mínima 6 meses (LGPD exige evidência de tratamento lícito)

### 1.3 Endpoint público "Meus dados" `/curriculo/meus-dados`
- Candidato entra com CPF + data de nascimento → recebe link por email/WhatsApp com token
- Token válido por 24h
- Página mostra:
  - Todos dados cadastrados
  - Botão **Exportar JSON** (direito de portabilidade)
  - Botão **Corrigir dados** (direito de retificação)
  - Botão **Apagar meus dados** (direito ao esquecimento — exclusão lógica com anonimização)

### 1.4 Auto-expurgo de currículos antigos
- Cron diário: currículos com `status='novo'` e `created_at > 12 meses` → anonimiza (zera nome/cpf/email/whatsapp/foto, mantém só estatísticas agregadas)
- Configurável em Configurações RH (padrão 12 meses)

### 1.5 Campo DPO/Encarregado
- Aba "DPO" em Configurações do sistema
- Campos: `nome`, `email`, `telefone`, `horario_atendimento`
- Exibido publicamente em `/seguranca` e no rodapé do `/curriculo`

### 1.6 Criptografia (opcional mas recomendado)
- Campos ultra-sensíveis em `rh_colaboradores` (CPF, PIS, Título Eleitor) com criptografia simétrica AES-256
- Chave no `.env` (nunca commitar)
- Só decifra quando exibe na tela (performance negligível)

## 📄 Fase 2 — Documentos jurídicos (templates)

Posso gerar como markdown prontos pra usar. Revisão por advogado depois é ideal mas não obrigatório pra começar.

### 2.1 Política de Privacidade
- Duas versões:
  - **Sistema (SaaS)**: pro site comercial explicar como dados de cadastro de clientes são tratados
  - **Operacional (/curriculo)**: pra candidato entender o que vai acontecer com o CV dele

### 2.2 Termos de Uso
- Contrato entre Radar 360 e cliente (Tradição, Nunes, etc)
- Define escopo, responsabilidades, SLA, encerramento

### 2.3 DPA — Acordo de Tratamento de Dados (anexo ao contrato)
- Obrigatório pela LGPD entre Controlador e Operador
- Define:
  - Finalidade do tratamento
  - Tipo de dados tratados (cadastrais, financeiros, saúde/ASO)
  - Base legal (execução de contrato, legítimo interesse, consentimento)
  - Medidas de segurança técnicas e organizacionais
  - Sub-operadores autorizados (hostinger/vps, gmail/smtp, etc)
  - Notificação de incidentes (prazo de comunicação ao Controlador)
  - Retorno/destruição dos dados ao encerrar contrato

### 2.4 Termo de ciência LGPD pro colaborador (cliente usa internamente)
- Documento que cliente pede pro funcionário assinar no ato da contratação
- Funcionário declara ciência de que seus dados pessoais + saúde serão tratados pelo empregador no sistema Radar 360

## 🚨 Fase 3 — Resposta a incidentes

### 3.1 Procedimento escrito
Documento interno com passos pra seguir se detectar vazamento:
1. Conter o incidente (revogar acessos, bloquear endpoint)
2. Analisar escopo (quantos titulares afetados, que dados)
3. Comunicar ao Controlador (cliente) em até 24h
4. Decidir se notifica ANPD (obrigatório se risco "relevante ao titular")
5. Se notificar ANPD: prazo 48h pelo portal gov.br/anpd
6. Comunicar titulares (se alto risco)
7. Plano de ação pra evitar recorrência

### 3.2 Página pública `/seguranca`
- Dados de contato do DPO
- Política de Privacidade linkada
- Formulário pro titular exercer direitos (acesso, correção, exclusão)

## 💰 Custos esperados (sem advogado)

- **Fase 1 (técnico)**: 0 reais — Claude implementa
- **Fase 2 (docs)**: 0 reais — Claude gera templates
- **Fase 3**: 0 reais — procedimento escrito é config

**Risco residual sem advogado**: multa teórica de até 2% do faturamento se vazar E for fiscalizado. Mas com todas as fases implementadas, a chance de fiscalização agressiva cai muito.

**Investimento recomendado no futuro**: R$300-500 pra advogado especializado revisar os templates das Fases 2 e 3 (30min de consultoria).

## 🔄 Próximos passos

1. [ ] Implementar Fase 1.1 (consentimento no `/curriculo`)
2. [ ] Implementar Fase 1.2 (tabela `audit_logs` + middleware)
3. [ ] Implementar Fase 1.3 (página `/curriculo/meus-dados`)
4. [ ] Implementar Fase 1.4 (cron de expurgo)
5. [ ] Implementar Fase 1.5 (campo DPO em configurações)
6. [ ] Gerar Política de Privacidade (2 versões)
7. [ ] Gerar Termos de Uso
8. [ ] Gerar DPA
9. [ ] Gerar Procedimento de Incidente
10. [ ] Criar página `/seguranca` pública

## 🔗 Relacionado

- [[rh]] — módulo que trata mais dados sensíveis (ASO = saúde, salário, CPF)
- [[../clientes]] — cada cliente precisa ter DPA anexado ao contrato

## 🏷️ Tags
#compliance #lgpd #juridico #privacidade #pendente

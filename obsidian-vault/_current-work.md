# 🚧 Trabalho em Andamento

## 🎯 Status ao encerrar sessão (24/04/2026)

### 🐛 Pendente RH (próxima sessão)

- **Botão Salvar da aba Empresas do RH (modal Nova Empresa)** não está salvando — investigar: backend não reiniciou após criação da entity `RhEmpresa`? Rota `/rh/empresas` 404/500? Validar no Network do DevTools qual o erro de resposta.

### 🔄 Em andamento

**Desacoplar RH da tela de Configurações principal** — pendente deploy
- Aba **Empresas** em `/rh/configuracoes` virou CRUD inline (antes redirecionava pra `/configuracoes?tab=empresa`)
- Motivo: quando o túnel do Tradição caiu após deploy do xlsx, o módulo RH travou inteiro porque dependia da tela principal pra cadastrar lojas
- Implementação: novo componente `EmpresasTab` em `RhConfiguracoes.jsx` com os mesmos campos (Nome Fantasia, Razão Social, CNPJ, Cód Loja auto, Apelido, CEP, endereço, contato, responsável, foto fachada)
- Usa `/companies` direto. Matriz: codLoja disabled + não excluível. `PUT /companies/my-company` pra matriz, `PUT /companies/:id` pras filiais
- Arquivo alterado: `packages/frontend/src/pages/RhConfiguracoes.jsx`
- **Aguardando**: teste local + permissão pra commit/push/deploy

### ✅ Concluído e deployado no Tradição nesta sessão

**Módulo RH — reestruturação completa:**

1. **Cadastro de Colaboradores** reformulado
   - 16 colunas na tabela: Foto, Matrícula, Nome, Idade (calc), CPF, Cargo, Escolaridade, Empresa, Salário, Jornada, Escala, Regime, Admissão, Tempo de Casa, Status
   - Header clicável pra sort A-Z/Z-A em todas as colunas
   - Filtros: Cargo, Empresa, Jornada (todos com "Todos" default)
   - Sem paginação (scroll único com contador total)
   - Stats cards redesenhados: ícones neutros + faixa lateral fosca
   - Modal com campo **Empresa/Loja** no topo + Status. Abas de Escala/Regime/Benefícios dinâmicos. Upload de foto na aba Dados Pessoais
   - Fix backend: `nnum()`/`nn()` convertem strings vazias em null (evita erro Postgres quando campos numéricos vêm como "")

2. **Documentação de Colaboradores** (`/rh/documentacao`)
   - Pastas com drag-and-drop pra reordenar
   - Sub-pastas com flag **Obrigatório**/**Opcional**
   - **Propagação automática**: criar pasta em um colaborador replica pra todos ativos (template global)
   - Upload com 3 métodos: **paste Ctrl+V**, **📷 Tirar Foto** (`capture=environment`), **📁 Escolher**
   - Filtro por data dos arquivos
   - Botão "Gerar PDF consolidado" (PDFKit)
   - Cards de stats no topo (Pastas/Obrig./Opcional/Pendentes) com filtro clicável
   - Drill-down responsivo mobile

3. **Controle de ASO** (`/rh/aso`) — novo módulo
   - Dashboard com 5 cards clicáveis (Total ativos, Válidos, A Vencer 30d, Vencidos, Sem ASO)
   - 2 colunas: lista de colaboradores com status pill + detalhe do colab
   - Card de destaque "Último Periódico" colorido (vermelho se vencido, amarelo se a vencer, verde)
   - 5 abas por tipo (Admissional/Periódico/Demissional/Retorno/Mudança)
   - Upload obrigatório no modal (bloqueia Salvar sem arquivo)
   - Card de vencimento calculado em tempo real baseado em `data_exame + validade_meses`
   - Filtro por empresa
   - Fix SQL: cast explícito `::int` em validade_meses

4. **Departamento Pessoal** (`/rh/departamento-pessoal`) — novo módulo
   - Docs **DA EMPRESA** (não por colaborador)
   - Seletor de empresa obrigatório (company_id em `dp_pastas`)
   - Botão "Seed" cria 3 pastas padrão por empresa (DOCS EMPRESA, DOCS VIGILANCIA, DOCS MODELOS RH)
   - Drag-drop + sub-pastas com obrigatório/opcional
   - Mesma UX de upload (paste/câmera/arquivo)

5. **Lançamentos Financeiros** (`/rh/lancamentos`) — novo módulo (era placeholder)
   - Replica layout do Excel "APONTAMENTOS 2026"
   - Filtros: empresa + data de/até
   - Grid tipo planilha com colaboradores ativos + salário + 9 proventos + 8 descontos + líquido calculado
   - Botão "+ Coluna" cria campos extras customizados (JSONB em `campos_extras`)
   - Exports PDF (paisagem) e Excel (.xlsx via lib `xlsx`)
   - Upsert por (colaborador_id, data_inicio, data_fim)
   - Inputs `type=text inputMode=decimal` (sem spinner arrows)

6. **Configurações RH**
   - Aba **Feriados** nova: seletor de loja + botão "Preencher Nacionais" + CRUD inline (DD/MM sem ano)
   - Aba **Empresas** readOnly (redireciona pra /configuracoes)
   - Aba **Setores** renomeada (lê de `rh_departamentos` sincronizado com `sectors`)
   - Aba **Benefícios** nova (nome + valor + descricao)
   - Aba **Jornadas** aceita carga_horaria em HH:MM
   - Uppercase automático em todos inputs de texto

7. **Banco de Currículos**
   - Coluna "Experiências" (mostra até 2 com função/empresa/tempo)
   - Filtros Cidade e Bairro viraram selects com valores únicos dos currículos (chained)

8. **Sidebar reorganizado**
   - BANCO DE CURRÍCULOS dentro de RECRUTAMENTO
   - SAÚDE OCUPACIONAL dentro de COLABORADORES
   - FÉRIAS adicionado em COLABORADORES
   - PESQUISA DE CLIMA novo (com Análise + Criar)
   - DEPARTAMENTO PESSOAL novo
   - Removidos: Dashboard RH, Resultados, Candidatos, Exames Periódicos, Relatório Vencimentos

9. **Companies / Empresa**
   - Seletor de lojas faz UNIÃO: ERP + companies locais + auto-cria faltantes
   - Auto-numeração de lojas (`max(codLoja)+1`)
   - Cadastro sem campos obrigatórios
   - Upload de foto da fachada + exibição nos cards

10. **Currículo público** (`/curriculo`)
    - Tela de seleção de loja (inclui matriz via `is_principal`)
    - Cards com foto em tamanho original + apelido em destaque

**Migrations criadas**: carga_horaria, escala_id, company_id, departamento_id, beneficios_ids, ordem em pastas, subpastas, rh_asos, rh_beneficios, rh_apontamentos, dp_pastas/subpastas/documentos, rh_apontamento_campos, seed de feriados nacionais, etc.

### 🔜 Pendente pra depois

**1. LGPD Compliance** (ver [[modulos/lgpd-compliance]]) — 🆕 prioridade alta
- Fase 1 técnico: consentimento em /curriculo, audit_logs, /meus-dados, auto-expurgo, campo DPO
- Fase 2 docs: Política de Privacidade, Termos de Uso, DPA, Termo ciência colaborador
- Fase 3: procedimento de incidente + página /seguranca
- Sem contratar advogado inicialmente (Claude gera tudo como template)

**2. Responsivo mobile** — parcial
- Drill-down aplicado em Documentação e ASO
- Falta aplicar em Cadastro de Colaboradores (tabela horizontal no mobile)
- Stats cards já em 2x2 no mobile

**3. Pesquisa de Clima** — menu criado mas rotas stub
- `/rh/pesquisa-clima/analise` e `/rh/pesquisa-clima/criar` sem tela ainda

**4. Férias** — menu criado mas rota stub (`/rh/ferias`)

**5. Vision Antifurto** — POC ainda pendente (ver [[modulos/vision-antifurto]])

**6. Listagem de apontamentos históricos + comparativo mensal** no Lançamentos
- Atualmente só mostra 1 período por vez
- Falta: visualização mensal tipo o Excel (uma planilha por mês, comparativo)

### 🔌 Integrações do módulo RH a finalizar

- Cron de atualização automática da Sexta-feira Santa no feriados (todo 1º de janeiro)
- Notificação automática (WhatsApp?) quando ASO está a vencer em 30 dias
- Dashboard de "Próximos ASOs a vencer" na home do RH

### ⚠️ Estado do repositório

Branch `TESTE`, tudo commitado e pushado. Últimos commits:
- `d8c72c4` feat(rh): Departamento Pessoal + Lancamentos + ASO + paste/camera/drill-down
- `fac0fcf` feat(rh): Controle de ASO + paste (Ctrl+V) nos uploads
- `60323c3` feat(empresa+rh): padroniza lojas + aba Empresas do RH = companies
- `07970ad` feat(rh): reformulacao completa do modulo RH
- `96d9acb` fix(empresa): remove obrigatoriedade de Nome Fantasia/Razao Social/CNPJ
- `d80f1a1` fix(rh+empresa): tela branca /rh/resultados + nova loja sem obrigatorios

### 🧠 Aprendizados desta sessão

- **`validade_meses` em SQL com calculo de intervalo**: Postgres confunde tipo do parâmetro quando usado em 2 contextos (INSERT value + INTERVAL). Fix: cast explícito `$N::int` nos dois usos
- **Propagação de template global**: pasta/subpasta por colaborador precisa replicar pra todos os ativos na criação/edição/exclusão — senão cada colaborador vira um trabalho manual
- **Tela de 3 painéis no mobile**: usar state derivado do que está selecionado pra ocultar painéis (drill-down) ao invés de um state `mobileView` explícito
- **Input numérico sem spinner**: `type="text" inputMode="decimal"` permite digitação livre + teclado numérico no mobile
- **`capture="environment"` no input file**: abre câmera traseira no celular direto
- **Paste de imagem via Ctrl+V**: `onPaste` → `clipboardData.items` → `getAsFile()` → virar File
- **Port 3000 zombie no Windows**: backend ts-node às vezes deixa processo órfão bloqueando a porta. Matar manualmente com Stop-Process antes de reiniciar PM2

### 💰 Situação financeira do usuário

- Sem orçamento pra advogado → LGPD vai ser feito in-house com templates do Claude
- Deploys sempre pedir permissão (regra reforçada)

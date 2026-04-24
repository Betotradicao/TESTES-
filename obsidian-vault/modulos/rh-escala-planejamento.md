# RH — Escala de Trabalho (Planejamento)

**Status:** 📋 Em especificação | Revisado em 2026-04-24
**Fonte:** análise da planilha "Planilha de escala de trabalho 7.5.xlsm" (Tradição)

Plano pra criar um módulo de escala dentro do RH que substitua a planilha com suporte a 6x1, 5x2, escalas especiais de domingo (1x1, 2x1), férias, licenças, excessões, relatório de horas e (fase 2) otimização por IA.

## 🎯 Premissas (alinhamento com a visão do usuário)

Três comportamentos que dirigem o desenho do módulo:

### 1. Programar uma vez → roda sozinha em sequência
O planejador define o **template semanal** de cada colaborador **uma vez** (ou quando troca a rotação). Depois disso, o sistema gera a escala mensal **sozinho em sequência**, ciclando o template. Não há "refazer Março do zero" — Março nasce de Fevereiro mais as datas.

*Como fica*: tabela `rh_escala_templates` com `padrao_semanal` (JSONB) + `vigencia_inicio/fim`. O gerador aplica o padrão rotacionando a cada semana do ciclo (se o template tem 2 semanas, semana 1/3/5 = padrão A, semana 2/4 = padrão B). Só precisa mexer quando colaborador muda jornada ou sai de férias longas.

### 2. Horário previsto do colaborador dita a escala
Cada colaborador tem jornada contratada (7h30, 6h15, 8h etc — já temos em `rh_jornadas.carga_horaria`). O template só pode atribuir turnos cuja soma semanal bata com essa jornada. O sistema **bloqueia** se você montar um template que passa/fica abaixo.

*Como fica*: na tela de template do colaborador, um rodapé mostra "Horas planejadas: 42h | Contratadas: 40h | ⚠️ excedeu 2h". Backend valida antes de salvar.

**Casos reais do Tradição (exemplos pra conferir que o modelo cabe todos):**

| Perfil | h/dia | Rotação | Dias trab./sem | Total sem | Turnos típicos |
|---|---|---|---|---|---|
| Açougueiro (fixo) | 7h30 | 6x1 | 6 | 44h | TM 7:15 |
| Auxiliar açougue | 7h30 | 6x1 | 6 | 44h | TM 7:15 ou TT 13:00 |
| Aux. padaria jovem | 6h15 | 6x1 | 6 | 36h | TM 7:15 reduzido |
| Aux. limpeza | 7h38 | 5x2 | 5 | 38h | TMD 10:00 |
| Balconista padaria | 7h30 ou 6h15 | 6x1 | 6 | 44h / 36h | TT 15:05 |
| Fiscal | 7h30 | 6x1 com rodízio dom | 6 | 44h | TM 7:15 ou TT 13:00 alternados |
| Gerente/supervisor | 7h30 | Escala livre | 5-6 | 40-44h | Livre |
| Aprendiz / meio período | 5h00 | 5x2 | 5 | 25h | TM reduzido |
| Folguista | 7h30 | 6x1 itinerante | 6 | 44h | Cobre onde precisa |

**Como o modelo acomoda todos:**
- `rh_jornadas.carga_horaria` armazena 7h30 / 6h15 / 7h38 / 5h00 etc (HH:MM)
- `rh_escala_templates.tipo_rotacao` = `6x1` | `5x2` | `1x1_dom` | `2x1_dom` | `livre` | `folguista`
- `padrao_semanal` (JSONB) define qual turno cai em cada dia do ciclo
- Gerador multiplica: `dias_trabalhados_semana × horas_por_turno = total_semanal`, compara com `carga_horaria × dias_previstos` e avisa desvio
- **Folguista** é um caso especial: template com `tipo='folguista'`, aponta cargos que cobre, e o gerador automático o encaixa onde há folga

### 3. Atestados, férias e licenças sobrepõem a escala automaticamente
Quando RH lança atestado/férias/licença pro colab, isso **reflete na grid da escala** instantaneamente — não precisa ninguém ir lá corrigir célula a célula. E inversamente: se o colab tem férias marcada, a escala daquele dia mostra `FE` e não deixa escalar.

*Como fica*: a resolução da célula da grid é em camadas (precedência):
```
1. Excessão (maior prioridade) → mostra o turno da excessão
2. Férias → mostra "FE"
3. Licença/Atestado → mostra "LI" + tooltip com motivo
4. Feriado da loja → mostra "FR" (se colab "trabalha_feriado=false")
5. Template do colaborador (fallback) → mostra turno do padrão semanal
```

Isso faz com que:
- Lançar atestado no módulo de saúde ocupacional **já preenche o "LI" na escala** daquele dia
- Marcar férias no módulo de férias **bloqueia aqueles dias** e sinaliza na grid
- Excessão pontual (trocar TM por TT num dia) sobrescreve sem apagar o template

## 🎯 Diretriz

**TUDO que for catálogo vem da tela de Configurações RH já existente.** Não duplicar cadastro:

| Entidade | Fonte atual |
|---|---|
| Colaboradores | `rh_colaboradores` |
| Cargos | `rh_cargos` |
| Empresas/Lojas | `rh_empresas` (módulo novo) |
| Jornadas | `rh_jornadas` (carga horária em HH:MM) |
| Feriados | `holidays` (com seletor por loja) |
| Benefícios | `rh_beneficios` |

Nova tabela só pro que **não existe** hoje: catálogo de turnos da escala.

## 🗺️ Estrutura da planilha atual (15 abas)

### 1. Menu
Botoeira estática (só layout, sem dados) — Atalhos, Relatórios, Menu.

### 2. Configuração
**Catálogo de turnos** (esse é o coração — não tem equivalente no sistema hoje):

| Código | Horário | Dom | Seg | Ter | Qua | Qui | Sex | Sáb |
|---|---|---|---|---|---|---|---|---|
| TM 7:15 | 07:15–15:50 | - | 2 | 3 | 2 | 2 | 2 | 2 |
| TM 7:30 | 07:30–15:00 | - | - | - | 1 | 1 | 1 | 1 |
| TM 8:00 | 08:00–16:00 | - | 1 | 1 | 1 | 1 | 1 | 1 |
| TM 9:00 | 09:00–17:00 | - | 1 | 1 | 1 | - | - | 1 |
| TT 13:00 | 13:00–… | - | 3 | 2 | 2 | 2 | 3 | 2 |
| TT 15:05 | 15:05–… | - | 2 | 3 | 3 | 2 | 2 | 3 |
| TT 15:20 | 15:20–… | - | 1 | 1 | - | 1 | 1 | 1 |
| TMD 10:00 | 10:00–18:20 | - | - | - | - | - | - | - |
| TMD 11:00 | 11:00–19:20 | - | - | - | - | - | - | - |
| TTD 13:05 | 13:05–19:20 (6h) | - | - | - | - | - | - | - |
| TTD 13:20 | 13:20–19:20 (5h) | - | - | - | - | - | - | - |
| T | 07:15–15:50 domingo | 6 | - | - | - | - | - | - |
| FG | Folga | - | - | - | - | - | - | - |
| FE | Férias | - | - | - | - | - | - | - |
| FR | Feriado | - | - | - | - | - | - | - |
| LI | Licença | - | - | - | - | - | - | - |

Cada turno tem um **mínimo de pessoas por dia da semana** — isso é a regra de cobertura.

**Feriados (2020–2050)** também ficam nessa aba (col M-O). Mas no nosso sistema já vem de `holidays`.

### 3. Férias
Tabela simples: `Funcionário | Dia Férias`. Chave = nome+data.

### 4. Licença
Tabela: `Funcionário | Dia Licença | Motivo`.

### 5. Excessões (sic)
Tabela: `Funcionário | Dia | Turno | Motivo` — permite **trocar o turno de um dia específico** (por ex, alguém troca de TM pra TT numa data pontual).

### 6. Cadastro
Grid com o **template semanal de cada colaborador**:
- Colunas base: B=Funcionário, C=Cargo, D=Data Inicial, E=Horas diárias (7.5, 7.64, 6.25…)
- Coluna **N=Folga especial**: "1.º Dom escala" / "2.º Dom escala" — define qual domingo do mês é folga automática
- Coluna **O=Feriado**: Sim/Não — se trabalha em feriado
- **Colunas P em diante (8 semanas × 7 dias = 56 cols)**: template do turno pra cada dia da semana, semana 1, semana 2, etc. É assim que define a escala base: "esse cara na semana 1 domingo folga, segunda TM 7:15, terça TM 7:15…".

**Essa é a peça-chave pra escala 6x1/5x2**: o template semanal + regra de rotação do domingo é o que gera a escala real.

### 7. Escala padrão
Template genérico pra cargos com **rodízio de domingos**. Define turnos T.1/T.2/T.3 fixos e folguistas que cobrem folgas. Lógica das fórmulas:
- `T.1=2` pessoas (06–13h), `T.2=2` pessoas (13–20h), `T.3=1` pessoa (20–06h)
- Folguista entra no T.1 quando alguém da equipe está de folga no dia
- Pra domingo: conta ocorrências anteriores de domingos no mês e alterna quem folga

### 8. Validação
Tudo fórmula — **valida se os mínimos de cobertura foram atendidos** e destaca turnos faltando. É o "semáforo" do planejador.

### 9. Resumo de horas
Output por colaborador: `Dias férias | Folga/Feriado | Licença | Dias trabalho | Contagem Turno1..Turno8`. Usa `COUNTIF` na grid principal.

### 10. Escala de funcionários (grid principal)
**Visualização mensal** (linhas = colaboradores, colunas = dias do mês). Fórmulas agregam:
1. Data inicial (`CI1` = 1º do mês) e dias do mês (`DAY(EOMONTH)`)
2. Pra cada célula: verifica Excessões → Férias → Licença → template do Cadastro → resultado
3. Colunas BC-CG = grid real, colunas C-AN = versão visual agrupada por semana

Toda a planilha gira em torno desse grid.

### 11. Cálculos
Aba intermediária de fórmulas (não visível, só auxiliar). Resolve `INDIRECT/OFFSET` pesados pra alimentar Validação e Resumo.

### 12. Dashboard
Provavelmente gráficos (range grande mas só referências a outras abas).

### 13. Auxiliar / Auxiliar Dash / Ajuda
Tabelas de apoio + instruções. Sem dados de escala.

### 14. Escala padrão (template)
Já coberta acima (item 7).

### 15. VBA (macros)
227KB de código compilado — só consegui identificar `Worksheet_Activate`. O restante provavelmente é:
- Botões Incluir/Excluir/Imprimir/Exportar
- Validações ao trocar mês
- Recalc manual

**Não precisa portar o VBA** — vamos recriar a lógica em JS/TS com a mesma intenção.

## 🧱 Modelo de dados proposto

### Tabelas novas

**`rh_escala_turnos`** (catálogo — equivalente da aba Configuração col B-K):
```sql
id UUID PK
codigo VARCHAR(10) UNIQUE            -- "TM 7:15", "FG", "FE"
nome VARCHAR(100)                    -- "Manha 07:15"
hora_inicio TIME NULL                -- 07:15
hora_fim TIME NULL                   -- 15:50
total_horas NUMERIC                  -- 7.33 (calculado ou fixo)
tipo VARCHAR(20)                     -- 'turno' | 'folga' | 'ferias' | 'feriado' | 'licenca'
cor VARCHAR(7)                       -- '#E8F5E9' pro grid visual
company_id UUID REFERENCES rh_empresas(id)
ativo BOOLEAN DEFAULT true
```

**`rh_escala_cobertura`** (cobertura mínima **por setor × turno × dia da semana**):
```sql
id UUID PK
company_id UUID REFERENCES rh_empresas(id)
departamento_id INT REFERENCES rh_departamentos(id)  -- setor
turno_id UUID REFERENCES rh_escala_turnos(id)
dia_semana SMALLINT                  -- 0=dom, 1=seg, ..., 6=sab
minimo INT                           -- qtd minima de pessoas
UNIQUE(company_id, departamento_id, turno_id, dia_semana)
```
Isso substitui a matriz da planilha (col D-J da aba Configuração) com granularidade **por setor** — açougue tem mínimo diferente de padaria.

**`rh_escala_templates`** (template semanal por colaborador — equivalente da aba Cadastro cols P+):
```sql
id UUID PK
colaborador_id UUID REFERENCES rh_colaboradores(id) ON DELETE CASCADE
tipo_rotacao VARCHAR(20)             -- '6x1' | '5x2' | '1x1_dom' | '2x1_dom' | 'livre'
folga_domingo VARCHAR(20)            -- '1o_dom_mes' | '2o_dom_mes' | 'sempre' | 'nunca'
trabalha_feriado BOOLEAN DEFAULT true
padrao_semanal JSONB                 -- [{ semana: 1, dia: 'dom', turno_id: '...' }, ...]
                                     -- ate 4-5 semanas de padrao cycling
vigencia_inicio DATE
vigencia_fim DATE NULL
```

**`rh_escala_lancamentos`** (grid real, 1 linha por colaborador × dia — o OUTPUT):
```sql
id UUID PK
colaborador_id UUID REFERENCES rh_colaboradores(id) ON DELETE CASCADE
data DATE
turno_id UUID REFERENCES rh_escala_turnos(id)
origem VARCHAR(20)                   -- 'template' | 'excessao' | 'ferias' | 'licenca' | 'feriado' | 'manual'
observacao TEXT NULL
UNIQUE(colaborador_id, data)
```

**`rh_escala_ferias`** (equivalente da aba Férias):
```sql
id UUID PK
colaborador_id UUID
data DATE
UNIQUE(colaborador_id, data)
```
(Ou agregar em `rh_escala_lancamentos` com origem='ferias' — depende de preferência)

**`rh_escala_licencas`**:
```sql
id UUID PK
colaborador_id UUID
data_inicio DATE
data_fim DATE
motivo VARCHAR(255)
```

**`rh_escala_excessoes`**:
```sql
id UUID PK
colaborador_id UUID
data DATE
turno_id UUID
motivo VARCHAR(255)
```

### Campo a adicionar em `rh_colaboradores`

- `horas_dia_contratadas NUMERIC` (hoje tem `carga_horaria` em HH:MM na jornada — usar o que já tem)

## 🖥️ Telas propostas

### 1. `/rh/escala` (tela principal) — **por setor**

**A visão padrão é por SETOR** (Açougue, Padaria, Frente de Caixa, HortFruti, Mercearia, Administrativo etc), não tudo junto. Seletor de setor no topo filtra a grid pra ver só o time daquele setor — assim fica mais fácil gerenciar cobertura e trocas. Tem também a opção "Todos os setores" pra visão geral.

**Layout da grid**:
- Seletor: Loja + Setor + Mês
- Coluna fixa à esquerda: `Foto | Nome | Cargo | Jornada (ex: 7h30) | Tipo rotação (ex: 6x1)` — tudo visível direto
- **Jornada e rotação ficam EVIDENTES na linha do colaborador** (não precisa abrir modal). Ao lado do nome aparece um badge tipo `7h30 · 6x1` colorido
- Colunas: dias do mês (1-31) com header mostrando dia da semana + feriado destacado
- Células com cor de fundo por tipo de turno (TM = laranja suave, TT = azul, FG = verde, FE = roxo, LI = cinza)
- **Rodapé com total semanal por colab**: soma das horas da semana, compara com contratada (cor vermelha se desviou)
- Rodapé com **cobertura por turno naquele setor**: ex "Açougue - Ter: precisa 3 / escalado 2 ❌"
- Clica célula → dropdown com turnos disponíveis (de `rh_escala_turnos`)
- Botões: Gerar Automático (a partir do template) | Limpar | Exportar PDF | Exportar Excel
- Validação ao vivo: cobertura vs mínimo (semáforo) por setor
- Drill-down mobile: seleciona colab → vê só os dias dele

**Por que por setor**: cada setor tem turnos diferentes, picos diferentes, cobertura mínima diferente. Açougue precisa gente 7-13 e 13-20; padaria começa mais cedo (6h); frente de caixa tem pico no fim de semana. Gerenciar tudo junto é ingerenciável.

**Totalizador "Todos setores"**: ainda existe, pra ver se o mercado inteiro está coberto — mas a edição acontece em cada setor.

**Fluxo de uso** (como fica no dia-a-dia):
1. Usuário abre `/rh/escala` → seletor de **Setor** aparece puxando de `rh_departamentos` (os setores já cadastrados)
2. Escolhe "Açougue" → o grid mostra só os colaboradores com `rh_colaboradores.departamento_id = açougue.id`
3. A amarração colaborador ↔ setor **já existe** no cadastro atual (tela Colaboradores → campo Setor) — não precisa cadastrar de novo
4. Se um colaborador não aparecer no setor esperado, é só editar o cadastro dele e atribuir o setor correto

**Caso especial - folguista que atende vários setores**:
Hoje o modelo é 1-pra-1 (colab → 1 setor). Se quiser que um folguista possa aparecer em vários setores, criar tabela linker `rh_colaborador_setores` (many-to-many). Recomendo **deixar pra quando precisar** — começa com 1-pra-1 e evolui se for necessário.

### 2. `/rh/escala/turnos` (catálogo, ou aba em Configurações RH)
CRUD de `rh_escala_turnos` com matriz de cobertura mínima dom..sáb.

### 3. `/rh/escala/template/:colaboradorId` (template do colaborador)
Grid pequeno (4 semanas × 7 dias) pra definir o padrão semanal + seletor de tipo rotação (6x1/5x2/etc) + domingo preferido de folga.

### 4. `/rh/escala/eventos` (Férias/Licenças/Excessões)
Abas com 3 tabelas CRUD separadas.

### 5. `/rh/escala/relatorio` (Resumo de horas)
Por colaborador: dias trabalhados, folgas, férias, licenças, contagem por turno, total de horas no mês.

## 🤖 Fase 2 — Otimização / IA

### Etapa 1 (programação clássica)
- Gerador automático: dado o template + eventos + cobertura mínima, monta o mês respeitando:
  - Mínimo de pessoas por turno/dia
  - Folga obrigatória semanal (DSR)
  - Rotação de domingos (1ª/2ª/3ª ocorrência)
  - Férias/licenças/excessões como "bloqueios"
- **Solver**: programação linear inteira (lib `javascript-lp-solver` ou chamar Python/pulp via job)

### Etapa 2 (IA)
- Treinar em cima do histórico real (quantos caixas por dia × hora × movimento de vendas do Oracle)
- Sugerir deslocamento de turnos baseado em **horários de pico observados** (lemos do Oracle via módulo Bipagens)
- Alertar quando absenteísmo histórico de um colab afeta cobertura futura
- Cross-check com férias/ponto pra sugerir recomposição

## 📋 Próximos passos

1. [ ] Confirmar diretriz: usar `rh_colaboradores` + `rh_cargos` + `rh_empresas` + `rh_jornadas` existentes
2. [ ] Decidir se `trabalho_feriado`, `horas_dia`, `folga_preferencial` vão em `rh_colaboradores` ou na tabela de template
3. [ ] Criar migration `CreateRhEscalaTables`
4. [ ] Entity `RhEscalaTurno`, `RhEscalaTemplate`, `RhEscalaLancamento`
5. [ ] Controller `rh-escala.controller.ts` com CRUD + gerador automático
6. [ ] Tela `RhEscala.jsx` com grid mensal (usar virtualização por causa de 30 colaboradores × 31 dias)
7. [ ] Catálogo de turnos (aba em Configurações RH)
8. [ ] Tela de template por colaborador
9. [ ] Eventos (Férias/Licença/Excessões)
10. [ ] Exports PDF + Excel seguindo o mesmo estilo visual do Lançamentos
11. [ ] Fase 2 — IA quando histórico estiver rico

## 💡 Meus toques (ideias que não vêm da planilha)

Coisas que eu adicionaria porque fazem sentido dado que **já temos dados que o Excel não tinha**. Priorizado por impacto × esforço.

### ⭐⭐⭐ Alto impacto

**1. Cruzamento escala planejada × realizada (Oracle/Bipagens)**
- Já coletamos `TAB_OPERADORES` + bipagens por caixa no módulo Bipagens
- Pra frente de caixa: comparar quem estava escalado vs quem bipou = **absenteísmo automático**, sem ninguém preencher nada
- Dashboard mostra "no dia X havia 3 caixas escalados mas só 2 operaram"
- **Por que é importante**: absenteísmo é o principal vazamento de custo em mercado; hoje você só descobre depois do fato

**2. Heatmap de cobertura × movimento**
- Overlay na escala: vendas por faixa de hora (já temos em `sells`/Oracle) + cor do turno
- Detecta na hora quando o pico 18h–20h tem poucos caixas escalados
- **Por que é importante**: é o "olho do planejador" — mostra onde está subcoberto ou sobrecoberto sem precisar contar mão

**3. Validação CLT integrada**
- Regras duras no backend impedem salvar escala que viole:
  - **Intervalo interjornadas** mínimo 11h
  - **DSR (Descanso Semanal Remunerado)** obrigatório em 7 dias
  - Limite de **44h semanais** / **220h mensais**
  - **2 horas extras máximas** por dia
  - Trabalho em feriado = dobra ou folga compensatória (flag)
- **Por que é importante**: se o RH se enrola com CLT, a multa é caríssima; vale deixar o sistema como policial

**4. Troca de turno entre colaboradores (com aprovação)**
- Colab A pede troca no mobile → colab B aceita → gerente aprova → escala atualiza + log
- Notificação WhatsApp pros 3 (reaproveita módulo WhatsApp já existente)
- **Por que é importante**: hoje é tudo combinado no grupo de WhatsApp e alguém esquece de atualizar a planilha

### ⭐⭐ Médio impacto

**5. Notificação WhatsApp da escala**
- Todo domingo 20h: dispara pra cada colab sua escala da semana
- Quando tem excessão/mudança: notifica no ato
- Reusa `SellsSync`/whatsapp pattern já existente

**6. Cópia inteligente de mês anterior**
- Botão "Gerar escala de Maio baseada em Abril" — ajusta dias-da-semana automaticamente, preserva preferências, pula feriados
- 80% do trabalho do planejador é "tirar o mês passado e ajustar 2-3 coisas"

**7. Banco de horas**
- Quando diária > contratada, acumula; quando < contratada, desconta
- Mostra saldo no resumo do colab
- Integra com Lançamentos de folha (módulo já existe)

**8. Conflito automático entre abas**
- Se colab tem ASO vencido no dia da escala → alerta amarelo na célula
- Se colab está em férias marcada em outra aba → bloqueia + sugere substituto
- Reusa `rh_asos` / `rh_ferias`

### ⭐ Refinamentos

**9. Preferências do colaborador**
- Campo no cadastro: "domingo preferido de folga", "não quer turno noturno", "aceita plantão de feriado"
- Gerador automático respeita com peso configurável
- Melhora retenção (contratar é caro, manter é barato)

**10. Simulador de cenário**
- "E se o Matheus pedir 15 dias de férias em 10/Mar?" → preview do mês com gaps destacados
- Ajuda a decidir se aprova ou reagenda férias

**11. Escala por setor (não só colab individual)**
- Ver: açougue tem 4 pessoas / precisa 3 | padaria tem 2 / precisa 3
- Transferência temporária entre setores (alguém de padaria cobre frente caixa num dia)
- Reusa `rh_departamentos` que já existe

**12. Auditoria**
- Tabela `rh_escala_audit`: quem mudou, quando, célula antiga → nova, motivo
- Já está no plano LGPD — aproveita o mesmo `audit_logs`

**13. Impressão em formato A3 paisagem**
- A planilha imprime feio (muitas colunas). PDF bem diagramado pro mural da loja

### 🎯 Por onde começar

Sugestão de ordem:

1. **MVP (2-3 semanas)**: turnos + template semanal + grid mensal + eventos (férias/licenças/excessões) + export PDF/Excel = paridade com o Excel
2. **Validação CLT** (+ 3 dias): as regras duras no backend — fica com qualidade > Excel de cara
3. **Heatmap + cruzamento Oracle** (+ 1 semana): começa a entregar valor novo que o Excel não tinha
4. **Troca de turno + WhatsApp** (+ 1 semana): elimina fricção operacional
5. **Gerador automático (LP solver)** (+ 2 semanas): o "clique e faz" que economiza 4h/mês do RH
6. **IA preditiva** (fase 2, meses depois): quando tiver 6+ meses de histórico

## 🔗 Relacionado

- [[rh]] — módulo principal
- [[../padroes/estilo-criacao]] — padrão visual das telas
- [[bipagens]] — fonte de dado pra cruzamento planejado×realizado
- [[marketing-whatsapp]] — reuso pra notificações
- [[lgpd-compliance]] — auditoria unificada

## 🏷️ Tags
#rh #escala #planejamento #pendente #ia-futura

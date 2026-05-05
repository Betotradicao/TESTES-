# Relógio RHID — Dados extraídos do Control iD REP iDClass

**Data da extração:** 2026-05-05
**Cliente:** Tradição Supermercado
**Fonte:** Relógio Control iD REP iDClass (REP-C) em `10.6.1.209:443` (HTTPS)

---

## 1. Equipamento descoberto

| Campo | Valor |
|---|---|
| Modelo | REP iDClass (REP-C) |
| Fabricante | Control iD |
| Host/IP | 10.6.1.209 |
| Porta | 443 (HTTPS) |
| Usuário | admin |
| Senha | admin |
| Número de série | 00014003750276694 |
| Empresa vinculada | TRADIÇÃO SUPERMERCADO LTDA |
| CNPJ | 39.026.607/0001-83 (do AFD) |
| Endereço | R: ANTONIO JULIO CAVALCANTE N132, JARDIM SANTA INÊS |

**Outros relógios identificados (não testados / offline):**
- 10.6.1.208 — Relógio Apoio ADM (TRADIÇÃO ADM) — REP iDClass — NS 00014003750203558 — **inacessível desta rede no teste**
- Terceiro relógio — IP a confirmar

---

## 2. API REST do REP iDClass — endpoints validados

### 2.1 Autenticação

```http
POST https://10.6.1.209/login.fcgi
Content-Type: application/json

{ "login": "admin", "password": "admin" }
```

**Resposta:**
```json
{ "session": "yyQDYFUDaxR4oMFjWPPuNoFN" }
```

A sessão deve ser anexada como query string: `?session=<valor>`

### 2.2 Endpoints válidos (testados e funcionais)

| Endpoint | Método | Retorno |
|---|---|---|
| `/login.fcgi` | POST | Token de sessão |
| `/get_afd.fcgi` | POST | TXT cru (AFD Portaria 1510/2021) — todas as marcações |
| `/load_users.fcgi` | POST | JSON com lista de funcionários ativos no relógio |
| `/load_company.fcgi` | POST | JSON com dados da empresa |

### 2.3 Endpoints **NÃO** disponíveis no REP-C

Testados e retornam `Invalid command`:
- `/load_objects.fcgi` (existe no iDFace, não no REP-C)
- `/get_aej.fcgi`, `/get_afdt.fcgi`, `/get_acjef.fcgi` — formatos consolidados não implementados
- `/load_horarios`, `/load_jornadas`, `/load_departments`, `/load_centros_custo`
- `/get_records`, `/get_logs`, `/get_users`, `/get_employees`

> **Conclusão:** O relógio expõe apenas **dados brutos** (AFD + funcionários + empresa). Jornadas, horários, departamentos e cálculos não são armazenados no equipamento.

---

## 3. Dados extraídos do AFD (Tradição — relógio 10.6.1.209)

**Tamanho do arquivo:** 4,1 MB — 101.372 linhas — histórico de **dez/2022 até maio/2026**

### 3.1 Estatísticas por tipo de registro

| Tipo | Qtd | Conteúdo |
|---|---|---|
| 1 | 1 | Cabeçalho (CNPJ, razão, endereço, CEI) |
| 2 | 8 | Alterações de dados da empresa |
| 3 | **100.112** | **Marcações de ponto (Portaria 1510)** |
| 4 | 41 | Ajustes de hora do REP |
| 5 | 1.029 | Cadastros/alterações de funcionário |
| 6 | 179 | Eventos do relógio (conexões, exportações) |
| F | 1 | Trailer (assinatura) |

### 3.2 Funcionários cadastrados

| Métrica | Valor |
|---|---|
| Total de PIS únicos no histórico | **204** |
| **Funcionários ATIVOS hoje** (última operação = I/A) | **43** ✅ |
| Funcionários inativos (última operação = E) | 161 |

**Regra de status:** o tipo 5 do AFD tem na **posição 23** a operação:
- `I` = Inclusão (admissão / cadastro inicial)
- `A` = Alteração (mudança de dados)
- `E` = Exclusão (demissão / desligamento)

Pegando a **última** operação por PIS (maior NSR), determina-se se o funcionário está ativo ou desligado.

### 3.3 Layout do registro tipo 5 (cadastro de funcionário)

| Posição | Tamanho | Campo |
|---|---|---|
| 1–9 | 9 | NSR (sequencial inviolável) |
| 10 | 1 | Tipo (`5`) |
| 11–18 | 8 | Data (DDMMYYYY) |
| 19–22 | 4 | Hora (HHMM) |
| 23 | 1 | Operação (I / A / E) |
| 24–35 | 12 | PIS (12 dígitos) |
| 36–87 | 52 | Nome (preenchido com espaços à direita) |
| 88+ | — | Demais campos (ID, CPF, etc.) |

**Exemplo real:**
```
000000018|5|12122022|1718|I|016034458022|ANTONIO SILVA SOUZA MACIEL                          |...
```

### 3.4 Layout do registro tipo 3 (marcação de ponto — Portaria 1510)

| Posição | Tamanho | Campo |
|---|---|---|
| 1–9 | 9 | NSR |
| 10 | 1 | Tipo (`3`) |
| 11–18 | 8 | Data (DDMMYYYY) |
| 19–22 | 4 | Hora (HHMM) |
| 23–34 | 12 | PIS |

> Como o relógio está configurado em modo Portaria 1510, **as marcações são tipo 3** (formato curto). Em modo Portaria 671/2021 seriam tipo 7 (formato completo com mais campos).

---

## 4. O que dá pra montar com os dados extraídos

### 4.1 Reproduzir o "espelho de ponto" (Ent.1, Sai.1, Ent.2, Sai.2)

Agrupando marcações por colaborador × dia, ordenando por hora:

- **1ª marcação** → Ent.1
- **2ª marcação** → Sai.1
- **3ª marcação** → Ent.2
- **4ª marcação** → Sai.2

✅ **100% reproduzível direto do AFD.**

### 4.2 Calcular colunas derivadas (já que o relógio não traz prontas)

A partir das batidas + jornada cadastrada do nosso lado:

| Coluna do espelho | Fórmula |
|---|---|
| **Total Normais** | (Sai.1 − Ent.1) + (Sai.2 − Ent.2), limitado à carga horária da jornada |
| **Total Noturnas** | Porção das horas trabalhadas dentro de 22:00 – 05:00 (com adicional 14,29%) |
| **Falta** | Dia útil previsto sem nenhuma marcação |
| **Atraso** | 1ª batida posterior ao horário previsto de entrada |
| **Extra 60% D** | Excedente em dia útil, faixa diurna, até 2h |
| **Extra 100% D** | Trabalho em domingo / feriado |
| **Extra Diurna / Noturna** | Total de horas extras por janela horária |
| **Banco Total / Saldo** | Acúmulo das diferenças entre trabalhado e jornada |

✅ Todas calculáveis com regras CLT padrão.

### 4.3 Lançamentos manuais (não vêm no AFD, ficam no nosso CRUD)

- **Atestado / Médico** — substitui a obrigação de bater ponto naquele dia
- **Abono / Justificativa** — explica falta/atraso para não descontar
- **Folga programada** — definida pela escala
- **Exclusão de marcação** — descarta batida indevida (auditável)

---

## 5. Limitações do AFD (e como contornar)

| O que NÃO tem no AFD | Onde resolver |
|---|---|
| Jornada prevista (07:15–12:00, 13:00–15:35) | Tabela `rh_jornadas` (já existe) |
| Cargo / departamento / centro de custo | `rh_colaboradores` / `rh_departamentos` (já existem) |
| Salário / regime / escala / admissão | `rh_colaboradores` (já existe) |
| Atestados, justificativas, abonos | Novo CRUD `rh_lancamentos` |
| Folgas programadas | Módulo de escala (planejado em `obsidian-vault/modulos/rh-escala-planejamento.md`) |
| Identificação Entrada vs Saída | Inferido pela ordem cronológica do dia |
| Cálculos prontos (Extras, Banco, Atrasos) | Calculadora CLT do nosso lado |

---

## 6. Comparação rápida: AFD bruto vs TXT do software de gestão (YDD/Pontotec)

| | AFD do relógio | TXT layout do software |
|---|---|---|
| **Granularidade** | Cada marcação individual (4 batidas/dia) | Totais consolidados (mensal por evento) |
| **Espelho dia a dia** | ✅ Sim (com cálculo nosso) | ❌ Não — só somatórios |
| **Folha de pagamento** | ✅ Derivado | ✅ Direto (códigos 10/11/12/50) |
| **Dependência** | Só do relógio | Software gestão precisa estar funcionando |
| **Auditoria fiscal MTE** | ✅ Original assinado | ❌ Derivado |

Para reproduzir o espelho diário do print de referência, **o AFD é a fonte certa**.

---

## 7. Amostra real de funcionários ativos extraídos (1ª página)

| PIS | Nome |
|---|---|
| 021067086589 | AFONSO ENRIQUE UCHOAS MONTEIRO |
| 020935222795 | ALANA SANTANA OLIVEIRA |
| 000000636344 | ALEX VALDEZ ROSA |
| 000000575662 | ANA CLARA CARVALHO ALVES |
| 016004141829 | BRUNO HENRIQUE DA SILVA |
| 015452347597 | CAROLINE ROBERTA ESPOSITO DOS SANTOS |
| 020004166684 | CHARLENE APARECIDA DA ROCHA |
| 012975247240 | DIEGO DE SOUZA VIEIRA |
| 020080036354 | EDUARDA DE SOUZA SIFRONE |
| 021026128988 | ELISANGELA SANTOS DE SOUZA |
| 012784343253 | ERINALVA DE MEDEIROS ARAUJO |
| 016311635209 | GABRIEL MARTINS DA SILVA |
| 023733591328 | HELEN BEATRIZ DE SIQUEIRA |
| 014019770413 | HERMESON DA SILVA PROCEL |
| 016309664191 | HILARY KAUANE DE FRANCA DOS SANTOS |
| 012944825080 | IDALMIR DA CRUZ DE JESUS |
| 020019093785 | JULIANO DUARTE CRUZ |
| 023750278624 | MARIA EDUARDA MELO DOS SANTOS |
| 020635314880 | MARIA NACELMA MOREIRA DE QUEIROZ |
| 016450508230 | MELISSA DA ASSUNCAO OLIVEIRA |

… e mais 23 nomes.

---

## 8. Próximos passos sugeridos

1. **Cadastro de relógios** (`rh_relogios`) — multi-equipamento por empresa
2. **Service de sync** — `controlid-rep.service.ts` (login + get_afd + parser)
3. **Tabela `rh_marcacoes`** — uma linha por batida (deduplicada por `relogio_id + nsr`)
4. **Cron incremental** — baixa AFD a cada 15 min e ingere apenas NSRs novos
5. **Vínculo PIS → `rh_colaboradores`** — mapear cadastros do relógio com colaboradores do sistema
6. **Calculadora de apuração diária** — popula `rh_apuracao_diaria` com extras, banco, atrasos
7. **Tela "Espelho de Ponto"** — replica o layout de referência (paginado por colaborador, grid mensal)

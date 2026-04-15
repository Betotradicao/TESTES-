# Radar 360 — Instruções para o Claude

## 🧠 Segundo Cérebro (Obsidian Vault)

Este projeto tem um **vault Obsidian** em `obsidian-vault/` com TODO o conhecimento durável sobre o sistema.

### 📖 SEMPRE no início de CADA chat:
1. **Ler `obsidian-vault/00-INDEX.md`** para ter o mapa geral
2. **Ler `obsidian-vault/_current-work.md`** para saber onde parou a última sessão
3. **Ler a nota específica** do cliente/módulo que o usuário mencionou

### 🗺️ Mapa "menção → nota a abrir":
| Menção | Abra também |
|---|---|
| "SuperVital" | `obsidian-vault/clientes/supervital.md` |
| "Tradição" | `obsidian-vault/clientes/tradicao.md` |
| "Nunes" | `obsidian-vault/clientes/nunes.md` (⚠️ Postgres) |
| "MaxValle" | `obsidian-vault/clientes/maxvalle.md` |
| "deploy" | `obsidian-vault/arquitetura/deploy.md` |
| "Oracle" ou "Intersolid" | `obsidian-vault/arquitetura/oracle-intersolid.md` |
| "mapeamento" ou "MappingService" | `obsidian-vault/arquitetura/mapeamento-tabelas.md` |
| "Gestão Inteligente" | `obsidian-vault/modulos/gestao-inteligente.md` |
| "Compra x Venda" | `obsidian-vault/modulos/compra-venda.md` |
| "Vision" | `obsidian-vault/modulos/vision-palavra-chave.md` |
| "DVR" ou "câmera" | `obsidian-vault/modulos/dvr-cameras.md` |
| "RH" | `obsidian-vault/modulos/rh.md` |

---

## 🛡️ REGRA DE OURO do Vault — "só entra o que precisa re-aprender"

O vault é **ASSET de conhecimento**, não log de atividade. Git guarda histórico, o vault guarda **lições**.

### ✅ SALVAR automaticamente (sem o usuário pedir):
| Tipo | Onde | Critério |
|---|---|---|
| **Particularidade nova de cliente** | `clientes/<cliente>.md` | Atualiza a nota do cliente |
| **Decisão técnica com WHY** | Nota relevante | Incluir o **motivo** da decisão |
| **Bug resolvido com causa-raiz** | `bugs-resolvidos/YYYY-MM-DD-nome.md` | Só bugs com lição reutilizável |
| **Feature relevante** | `bugs-resolvidos/YYYY-MM-feature.md` | Se muda padrão ou arquitetura |
| **Convenção não-óbvia** | `padroes/` ou módulo | Algo que surpreenderia novo dev |
| **Endpoint/tabela/comando crítico** | Arquitetura ou módulo | Erro caro se esquecer |

### ❌ NÃO salvar no vault:
- "Hoje fizemos X" → git log já tem
- Ajustes de UI (cor, padding, typo) → sem lição
- Resultados de queries → dado volátil
- Plano em andamento → usar `_current-work.md`
- Coisas que o código já diz → ler código é mais confiável
- Redundâncias → se já existe nota sobre o assunto, **atualiza**, não cria nova

### 🎯 Pergunta-teste antes de criar nota:
*"Se esquecesse isso em 3 meses, perderia tempo re-descobrindo?"*
- SIM → vai pro vault
- NÃO → não vai

---

## 📝 `_current-work.md` — Rascunho da sessão atual

Arquivo em `obsidian-vault/_current-work.md` com:
- **Tarefa atual** (o que estamos fazendo)
- **Arquivos tocados** nesta sessão
- **Decisões pendentes** (aguardando usuário)
- **Próximo passo**

**Comportamento:**
- **SOBRESCREVE** sempre (não acumula histórico)
- **Atualizar** a cada turno significativo
- **Limpar** (esvaziar/deixar só título) quando a tarefa for 100% concluída
- Se chat quebrar, próximo chat começa lendo este arquivo

---

## 🛠️ Fluxo "Salvar Cedo, Salvar Sempre"

Ao **resolver bug / implementar feature / aprender fato novo**:
1. Terminar a ação
2. **IMEDIATAMENTE** atualizar/criar a nota correspondente no vault (na mesma resposta)
3. Atualizar `_current-work.md`
4. Só então continuar o trabalho ou responder ao usuário

Isso garante que se o chat quebrar **agora**, o próximo chat tem tudo.

---

## 🧹 Manutenção

Uma vez a cada ~30 dias, sugerir ao usuário: *"Quer que eu revise o vault e remova notas obsoletas/redundantes?"*

---

## ⚠️ Regras Críticas do Projeto (atalhos)
- **NUNCA fazer push sem o usuário pedir** — só após ele testar e validar
- **Deploy:** sempre `--no-deps frontend backend`, nunca `down -v`
- **SSH Windows:** usar wrapper PowerShell (ver `obsidian-vault/padroes/regras-ssh-windows.md`)
- **Oracle:** SELECT apenas (usuário POWERBI)
- **Mapeamento:** NUNCA hardcode colunas/tabelas Oracle

## 🤖 Skills Obsidian Instaladas
Skills oficiais do Kepano (CEO do Obsidian) em `.claude/skills/`:
- **obsidian-markdown** — criação padronizada de notas
- **obsidian-cli** — manipular vault via CLI
- **obsidian-bases** — Bases (tabelas filtráveis)
- **defuddle** — extrair web limpo
- **json-canvas** — canvas visuais

## 📁 Estrutura do Projeto
- `packages/frontend/` — React + Vite
- `packages/backend/` — Node.js + Express
- `obsidian-vault/` — 🧠 Segundo cérebro
- `.claude/` — Skills Obsidian + docs antigos
- `InstaladorVPS/` — Scripts de instalação multi-tenant

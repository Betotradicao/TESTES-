# 🚧 Trabalho em Andamento

## 🎯 Status ao encerrar sessão (22/04/2026)

### ✅ Concluído e deployado nesta sessão

**Módulo Check List — grande pacote de funcionalidades:**
- Reset de senha de admin usando senha master (endpoint dedicado, aba "Resetar Senha Admin" em Configurações de REDE)
- Assinatura do auditor obrigatória para finalizar auditoria
- Fix overflow horizontal no mobile em 8 telas do checklist
- Meta de conformidade **por loja** (coluna `companies.meta_checklist`, engrenagem no card Desempenho Geral, input na aba Empresa)
- Dashboards novos: Heatmap Lojas × Roteiros, Evolução Multi-Loja (SVG), Top 10 perguntas com mais NC, reordenação dos cards
- Submenu **Árvore do Conhecimento** (stub "Em construção")
- Filtro por loja aplicado em todas as listas do checklist (templates, auditores, auditados, setores, inspections)
- **Integração WhatsApp completa**:
  - Grupo WhatsApp obrigatório por alternativa de alerta (⚠️ ou ícone `warning_yellow`)
  - Comentário obrigatório ao escolher resposta de alerta
  - Ao finalizar: PDF completo enviado ao grupo configurado no template
  - Cada alerta individual vira mensagem separada com link `/alerta/:token` pro responsável resolver (Previamente/Definitivamente)
  - Página pública `/alerta/:token` com UI mobile
- **Submenu ALERTAS**: tabela com filtros, 5 tiles de resumo, expansão com detalhes + histórico de resoluções
- Módulos CHECK LIST + RH adicionados em ModulosTab e Permissões de Acesso
- Prevenção: adicionados Pendências de Notas, Prioridade Reposição, Prevenção Açougue

**Deploys desta sessão:**
- ✅ Tradição (múltiplos deploys ao longo do dia)
- ✅ Nunes, SuperVital, MaxVale (deploy do pacote grande de WhatsApp + permissões + dashboards)

### 🔜 Pendente pra depois (anotado)

**1. Vision Antifurto — POC de IA própria contra furto** (ver [[modulos/vision-antifurto]])
- Piloto na Tradição com 2 câmeras (DVR já tem túnel ativo — usa RTSP direto)
- Python worker + YOLOv8n + MediaPipe Pose + heurísticas (mão-ao-bolso, agachamento, saída sem PDV)
- Arquitetura event-driven rodando em CPU na VPS atual (~12% de 1 core pra 2 câmeras)
- **Decisões pendentes do usuário antes de começar:**
  1. Quais 2 câmeras (Combo A = gôndola+saída, B = 2 PDVs, C = corredores; recomendado A)
  2. Ângulo das câmeras (precisa ser lateral, não picada do teto)
  3. Quem revisa os alertas nas primeiras 4-6 semanas (feedback loop)
- Cronograma: 4 semanas pra MVP rodando

**2. Opção "Envio em PDF / Mensagem única" por pergunta do Check List**
- Usuário sugeriu radio por pergunta: `( ) PDF  ( ) Msg única`
- Hoje é template-level (grupo único, envia PDF ao finalizar)
- Feature futura: permitir escolher formato de envio por pergunta

**3. Árvore do Conhecimento**
- Submenu criado como stub. Futuro: catálogo de vídeos/links de treinamento por função da loja
- Cada pergunta do checklist poderia ter um vídeo de referência anexado (YouTube não-listado)

### ⚠️ Estado do repositório

Branch `TESTE`, tudo commitado e pushado. Últimos commits:
- `6222ebb` feat(checklist): submenu ALERTAS
- `eacd8d0` revert(checklist): volta ao PDF unico em vez do feed sequencial
- `87e8cb0` feat(checklist): feed WhatsApp sequencial (revertido depois)
- `411a00d` feat(checklist): integracao WhatsApp grande
- `fadb5df` feat(configuracoes): modulos Check List + RH
- `e6da7ba` feat(checklist): Arvore do Conhecimento stub
- `4f5d8a4` feat(checklist): engrenagem meta + reordena cards
- `aff4b23` feat(checklist): meta por loja + heatmap + evolucao + top NC
- `970a6a0` fix(checklist): overflow mobile
- `3083f55` feat(checklist): assinatura auditor obrigatoria
- `22163f2` feat(auth): master reseta senha admin

### 🧠 Aprendizados desta sessão (já salvos em memória)

- Nunca fazer push sem usuário pedir (reforçado em `feedback_no_push.md`)
- Nunca fazer deploy sem pedido explícito — "commit e push" NÃO inclui deploy
- Check List precisa ser filtrado por `cod_loja` em todas as telas, inclusive grupos de acesso do template

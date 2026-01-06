#!/bin/bash

# ============================================
# SCRIPT DE SINCRONIZAÇÃO ENTRE REPOSITÓRIOS
# ============================================
# Sincroniza TESTES- (origin) → NOVO-PREVEN-O (novo-prevencao)
# Mantém backup 100% fiel no repositório NOVO-PREVEN-O

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║        SINCRONIZAR TESTES- → NOVO-PREVEN-O                ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar se estamos no diretório correto
if [ ! -d ".git" ]; then
    echo "❌ Erro: Execute este script na raiz do repositório!"
    exit 1
fi

# Mostrar status atual
echo "📊 Status atual:"
echo "────────────────────────────────────────────────────────────"
git status --short
echo "────────────────────────────────────────────────────────────"
echo ""

# Verificar se há mudanças não commitadas
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Há mudanças não commitadas!"
    echo ""
    read -p "Deseja commitar antes de sincronizar? (s/n): " resposta

    if [ "$resposta" = "s" ] || [ "$resposta" = "S" ]; then
        echo ""
        read -p "Mensagem do commit: " mensagem

        git add -A
        git commit -m "$mensagem

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

        echo "✅ Commit criado!"
        echo ""
    else
        echo "⚠️  Continuando sem commitar..."
        echo ""
    fi
fi

# Push para TESTES- (origin)
echo "📤 Enviando para TESTES- (origin)..."
git push origin main
echo "✅ TESTES- atualizado!"
echo ""

# Push para NOVO-PREVEN-O (novo-prevencao)
echo "📤 Sincronizando para NOVO-PREVEN-O (backup)..."
git push novo-prevencao main --force
echo "✅ NOVO-PREVEN-O sincronizado!"
echo ""

# Mostrar último commit
echo "📋 Último commit sincronizado:"
echo "────────────────────────────────────────────────────────────"
git log -1 --oneline
echo "────────────────────────────────────────────────────────────"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║          ✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📂 Repositórios atualizados:"
echo "   • TESTES-: https://github.com/Betotradicao/TESTES-.git"
echo "   • NOVO-PREVEN-O: https://github.com/Betotradicao/NOVO-PREVEN-O.git"
echo ""

#!/bin/bash

# ============================================
# LISTAR TODOS OS CLIENTES INSTALADOS
# ============================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          CLIENTES INSTALADOS - PREVENÇÃO NO RADAR         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

CLIENTS_DIR="/root/clientes"

if [ ! -d "$CLIENTS_DIR" ]; then
    echo "❌ Nenhum cliente instalado ainda."
    echo "   Execute: curl -sSL https://raw.githubusercontent.com/Betotradicao/TESTES-/TESTE/InstaladorVPS/install-multitenant.sh | bash"
    exit 0
fi

# Listar diretórios de clientes
CLIENTS=$(ls -d $CLIENTS_DIR/*/ 2>/dev/null | xargs -n1 basename)

if [ -z "$CLIENTS" ]; then
    echo "❌ Nenhum cliente instalado ainda."
    exit 0
fi

echo "📋 Clientes encontrados:"
echo ""

for CLIENT in $CLIENTS; do
    CLIENT_DIR="$CLIENTS_DIR/$CLIENT"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🏪 Cliente: $CLIENT"

    # Ler portas do .env
    if [ -f "$CLIENT_DIR/.env" ]; then
        FRONTEND_PORT=$(grep "^FRONTEND_PORT=" "$CLIENT_DIR/.env" | cut -d'=' -f2)
        BACKEND_PORT=$(grep "^BACKEND_PORT=" "$CLIENT_DIR/.env" | cut -d'=' -f2)
        SUBDOMAIN=$(grep "^CLIENT_SUBDOMAIN=" "$CLIENT_DIR/.env" | cut -d'=' -f2)
        HOST_IP=$(grep "^HOST_IP=" "$CLIENT_DIR/.env" | cut -d'=' -f2)

        echo "   🌐 URL: https://$SUBDOMAIN"
        echo "   📱 Acesso direto: http://$HOST_IP:$FRONTEND_PORT"
        echo "   🔌 API: http://$HOST_IP:$BACKEND_PORT"
    fi

    # Status dos containers
    echo ""
    echo "   📦 Status dos containers:"

    cd "$CLIENT_DIR" 2>/dev/null && docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | sed 's/^/      /'

    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🛠️  Comandos úteis:"
echo ""
echo "   Ver logs de um cliente:"
echo "   cd /root/clientes/[nome] && docker compose logs -f"
echo ""
echo "   Reiniciar cliente:"
echo "   cd /root/clientes/[nome] && docker compose restart"
echo ""
echo "   Adicionar novo cliente:"
echo "   curl -sSL https://raw.githubusercontent.com/Betotradicao/TESTES-/TESTE/InstaladorVPS/install-multitenant.sh | bash"
echo ""

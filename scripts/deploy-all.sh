#!/bin/bash

#####################################################################
# DEPLOY AUTOMATIZADO - TODOS OS CLIENTES
# ⚠️  SEGUE RIGOROSAMENTE AS REGRAS DE DEPLOY ⚠️
#
# REGRAS CRÍTICAS APLICADAS:
# ✅ Sempre usa --no-deps (NÃO mexe em PostgreSQL/MinIO)
# ✅ Sempre usa --no-cache (pega código novo)
# ✅ NUNCA recria containers de banco de dados
# ✅ NUNCA usa docker compose down
# ✅ Preserva senhas e dados
# ✅ Detecta clientes DINAMICAMENTE de /root/clientes/
#
# Uso:
#   ./deploy-all.sh                    # Deploy TODOS (frontend+backend)
#   ./deploy-all.sh tradicao           # Deploy apenas Tradição
#   ./deploy-all.sh vital              # Deploy apenas Vital
#   ./deploy-all.sh multmix            # Deploy apenas MultMix
#   ./deploy-all.sh --check            # Apenas verificar status
#   ./deploy-all.sh --frontend         # Deploy apenas frontend
#   ./deploy-all.sh --backend          # Deploy apenas backend
#   ./deploy-all.sh --cron             # Deploy apenas cron
#   ./deploy-all.sh --list             # Listar clientes disponíveis
#
#####################################################################

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuração da VPS 46
VPS_IP="46.202.150.64"
REPO_PATH="/root/prevencao-radar-repo"
BRANCH="TESTE"
CLIENTES_DIR="/root/clientes"

# ============================================
# DETECTAR CLIENTES DINAMICAMENTE
# Lê pastas de /root/clientes/ que contêm docker-compose.yml
# ============================================

detect_clients() {
    local detected=""
    # Se estiver rodando local (via SSH), detectar remotamente
    if [ "$(hostname -I 2>/dev/null | grep -c "$VPS_IP")" -eq 0 ] && [ "$(curl -4 -s ifconfig.me 2>/dev/null)" != "$VPS_IP" ]; then
        # Rodando LOCALMENTE - detectar via SSH
        detected=$(ssh root@$VPS_IP "ls -d $CLIENTES_DIR/*/docker-compose.yml 2>/dev/null" | sed "s|$CLIENTES_DIR/||;s|/docker-compose.yml||" | tr '\n' ' ')
    else
        # Rodando NA VPS - detectar local
        for dir in $CLIENTES_DIR/*/; do
            if [ -f "$dir/docker-compose.yml" ]; then
                cliente=$(basename "$dir")
                detected="$detected $cliente"
            fi
        done
    fi
    echo "$detected"
}

# Detectar clientes
DETECTED_CLIENTS=$(detect_clients)

declare -A CLIENTES
for cliente in $DETECTED_CLIENTS; do
    CLIENTES[$cliente]="$CLIENTES_DIR/$cliente"
done

# Flags
DEPLOY_FRONTEND=true
DEPLOY_BACKEND=true
DEPLOY_CRON=false
CHECK_ONLY=false
LIST_ONLY=false
SPECIFIC_CLIENT=""

# Processar argumentos
for arg in "$@"; do
    case $arg in
        --check)
            CHECK_ONLY=true
            ;;
        --frontend)
            DEPLOY_BACKEND=false
            DEPLOY_CRON=false
            ;;
        --backend)
            DEPLOY_FRONTEND=false
            DEPLOY_CRON=false
            ;;
        --cron)
            DEPLOY_FRONTEND=false
            DEPLOY_BACKEND=false
            DEPLOY_CRON=true
            ;;
        --list)
            LIST_ONLY=true
            ;;
        -*)
            # Ignorar flags desconhecidas
            ;;
        *)
            # Qualquer outro argumento é nome de cliente
            SPECIFIC_CLIENT=$arg
            ;;
    esac
done

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          DEPLOY AUTOMATIZADO - PREVENÇÃO NO RADAR                 ║${NC}"
echo -e "${CYAN}║                                                                   ║${NC}"
echo -e "${CYAN}║  ⚠️  MODO SEGURO: --no-deps ativo (preserva banco de dados)       ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Clientes detectados: ${!CLIENTES[*]}${NC}"
echo ""

# Se for apenas listar, mostrar clientes e sair
if [ "$LIST_ONLY" = true ]; then
    echo -e "${CYAN}Clientes disponíveis:${NC}"
    for cliente in "${!CLIENTES[@]}"; do
        echo -e "   ${GREEN}• $cliente${NC} → ${CLIENTES[$cliente]}"
    done
    echo ""
    exit 0
fi

# Validar cliente específico
if [ -n "$SPECIFIC_CLIENT" ] && [ -z "${CLIENTES[$SPECIFIC_CLIENT]}" ]; then
    echo -e "${RED}❌ Cliente '$SPECIFIC_CLIENT' não encontrado!${NC}"
    echo -e "${YELLOW}Clientes disponíveis: ${!CLIENTES[*]}${NC}"
    exit 1
fi

# Função para verificar status
check_status() {
    echo -e "${BLUE}📊 Verificando status...${NC}"
    echo ""

    # Verificar commits pendentes
    echo -e "${YELLOW}[GIT] Verificando atualizações no branch $BRANCH...${NC}"
    RESULT=$(ssh root@$VPS_IP "cd $REPO_PATH && git fetch origin $BRANCH 2>&1 && git log HEAD..origin/$BRANCH --oneline 2>/dev/null")
    PENDING=$(echo "$RESULT" | grep -v "^From" | grep -v "^$" | grep -v "FETCH_HEAD" | wc -l)

    if [ "$PENDING" -gt 0 ]; then
        echo -e "${RED}   ⚠️  Commits pendentes para atualizar:${NC}"
        ssh root@$VPS_IP "cd $REPO_PATH && git log HEAD..origin/$BRANCH --oneline" 2>/dev/null
    else
        echo -e "${GREEN}   ✅ Código já está atualizado${NC}"
    fi
    echo ""

    # Verificar containers por cliente
    echo -e "${YELLOW}[CONTAINERS] Status dos clientes:${NC}"
    for cliente in "${!CLIENTES[@]}"; do
        if [ -n "$SPECIFIC_CLIENT" ] && [ "$cliente" != "$SPECIFIC_CLIENT" ]; then
            continue
        fi

        echo -e "\n   ${CYAN}=== ${cliente^^} ===${NC}"
        ssh root@$VPS_IP "docker ps --format '   {{.Names}}: {{.Status}}' | grep -E '$cliente' | head -6"
    done
    echo ""
}

# Função para fazer deploy seguindo REGRAS DE DEPLOY
do_deploy() {
    local cliente=$1
    local path=${CLIENTES[$cliente]}

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}🚀 Deploy: ${cliente^^}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # ========================================
    # ⚠️  REGRAS CRÍTICAS DE DEPLOY ⚠️
    # ========================================
    # 1. Sempre usar --no-cache no build
    # 2. Sempre usar --no-deps no up (NÃO mexe em postgres/minio)
    # 3. NUNCA usar docker compose down
    # 4. Especificar QUAL container atualizar
    # ========================================

    if [ "$DEPLOY_FRONTEND" = true ]; then
        echo -e "${YELLOW}[FRONTEND] Build com --no-cache...${NC}"
        ssh root@$VPS_IP "cd $path && docker compose build --no-cache frontend" 2>&1 | tail -3

        echo -e "${YELLOW}[FRONTEND] Up com --no-deps (preserva banco)...${NC}"
        ssh root@$VPS_IP "cd $path && docker compose up -d --no-deps frontend" 2>&1
        echo ""
    fi

    if [ "$DEPLOY_BACKEND" = true ]; then
        echo -e "${YELLOW}[BACKEND] Build com --no-cache...${NC}"
        ssh root@$VPS_IP "cd $path && docker compose build --no-cache backend" 2>&1 | tail -3

        echo -e "${YELLOW}[BACKEND] Up com --no-deps (preserva banco)...${NC}"
        ssh root@$VPS_IP "cd $path && docker compose up -d --no-deps backend" 2>&1
        echo ""
    fi

    if [ "$DEPLOY_CRON" = true ]; then
        echo -e "${YELLOW}[CRON] Build com --no-cache...${NC}"
        ssh root@$VPS_IP "cd $path && docker compose build --no-cache cron" 2>&1 | tail -3

        echo -e "${YELLOW}[CRON] Up com --no-deps (preserva banco)...${NC}"
        ssh root@$VPS_IP "cd $path && docker compose up -d --no-deps cron" 2>&1
        echo ""
    fi

    # Aguardar containers iniciarem
    echo -e "${YELLOW}[VERIFICANDO] Aguardando containers...${NC}"
    sleep 5

    # Verificar logs do backend
    if [ "$DEPLOY_BACKEND" = true ]; then
        echo -e "${YELLOW}[LOGS] Backend (últimas 10 linhas):${NC}"
        ssh root@$VPS_IP "docker logs prevencao-${cliente}-backend --tail 10 2>&1 | grep -E 'Server|Database|Error|error' | head -5"
    fi

    # Limpar cache Docker
    echo -e "${YELLOW}[LIMPEZA] Removendo imagens não utilizadas...${NC}"
    ssh root@$VPS_IP "docker image prune -f" 2>&1 | tail -1

    # Verificar status final
    echo -e "\n${YELLOW}[STATUS] Containers:${NC}"
    ssh root@$VPS_IP "docker ps --format '   {{.Names}}: {{.Status}}' | grep -E '$cliente'"

    echo ""
    echo -e "${GREEN}✅ Deploy $cliente concluído!${NC}"
    echo ""
}

# Verificar status primeiro
check_status

# Se for apenas check, sair aqui
if [ "$CHECK_ONLY" = true ]; then
    exit 0
fi

# Confirmar deploy
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ -n "$SPECIFIC_CLIENT" ]; then
    echo -e "${YELLOW}📦 Cliente: ${SPECIFIC_CLIENT^^}${NC}"
else
    CLIENTS_LIST=$(echo "${!CLIENTES[*]}" | tr ' ' ', ')
    echo -e "${YELLOW}📦 Clientes: TODOS ($CLIENTS_LIST)${NC}"
fi

if [ "$DEPLOY_FRONTEND" = true ] && [ "$DEPLOY_BACKEND" = true ]; then
    echo -e "${YELLOW}🔧 Componentes: Frontend + Backend${NC}"
elif [ "$DEPLOY_FRONTEND" = true ]; then
    echo -e "${YELLOW}🔧 Componentes: Apenas Frontend${NC}"
elif [ "$DEPLOY_CRON" = true ]; then
    echo -e "${YELLOW}🔧 Componentes: Apenas Cron${NC}"
else
    echo -e "${YELLOW}🔧 Componentes: Apenas Backend${NC}"
fi
echo -e "${GREEN}🔒 Modo: SEGURO (--no-deps, preserva banco de dados)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
read -p "Continuar? (s/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${RED}❌ Deploy cancelado${NC}"
    exit 1
fi

# ========================================
# PASSO 1: Atualizar código fonte (git pull)
# ========================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📥 PASSO 1: Atualizando código fonte (git pull)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
ssh root@$VPS_IP "cd $REPO_PATH && git pull origin $BRANCH"
echo ""

# ========================================
# PASSO 2: Deploy de cada cliente
# ========================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📦 PASSO 2: Deploy dos clientes${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for cliente in "${!CLIENTES[@]}"; do
    if [ -n "$SPECIFIC_CLIENT" ] && [ "$cliente" != "$SPECIFIC_CLIENT" ]; then
        continue
    fi
    do_deploy $cliente
done

# ========================================
# RESUMO FINAL
# ========================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ DEPLOY CONCLUÍDO!                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Mostrar status final
echo -e "${BLUE}📊 STATUS FINAL:${NC}"
echo ""
for cliente in "${!CLIENTES[@]}"; do
    if [ -n "$SPECIFIC_CLIENT" ] && [ "$cliente" != "$SPECIFIC_CLIENT" ]; then
        continue
    fi
    echo -e "   ${CYAN}=== ${cliente^^} ===${NC}"
    ssh root@$VPS_IP "docker ps --format '   {{.Names}}: {{.Status}}' | grep -E '$cliente' | grep -E 'frontend|backend|cron'"
done
echo ""
echo -e "${GREEN}🔒 Banco de dados e senhas preservados (--no-deps)${NC}"
echo ""

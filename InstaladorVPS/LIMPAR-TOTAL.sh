#!/bin/bash

###############################################################################
# Script de Limpeza Total e Reinstalação
# Remove TUDO: containers, volumes, imagens, dados
# Use com CUIDADO! Todos os dados serão perdidos!
###############################################################################

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    ⚠️  ATENÇÃO - LIMPEZA TOTAL                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}Este script irá REMOVER:${NC}"
echo "  🗑️  Todos os containers do Docker"
echo "  🗑️  Todos os volumes (banco de dados, MinIO, uploads)"
echo "  🗑️  Todas as imagens Docker do projeto"
echo "  🗑️  Arquivo .env com credenciais"
echo ""
echo -e "${RED}⚠️  TODOS OS DADOS SERÃO PERDIDOS!${NC}"
echo ""
read -p "Tem certeza que deseja continuar? (digite 'SIM' para confirmar): " confirmacao

if [ "$confirmacao" != "SIM" ]; then
    echo -e "${YELLOW}Operação cancelada pelo usuário.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Iniciando limpeza total...${NC}"
echo ""

# 1. Parar e remover containers
echo -e "${YELLOW}[1/6] Parando containers...${NC}"
cd ~/NOVO-PREVEN-O/InstaladorVPS
docker compose -f docker-compose-producao.yml down 2>/dev/null || true
echo -e "${GREEN}✅ Containers parados${NC}"

# 2. Remover volumes
echo -e "${YELLOW}[2/6] Removendo volumes...${NC}"
docker volume rm instaladorvps_postgres-data 2>/dev/null || true
docker volume rm instaladorvps_minio-data 2>/dev/null || true
docker volume rm instaladorvps_backend-uploads 2>/dev/null || true
echo -e "${GREEN}✅ Volumes removidos${NC}"

# 3. Remover imagens do projeto
echo -e "${YELLOW}[3/6] Removendo imagens Docker...${NC}"
docker rmi instaladorvps-backend 2>/dev/null || true
docker rmi instaladorvps-frontend 2>/dev/null || true
docker rmi instaladorvps-cron 2>/dev/null || true
echo -e "${GREEN}✅ Imagens removidas${NC}"

# 4. Limpar imagens órfãs e cache
echo -e "${YELLOW}[4/6] Limpando cache do Docker...${NC}"
docker system prune -f 2>/dev/null || true
echo -e "${GREEN}✅ Cache limpo${NC}"

# 5. Remover arquivo .env
echo -e "${YELLOW}[5/6] Removendo arquivo .env...${NC}"
rm -f ~/NOVO-PREVEN-O/InstaladorVPS/.env
echo -e "${GREEN}✅ Arquivo .env removido${NC}"

# 6. Remover arquivo de credenciais
echo -e "${YELLOW}[6/6] Removendo arquivo de credenciais...${NC}"
rm -f ~/NOVO-PREVEN-O/InstaladorVPS/CREDENCIAIS.txt
echo -e "${GREEN}✅ Arquivo de credenciais removido${NC}"

echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  ✅ LIMPEZA CONCLUÍDA!                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${BLUE}Sistema completamente limpo.${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "  1️⃣  Execute: ${GREEN}sudo ./INSTALAR-AUTO.sh${NC}"
echo "  2️⃣  Aguarde a instalação completa"
echo "  3️⃣  Acesse: ${BLUE}http://$(curl -4 -s ifconfig.me):3000/first-setup${NC}"
echo "  4️⃣  Crie novo usuário administrador"
echo ""

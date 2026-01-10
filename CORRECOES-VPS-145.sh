#!/bin/bash
# Script de correções para VPS 145 - Envio de Bipagens Pendentes
# Execute este script na VPS 145

echo "🚀 Iniciando correções na VPS 145..."
echo ""

# 1. Entrar no diretório do projeto
cd ~/prevencao-no-radar || { echo "❌ Diretório não encontrado"; exit 1; }

echo "📂 Diretório atual: $(pwd)"
echo ""

# 2. Verificar branch atual
CURRENT_BRANCH=$(git branch --show-current)
echo "📌 Branch atual: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "TESTE" ]; then
    echo "⚠️  Mudando para branch TESTE..."
    git checkout TESTE || { echo "❌ Erro ao mudar para branch TESTE"; exit 1; }
fi

echo ""

# 3. Puxar últimas alterações (se necessário)
echo "🔄 Verificando atualizações do repositório..."
git fetch origin
echo ""

# 4. Fazer backup dos arquivos que serão modificados
echo "💾 Criando backup dos arquivos..."
mkdir -p ~/backups/$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups/$(date +%Y%m%d_%H%M%S)

cp packages/backend/src/services/whatsapp.service.ts $BACKUP_DIR/
cp packages/backend/src/index.ts $BACKUP_DIR/
cp packages/backend/src/scripts/seed-configurations.ts $BACKUP_DIR/

echo "✅ Backup salvo em: $BACKUP_DIR"
echo ""

# 5. Aplicar correção no whatsapp.service.ts
echo "🔧 Corrigindo whatsapp.service.ts..."
cat > /tmp/whatsapp-fix.txt << 'EOF'
  /**
   * Envia PDF com bipagens pendentes para o grupo do WhatsApp
   */
  static async sendPendingBipsPDF(bips: Bip[], date: string): Promise<boolean> {
    try {
      console.log(`📄 Gerando PDF com ${bips.length} bipagens pendentes...`);

      // Buscar grupo do WhatsApp específico para Bipagens
      const groupId = await ConfigurationService.get('whatsapp_group_bipagens', null);

      if (!groupId || groupId.trim() === '') {
        console.error('❌ Grupo do WhatsApp para Bipagens não configurado');
        console.error('⚠️  Configure em: Configurações > Grupos WhatsApp > Prevenção Bipagens');
        throw new Error('Grupo do WhatsApp para Bipagens não configurado (whatsapp_group_bipagens)');
      }

      console.log(`✅ Usando grupo configurado para Bipagens: ${groupId}`);
EOF

# Usar sed para substituir a função (encontrar início e fim da função)
# NOTA: Isso é complexo, melhor fazer manualmente ou com editor

echo "⚠️  ATENÇÃO: Edição manual necessária para whatsapp.service.ts"
echo "   Arquivo: packages/backend/src/services/whatsapp.service.ts"
echo "   Linha ~171-200: Substituir a função sendPendingBipsPDF"
echo "   Remover o fallback para evolution_whatsapp_group_id"
echo ""

# 6. Aplicar correção no seed-configurations.ts
echo "🔧 Adicionando campos _name ao seed..."
echo "⚠️  ATENÇÃO: Edição manual necessária para seed-configurations.ts"
echo "   Arquivo: packages/backend/src/scripts/seed-configurations.ts"
echo "   Após linha 286: Adicionar campos _name para cada grupo"
echo ""
echo "   Exemplo:"
echo "   {"
echo "     key: 'whatsapp_group_bipagens_name',"
echo "     value: 'DVR FACIAL',"
echo "     description: 'Nome do grupo WhatsApp para relatórios de Prevenção de Bipagens'"
echo "   },"
echo ""

# 7. Aplicar correção no index.ts
echo "🔧 Adicionando cron job dinâmico ao index.ts..."
echo "⚠️  ATENÇÃO: Edição manual necessária para index.ts"
echo "   Arquivo: packages/backend/src/index.ts"
echo "   Após linha 183: Adicionar o cron job de bipagens pendentes"
echo ""

# 8. Mostrar resumo das alterações necessárias
echo "================================"
echo "📋 RESUMO DAS ALTERAÇÕES"
echo "================================"
echo ""
echo "1️⃣  whatsapp.service.ts (linha ~176)"
echo "   ANTES: Usar fallback para evolution_whatsapp_group_id"
echo "   DEPOIS: Lançar erro se whatsapp_group_bipagens não estiver configurado"
echo ""
echo "2️⃣  seed-configurations.ts (linha ~286)"
echo "   ADICIONAR: Campos _name para cada grupo WhatsApp"
echo "   - whatsapp_group_bipagens_name"
echo "   - whatsapp_group_etiquetas_name"
echo "   - whatsapp_group_rupturas_name"
echo "   - whatsapp_group_quebras_name"
echo "   - whatsapp_group_producao_name"
echo ""
echo "3️⃣  index.ts (linha ~183)"
echo "   ADICIONAR: Cron job que lê horário do banco e respeita timezone Brasil"
echo ""
echo "================================"
echo ""

# 9. Perguntar se quer copiar os arquivos corrigidos
echo "❓ Você tem os arquivos corrigidos localmente?"
echo "   Se SIM, copie-os para a VPS usando scp:"
echo ""
echo "   scp packages/backend/src/services/whatsapp.service.ts root@195.35.44.145:~/prevencao-no-radar/packages/backend/src/services/"
echo "   scp packages/backend/src/index.ts root@195.35.44.145:~/prevencao-no-radar/packages/backend/src/"
echo "   scp packages/backend/src/scripts/seed-configurations.ts root@195.35.44.145:~/prevencao-no-radar/packages/backend/src/scripts/"
echo ""

read -p "Pressione ENTER quando os arquivos estiverem prontos..."

# 10. Rebuild do backend
echo "🔨 Fazendo rebuild do backend..."
cd packages/backend
npm run build || { echo "❌ Erro no build"; exit 1; }
echo "✅ Build concluído"
echo ""

# 11. Reiniciar container do backend
echo "🔄 Reiniciando container do backend..."
docker restart prevencao-backend-prod || { echo "❌ Erro ao reiniciar backend"; exit 1; }
echo "✅ Backend reiniciado"
echo ""

# 12. Verificar logs
echo "📋 Verificando logs do backend..."
sleep 5
docker logs --tail 50 prevencao-backend-prod

echo ""
echo "================================"
echo "✅ CORREÇÕES APLICADAS COM SUCESSO!"
echo "================================"
echo ""
echo "📌 Próximos passos:"
echo "1. Acesse a interface web"
echo "2. Vá em Configurações > Grupos WhatsApp > Prevenção Bipagens"
echo "3. Selecione o grupo correto: # TIME PREVENÇÃO DE PERDAS ❤️"
echo "4. Configure o horário desejado (ex: 11:00)"
echo "5. Salve as configurações"
echo ""
echo "⏰ O envio automático acontecerá no horário configurado (horário do Brasil)"
echo "📱 O PDF será enviado para o grupo configurado"
echo ""

#!/bin/bash

##############################################
# INSTALADOR NGINX PARA DOMÍNIO
# prevencaonoradar.com.br → 31.97.82.235:3000
##############################################

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 INSTALADOR NGINX - Prevenção no Radar"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Instalar Nginx
echo "📦 Instalando Nginx..."
apt update
apt install -y nginx

# 2. Copiar arquivo de configuração
echo "📝 Configurando domínio prevencaonoradar.com.br..."
cp nginx-prevencaonoradar.conf /etc/nginx/sites-available/prevencaonoradar.com.br

# 3. Criar link simbólico (habilitar site)
echo "🔗 Habilitando site..."
ln -sf /etc/nginx/sites-available/prevencaonoradar.com.br /etc/nginx/sites-enabled/

# 4. Remover site padrão (opcional)
echo "🗑️  Removendo site padrão do Nginx..."
rm -f /etc/nginx/sites-enabled/default

# 5. Testar configuração
echo "✅ Testando configuração do Nginx..."
nginx -t

# 6. Reiniciar Nginx
echo "🔄 Reiniciando Nginx..."
systemctl restart nginx
systemctl enable nginx

# 7. Verificar status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ NGINX INSTALADO E CONFIGURADO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Domínio configurado: prevencaonoradar.com.br"
echo "🎯 Apontando para: http://localhost:3000"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1. Configure o DNS no Registro.br:"
echo "   Tipo A: @ → 31.97.82.235"
echo "   Tipo A: www → 31.97.82.235"
echo ""
echo "2. Aguarde propagação DNS (até 48h, geralmente 1-2h)"
echo ""
echo "3. Teste o acesso:"
echo "   http://prevencaonoradar.com.br"
echo "   http://www.prevencaonoradar.com.br"
echo ""
echo "4. (OPCIONAL) Instalar SSL/HTTPS com Let's Encrypt:"
echo "   apt install -y certbot python3-certbot-nginx"
echo "   certbot --nginx -d prevencaonoradar.com.br -d www.prevencaonoradar.com.br"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Exibir status do Nginx
systemctl status nginx --no-pager | head -n 10

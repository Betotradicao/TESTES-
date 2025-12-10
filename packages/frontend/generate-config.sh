#!/bin/sh

# Script para gerar config.js com variáveis de ambiente em runtime
cat > /app/dist/config.js << EOF
window.ENV = {
  VITE_API_URL: "${VITE_API_URL}"
};
EOF

echo "Config generated with VITE_API_URL=${VITE_API_URL}"

# Inicia o servidor
exec serve -s dist -l 3000

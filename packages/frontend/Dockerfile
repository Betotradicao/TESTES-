# ===================================
# STAGE 1: Build
# ===================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci && \
    npm cache clean --force

# Copiar código fonte
COPY . .

# Build do Vite
RUN npm run build

# ===================================
# STAGE 2: Production com Nginx
# ===================================
FROM nginx:alpine

# Copiar build do Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3004 || exit 1

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]

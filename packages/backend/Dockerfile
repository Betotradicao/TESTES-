# ===================================
# STAGE 1: Build
# ===================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependências
RUN npm install && \
    npm cache clean --force

# Copiar código fonte
COPY src ./src

# Build TypeScript
RUN npm install -g typescript && \
    tsc && \
    # Copiar arquivos .js que não são compilados pelo TypeScript
    find src -name "*.js" -exec sh -c 'mkdir -p dist/$(dirname ${1#src/}) && cp "$1" dist/${1#src/}' _ {} \;

# ===================================
# STAGE 2: Production
# ===================================
FROM node:18-alpine

WORKDIR /app

# Instalar apenas dependências de produção
COPY package*.json ./
RUN npm install --omit=dev && \
    npm cache clean --force

# Copiar código compilado do builder
COPY --from=builder /app/dist ./dist

# Copiar migrations
COPY src/migrations ./dist/migrations

# Expor porta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para iniciar
CMD ["node", "dist/index.js"]

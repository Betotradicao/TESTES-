# ===================================
# STAGE 1: Build
# ===================================
FROM node:18-slim AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependências
RUN npm install && \
    npm cache clean --force

# Copiar código fonte
COPY src ./src

# Build TypeScript (usar tsc local do node_modules).
# Apos compilar, copia .js puros (stubs/legacy) usando while read pra evitar
# problemas com escape de \; no find -exec dentro do Dockerfile.
RUN npx tsc && \
    find src -name "*.js" -type f | while read f; do \
      dest="dist/${f#src/}"; \
      mkdir -p "$(dirname "$dest")"; \
      cp "$f" "$dest"; \
    done && \
    mkdir -p dist/templates && cp -r src/templates/. dist/templates/ 2>/dev/null || true

# ===================================
# STAGE 2: Production
# ===================================
FROM node:18-slim

WORKDIR /app

# Instalar dependências do sistema para Oracle Instant Client
RUN apt-get update && apt-get install -y --no-install-recommends \
    libaio1 \
    curl \
    unzip \
    ca-certificates \
    openssh-client \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    # Criar diretório para Oracle Instant Client
    && mkdir -p /opt/oracle \
    && cd /opt/oracle \
    # Download Oracle Instant Client Basic Light (menor tamanho)
    && curl -o instantclient.zip https://download.oracle.com/otn_software/linux/instantclient/2340000/instantclient-basiclite-linux.x64-23.4.0.24.05.zip \
    && unzip instantclient.zip \
    && rm instantclient.zip \
    # Configurar library path
    && echo /opt/oracle/instantclient_23_4 > /etc/ld.so.conf.d/oracle-instantclient.conf \
    && ldconfig

# Configurar variáveis de ambiente para Oracle
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_23_4:$LD_LIBRARY_PATH
ENV ORACLE_HOME=/opt/oracle/instantclient_23_4

# Instalar apenas dependências de produção
COPY package*.json ./
RUN npm install --omit=dev && \
    npm cache clean --force

# Copiar código compilado do builder (inclui migrations já compiladas)
COPY --from=builder /app/dist ./dist

# Criar pastas de uploads necessárias
RUN mkdir -p /app/uploads/temp /app/uploads/images /app/uploads/videos /app/uploads/dvr_images /app/uploads/label-audits

# Expor porta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para iniciar
CMD ["node", "dist/index.js"]

# Feature: Auto-Instalador v5.0 / v5.1 Multi-Tenant

**Data:** 2026-03 (commits `ad51f89`, `28a6e49`)
**Impacto:** Instalação de novos clientes

## 🎯 O que mudou (v5.0)
- Instalador totalmente reformulado para arquitetura multi-tenant
- Clona repo compartilhado `/root/prevencao-radar-repo`
- Cria diretório isolado `/root/clientes/<cliente>/`
- Gera docker-compose.yml e .env específicos
- SSH keys isoladas por cliente
- Nginx reverse proxy + SSL (Certbot) automático
- Registra no `clientes.json`

## 🆕 v5.1 (atualização)
- **Multi-loja** nativo (commit `28a6e49`)
- **pg_trgm** (extensão para busca fuzzy PostgreSQL)
- **Colunas operador** adicionais

## 📦 Comando de instalação
```bash
bash <(curl -s https://raw.githubusercontent.com/Betotradicao/TESTES-/TESTE/InstaladorVPS/install-multitenant.sh)
```

## 🏗️ O que o instalador faz
1. Pede nome do cliente e domínio
2. Calcula portas automaticamente baseado em clientes existentes
3. Clona/atualiza repo compartilhado
4. Cria diretório do cliente com docker-compose.yml e .env
5. Cria diretório `ssh_keys` isolado com chmod 700
6. Build e start dos containers (postgres, minio, backend, frontend, cron)
7. Aguarda PostgreSQL ficar saudável
8. Cria tabelas adicionais (configurations, database_connections + coluna mappings)
9. Configura Nginx reverse proxy com SSL (Certbot)
10. Registra cliente no `clientes.json`
11. Mostra URLs de acesso e credenciais

## 📂 Arquivo
`InstaladorVPS/install-multitenant.sh`

**Compatibilidade:** Envolto em `main()` para funcionar com `curl | bash`

## 🏷️ Tags
#feature #instalador #multi-tenant #devops #2026-03

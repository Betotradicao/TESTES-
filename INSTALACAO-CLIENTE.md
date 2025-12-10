# 🚀 Guia de Instalação para Clientes - Roberto Prevenção no Radar

## 📦 O que você precisa preparar no Pen Drive

### Estrutura do Pen Drive:
```
PEN_DRIVE:\
├── roberto-prevencao-no-radar\        # Pasta completa do projeto
├── instaladores\
│   ├── Docker Desktop Installer.exe   # Baixar de: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
│   └── node-v20.x.x-x64.msi          # Baixar de: https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi (opcional, só se não usar Docker)
├── INSTALAR.bat                       # Script de instalação automática
├── config-cliente.txt                 # Configurações do cliente
└── README.txt                         # Instruções simples
```

---

## 🎯 Processo de Instalação no Cliente

### 1️⃣ Preparação do Pen Drive (VOCÊ FAZ ISSO UMA VEZ)

#### 1.1. Baixar os instaladores:
- **Docker Desktop**: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
- Salvar em `instaladores\Docker Desktop Installer.exe`

#### 1.2. Copiar o projeto completo:
- Copiar toda a pasta `roberto-prevencao-no-radar-main` para o pen drive

#### 1.3. Criar arquivos de instalação:
Os scripts `INSTALAR.bat`, `config-cliente.txt` e outros já foram criados neste projeto.

---

### 2️⃣ No Cliente (O TÉCNICO FAZ ISSO)

#### Opção A: Instalação COMPLETA com Docker (Recomendado) ⭐

1. **Inserir o pen drive** na máquina do cliente
2. **Executar como Administrador**: `INSTALAR.bat`
3. **Preencher dados** quando solicitado:
   - Nome da empresa
   - IP do servidor ERP (Zanthus)
   - Porta do Zanthus
   - Token de API do Zanthus
4. **Aguardar** a instalação (5-15 minutos)
5. **Reiniciar** o computador se solicitado
6. **Pronto!** O sistema estará rodando em: http://localhost:3002

#### Opção B: Instalação SIMPLES sem Docker (Não recomendado)

Se o cliente não puder usar Docker:
1. Executar `INSTALAR-SEM-DOCKER.bat`
2. Isso instalará Node.js e PostgreSQL localmente
3. Mais complexo e requer mais configurações manuais

---

## 🔧 Configurações Personalizadas por Cliente

### Arquivo: `config-cliente.txt`

Este arquivo será preenchido durante a instalação ou você pode pré-configurar:

```ini
# Configurações da Empresa
EMPRESA_NOME=Supermercado Tradicao SJC
EMPRESA_CNPJ=12.345.678/0001-90

# Configurações do Zanthus (ERP)
ZANTHUS_HOST=192.168.1.100
ZANTHUS_PORT=8080
ZANTHUS_TOKEN=seu-token-aqui

# Configurações do Intersolid (Balança)
INTERSOLID_ENABLED=true
INTERSOLID_HOST=192.168.1.101
INTERSOLID_PORT=3000

# Configurações do Evolution API (WhatsApp)
EVOLUTION_ENABLED=false
EVOLUTION_HOST=localhost
EVOLUTION_PORT=8081

# Configurações de Rede
NETWORK_IP=0.0.0.0
FRONTEND_PORT=3002
BACKEND_PORT=3001
DATABASE_PORT=5433
```

---

## 📱 Acesso ao Sistema após Instalação

### URLs de Acesso:
- **Interface Principal**: http://localhost:3002
- **API Backend**: http://localhost:3001
- **Documentação (Swagger)**: http://localhost:8080
- **MinIO (Armazenamento)**: http://localhost:9001

### Login Padrão:
- **Usuário**: `admin@tradicaosjc.com.br`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Trocar a senha padrão após primeiro acesso!

---

## 🔄 Atualização do Sistema

### Para atualizar o sistema em um cliente:

1. **Parar o sistema atual**:
   ```
   cd C:\roberto-prevencao-no-radar
   parar.bat
   ```

2. **Fazer backup do banco de dados**:
   ```
   backup-database.bat
   ```

3. **Copiar nova versão** do pen drive:
   ```
   xcopy /E /I /Y E:\roberto-prevencao-no-radar C:\roberto-prevencao-no-radar-novo
   ```

4. **Restaurar banco de dados**:
   ```
   cd C:\roberto-prevencao-no-radar-novo
   restaurar-database.bat
   ```

5. **Iniciar nova versão**:
   ```
   iniciar.bat
   ```

---

## 🆘 Solução de Problemas

### Problema: Docker não inicia
**Solução**:
1. Verificar se a virtualização está habilitada no BIOS
2. Executar: `bcdedit /set hypervisorlaunchtype auto`
3. Reiniciar o computador

### Problema: Porta 3002 já em uso
**Solução**:
1. Editar `docker-compose.yml`
2. Mudar a porta do frontend de `3002:3000` para `3010:3000`
3. Executar: `docker-compose down && docker-compose up -d`

### Problema: Não consegue conectar ao Zanthus
**Solução**:
1. Verificar firewall do Windows
2. Testar conexão: `telnet 192.168.1.100 8080`
3. Verificar configurações em `packages/backend/.env`

### Problema: Banco de dados não inicia
**Solução**:
1. Verificar logs: `docker-compose logs postgres`
2. Remover volume e recriar: `docker volume rm roberto-prevencao-no-radar_postgres_data`
3. Reiniciar: `docker-compose up -d`

---

## 📞 Suporte

Para suporte técnico:
- **Documentação**: Ver pasta `docs/`
- **Logs**: `docker-compose logs -f`
- **Status**: `docker-compose ps`

---

## 🔒 Segurança

### Checklist de Segurança para Produção:

- [ ] Trocar senha padrão do admin
- [ ] Trocar JWT_SECRET no `.env`
- [ ] Trocar senha do PostgreSQL
- [ ] Trocar credenciais do MinIO
- [ ] Configurar firewall do Windows
- [ ] Habilitar HTTPS (certificado SSL)
- [ ] Configurar backup automático
- [ ] Documentar credenciais do cliente

---

## 📊 Monitoramento

### Verificar saúde do sistema:
```bash
# Ver todos os containers rodando
docker-compose ps

# Ver uso de recursos
docker stats

# Ver logs em tempo real
docker-compose logs -f

# Reiniciar um serviço específico
docker-compose restart backend
```

---

**Criado em**: 2025-12-07
**Versão**: 1.0
**Última atualização**: 2025-12-07

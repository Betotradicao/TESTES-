# Instalador VPS Atualizado - Prevenção no Radar

## 📦 O que inclui

Este instalador **INSTALAR-VPS-ATUALIZADO.sh** baixa automaticamente do GitHub a versão **MAIS RECENTE** do sistema, incluindo:

✅ **Correções de Perdas e Timezone** (últimos 10 commits da VPS 46)
✅ **Melhorias do Instalador VPS** (commits de instalação automática)
✅ **Seed automático do usuário master Roberto**
✅ **Configuração completa do Tailscale**
✅ **Geração automática de senhas seguras**

## 🚀 Como usar

### 1. Conectar na VPS via SSH

```bash
ssh root@SEU_IP_DA_VPS
```

### 2. Baixar e executar o instalador

```bash
curl -fsSL https://raw.githubusercontent.com/Betotradicao/TESTES-/main/INSTALAR-VPS-ATUALIZADO.sh -o instalar.sh
chmod +x instalar.sh
./instalar.sh
```

### 3. Seguir as instruções na tela

O instalador irá:

1. **Detectar automaticamente o IP público da VPS**
2. **Limpar instalações anteriores** (se houver)
3. **Instalar dependências** (Docker, Git, Tailscale)
4. **Configurar Tailscale** - você precisará autenticar no navegador
5. **Solicitar IP Tailscale do cliente** (Windows/ERP)
6. **Baixar código MAIS RECENTE do GitHub**
7. **Gerar senhas seguras aleatórias**
8. **Fazer build dos containers**
9. **Aguardar banco de dados e migrations**
10. **Verificar criação do usuário master Roberto**
11. **Exibir todas as informações e credenciais**

## 📝 Primeiro Acesso

Após a instalação concluir, acesse:

```
http://SEU_IP:3000/first-setup
```

**Preencha:**
- Nome da empresa
- CNPJ
- Endereço
- Credenciais do primeiro usuário administrador

## 👤 Usuário Master (Emergência)

O sistema cria automaticamente o usuário master:

```
Usuário: Roberto
Senha: Beto3107@@##
```

**⚠️ IMPORTANTE:** Use APENAS em caso de emergência! O primeiro acesso deve ser em `/first-setup`.

## 🔐 Credenciais Geradas

Todas as senhas são geradas automaticamente e salvas em:

```
/root/prevencao-instalacao/.env
/root/prevencao-instalacao/INSTALACAO-INFO.txt
```

O instalador exibe no final:
- **PostgreSQL** - Usuário, senha, porta
- **MinIO** - Console, usuário, senha
- **API Token** - Para configurar scanners
- **IP Tailscale** - Da VPS e do cliente

## 🛠️ Comandos Úteis

### Ver logs do backend
```bash
docker logs -f prevencao-backend-prod
```

### Ver status dos containers
```bash
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml ps
```

### Reiniciar sistema
```bash
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml restart
```

### Parar sistema
```bash
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml down
```

## 📊 Versão Instalada

O instalador mostra automaticamente:
- **Commit hash** do código baixado
- **Mensagem do último commit**
- **Últimos 5 commits** incluídos

Todas as informações ficam salvas em:
```
/root/prevencao-instalacao/INSTALACAO-INFO.txt
```

## 🔗 Tailscale

Se o Tailscale não conectar automaticamente:

1. Acesse o link de autenticação exibido pelo instalador
2. Ou execute manualmente:
   ```bash
   sudo tailscale up
   ```

3. Para ver o IP:
   ```bash
   tailscale ip -4
   ```

## ✅ Tudo Pronto!

Seu sistema está rodando com:
- ✅ Frontend: `http://SEU_IP:3000`
- ✅ Backend: `http://SEU_IP:3001`
- ✅ PostgreSQL: `SEU_IP:5434`
- ✅ MinIO Console: `http://SEU_IP:9011`

**Próximo passo:** Acesse `/first-setup` e configure sua empresa!

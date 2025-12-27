# 🚀 Instruções de Instalação na VPS

Guia rápido e direto para instalar o sistema **Prevenção no Radar** em uma VPS Ubuntu.

---

## 📋 Pré-requisitos

- VPS com Ubuntu 20.04 ou superior
- Acesso SSH como root
- Mínimo 2GB RAM, 20GB disco
- Portas liberadas: 3000 (Frontend), 3001 (Backend)

---

## 🔧 Passo 1: Preparar o Repositório GitHub

### **O repositório pode ser público ou privado**

**Se for PÚBLICO:**
- Nada precisa fazer, a instalação funciona direto

**Se for PRIVADO:**
- Você precisará de um Personal Access Token do GitHub
- Crie em: https://github.com/settings/tokens
- Permissões necessárias: `repo` (acesso total ao repositório)

---

## 💻 Passo 2: Conectar na VPS

Abra seu terminal (PowerShell, CMD, PuTTY) e conecte via SSH:

```bash
ssh root@SEU_IP_DA_VPS
```

Exemplo:
```bash
ssh root@46.202.150.64
```

---

## 📦 Passo 3: Instalar o Sistema (Copie e Cole)

### **Opção A: Repositório Público (Recomendado)**

Cole todo este bloco de comandos de uma vez na VPS:

```bash
cd ~ && \
sudo apt-get update -qq && \
sudo apt-get install -y git curl && \
git clone https://github.com/Betotradicao/NOVO-PREVEN-O.git && \
cd ~/NOVO-PREVEN-O/InstaladorVPS && \
chmod +x INSTALAR-AUTO.sh && \
sudo ./INSTALAR-AUTO.sh
```

**📋 Link direto para copiar:**
```
https://raw.githubusercontent.com/Betotradicao/NOVO-PREVEN-O/main/InstaladorVPS/INSTALAR-AUTO.sh
```

**💡 Comando único alternativo (download direto e execução):**
```bash
curl -fsSL https://raw.githubusercontent.com/Betotradicao/NOVO-PREVEN-O/main/InstaladorVPS/INSTALAR-AUTO.sh | sudo bash
```

### **Opção B: Repositório Privado**

Se o repositório for privado, use:

```bash
cd ~ && \
sudo apt-get update -qq && \
sudo apt-get install -y git curl && \
git clone https://SEU_TOKEN@github.com/Betotradicao/NOVO-PREVEN-O.git && \
cd ~/NOVO-PREVEN-O/InstaladorVPS && \
chmod +x INSTALAR-AUTO.sh && \
sudo ./INSTALAR-AUTO.sh
```

**Substitua `SEU_TOKEN` pelo seu Personal Access Token do GitHub**

---

## ⏳ Passo 4: Aguardar Instalação

O instalador irá:

1. ✅ Verificar e instalar Docker
2. ✅ Verificar e instalar Docker Compose
3. ✅ Detectar IP público da VPS
4. 🔗 **Instalar Tailscale** (VPN para acesso às redes locais)
5. 🔐 Gerar senhas seguras automaticamente
6. 📝 Criar arquivo `.env` com todas as configurações
7. 🧹 Limpar containers antigos
8. 🐳 Subir todos os serviços (PostgreSQL, MinIO, Backend, Frontend, Cron)
9. 💾 Salvar credenciais em `CREDENCIAIS.txt`

**Tempo estimado:** 5-10 minutos

---

## 🔑 Passo 5: Anotar Informações Importantes

Ao final da instalação, você verá:

```
╔════════════════════════════════════════════════════════════════╗
║          ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!                  ║
╚════════════════════════════════════════════════════════════════╝

📊 INFORMAÇÕES DO SISTEMA:
─────────────────────────────────────────────────────────────────

🌐 URL de Acesso:
   http://46.202.150.64:3000/first-setup

🔗 Tailscale:
   Status: ✅ Instalado
   IP Tailscale: 100.115.57.78

🔐 Credenciais salvas em:
   ~/NOVO-PREVEN-O/InstaladorVPS/CREDENCIAIS.txt
```

**ANOTE O IP DA VPS:** `46.202.150.64` (exemplo)

---

## 📱 Passo 6: Configurar Tailscale (Primeira Vez)

### **6.1 Autenticar Tailscale na VPS**

Se aparecer um link como este:

```
https://login.tailscale.com/a/abc123def456
```

1. Copie o link
2. Abra no navegador
3. Faça login com seu email (Gmail, Microsoft, etc.)
4. Autorize o dispositivo

### **6.2 Verificar IP do Tailscale**

Após autenticar, execute na VPS:

```bash
tailscale ip -4
```

Você verá algo como: `100.115.57.78`

**Guarde este IP**, você precisará dele depois!

---

## 🌐 Passo 7: Acessar a Aplicação

Abra seu navegador e acesse:

```
http://SEU_IP_DA_VPS:3000
```

Exemplo:
```
http://46.202.150.64:3000
```

**Primeira Vez:** Você será redirecionado para `/first-setup` para criar o usuário administrador.

---

## 🔐 Passo 8: Pegar Token de Autenticação (Para Scanners)

Para configurar os scanners de código de barras nas lojas, você precisa do **API Token**.

### **Opção A: Ver no arquivo de credenciais**

```bash
cat ~/NOVO-PREVEN-O/InstaladorVPS/CREDENCIAIS.txt
```

Procure por:
```
API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Opção B: Ver diretamente no .env**

```bash
cat ~/NOVO-PREVEN-O/InstaladorVPS/.env | grep API_TOKEN
```

**Copie o token inteiro!** Ele é longo, algo como:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTYzOTU5MjAwMH0.abc123def456...
```

---

## 📊 Passo 9: Configurar Scanner nas Lojas

Na máquina do cliente (loja) onde está instalado o **Scanner Service**, preencha:

### **Configuração do Scanner:**

| Campo | Valor | Exemplo |
|-------|-------|---------|
| **IP do Servidor** | IP público da VPS | `46.202.150.64` |
| **Porta do Backend** | Porta do backend | `3001` |
| **Token de Autenticação** | Token copiado do passo 8 | `eyJhbGciOiJIUzI1Ni...` |
| **Nome desta Máquina/Caixa** | Identificador da loja | `CAIXA_01`, `LOJA_CENTRO`, etc. |

### **URL do Webhook gerada:**
```
http://46.202.150.64:3001/api/bipages/webhook
```

---

## 🔗 Passo 10: Configurar Tailscale no Cliente (Acesso às APIs Locais)

Para que a VPS acesse as APIs locais do cliente (Zanthus/Intersolid), você precisa instalar o Tailscale na máquina do cliente.

### **10.1 Baixar e Instalar no Windows do Cliente**

1. Acesse: https://tailscale.com/download/windows
2. Baixe e instale
3. Faça login com o **MESMO EMAIL** usado na VPS

### **10.2 Descobrir a Rede Local**

No Windows do cliente, abra **CMD** e execute:

```bash
ipconfig
```

Procure por **"Endereço IPv4"**, exemplo:
```
Endereço IPv4: 10.6.1.102
```

**Converta para rede:**
- Se o IP for `10.6.1.102` → Use `10.6.1.0/24`
- Se o IP for `192.168.1.50` → Use `192.168.1.0/24`
- Se o IP for `192.168.0.100` → Use `192.168.0.0/24`

### **10.3 Compartilhar a Rede Local**

No Windows do cliente, abra **PowerShell como Administrador** (Windows + X → PowerShell Admin):

```powershell
tailscale up --advertise-routes=10.6.1.0/24 --accept-routes
```

**Substitua `10.6.1.0/24` pela rede que você descobriu!**

### **10.4 Aprovar Rota no Painel Tailscale**

1. Acesse: https://login.tailscale.com/admin/machines
2. Encontre a máquina do cliente na lista
3. Clique nos **3 pontinhos (⋮)** → **"Edit route settings"**
4. Marque a checkbox da rede (ex: `10.6.1.0/24`)
5. Clique em **"Approve"**

### **10.5 Testar Conexão**

Na VPS, teste se consegue acessar a rede local:

```bash
curl http://10.6.1.102:3003
```

Se retornar dados (mesmo que erro 401 ou 404), está funcionando! ✅

---

## ⚙️ Passo 11: Configurar APIs na Aplicação Web

Acesse a aplicação: `http://46.202.150.64:3000`

Vá em: **Configurações → APIs**

### **Zanthus:**
```
URL da API: http://10.6.1.101
Porta: (vazio ou porta correta)
```

### **Intersolid:**
```
URL da API: http://10.6.1.102
Porta: 3003
Usuário: ROBERTO
Senha: 312013@#
```

**Salve e teste a conexão!**

---

## 🔑 Liberar Acesso Automático do Claude (Para Novas VPS)

Se você instalou o sistema em uma nova VPS e quer que o Claude possa acessar e atualizar automaticamente, siga estes passos:

### **Passo 1: Conectar na VPS via Painel Hostinger**

1. Acesse o painel da Hostinger
2. Vá em **VPS** → Selecione a VPS
3. Clique em **Terminal** ou **Console**
4. Faça login como **root**

### **Passo 2: Adicionar Chave SSH do Claude**

Cole este comando de uma vez no terminal da VPS:

```bash
mkdir -p ~/.ssh && echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCY9VO8bBWSHIscv4nbG9AK1UQY58nwhp35lipY2x5cv9Z//cZR8TX5YGC6bjo1/2Q4Voue/NWSjC//JlmCFuitC7fqMjXL+s/1WDEdhHjsUNczxrBm1siD17Qghsq4XR+rRN0jAafjK/6uNZZLaHekaoK/QPZ05YZsQH/lAr57vtwDRNjrp77H0Du2sPcwQ/xuguSkjVavGYK0DLLxq8aU4f4WfU9ynatsBsrTk1gAFPqFF+ExcVyYNFW2y3Wv1IGmpqFvtUyQ350CEvoZBDdB0qBzijRCT98n2H1xw+wmF5b7fehQmvxaoqBDkjvBiE60yCOyuVRINT/zUhl3jrLnjvo5gpXjR+f1lNvLvx9NXDc03UyVxtGtGJZyC6r3edMy+xhFtefP63Oyi+2sOc4TbDAQlVMCArvKbl2eRgh2OStB8z19jHJHkFtjo9jKlx9hMiT3yeBtuYNRnAKmn2I6aN5HAPiAa1R7uVSEbfKKO4RBnDLQN1F+7CzVNkEvF6b6eBdyMjEjVbOMmj9GtvPSTYtPLCNRygvN2ppr0CXRW+sCXSq3nYj6CNmCxBPmjtpDmefAHUbchjcSML+yHGcKnWen+9Fvz2GCRwYWLVW7D5sFUAUsXfqGzZNQ/YyO/IIxPVlqHGZs3lOiQgrUYyhEdJefcIFzLamI68W14SwSkw== Administrator@SRV_TRADICAO' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && echo 'Chave SSH adicionada com sucesso!'
```

### **Passo 3: Verificar se Funcionou**

Se aparecer a mensagem:
```
Chave SSH adicionada com sucesso!
```

**Pronto!** O Claude agora pode acessar e atualizar a VPS automaticamente sem pedir senha.

### **Nota Importante:**

- Este comando adiciona a chave SSH pública do Claude à VPS
- Depois disso, o Claude pode executar comandos remotamente
- É seguro porque apenas adiciona uma chave de leitura/execução, não compartilha senhas
- A chave é específica do computador do administrador

---

## 🔄 Comandos Úteis

### **Ver logs dos containers:**
```bash
# Frontend
docker logs prevencao-frontend-prod --tail 50

# Backend
docker logs prevencao-backend-prod --tail 50

# Banco de dados
docker logs prevencao-postgres-prod --tail 50
```

### **Reiniciar serviços:**
```bash
cd ~/NOVO-PREVEN-O/InstaladorVPS
sudo docker compose -f docker-compose-producao.yml restart
```

### **Parar todos os serviços:**
```bash
cd ~/NOVO-PREVEN-O/InstaladorVPS
sudo docker compose -f docker-compose-producao.yml down
```

### **Subir todos os serviços:**
```bash
cd ~/NOVO-PREVEN-O/InstaladorVPS
sudo docker compose -f docker-compose-producao.yml up -d
```

### **Ver status dos containers:**
```bash
docker ps
```

### **Ver IP da VPS:**
```bash
curl -4 ifconfig.me
```

### **Ver IP do Tailscale:**
```bash
tailscale ip -4
```

### **Ver credenciais:**
```bash
cat ~/NOVO-PREVEN-O/InstaladorVPS/CREDENCIAIS.txt
```

---

## 🆘 Troubleshooting

### **Containers unhealthy:**
```bash
# Reinicie os containers
cd ~/NOVO-PREVEN-O/InstaladorVPS
sudo docker compose -f docker-compose-producao.yml restart backend frontend
```

### **Não consigo acessar a aplicação:**
```bash
# Verifique se as portas estão abertas no firewall
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
```

### **Esqueci as credenciais:**
```bash
cat ~/NOVO-PREVEN-O/InstaladorVPS/CREDENCIAIS.txt
```

### **Preciso reinstalar do zero:**
```bash
cd ~/NOVO-PREVEN-O/InstaladorVPS
chmod +x LIMPAR-TOTAL.sh
sudo ./LIMPAR-TOTAL.sh
sudo ./INSTALAR-AUTO.sh
```

---

## 📞 Suporte

Se encontrar problemas, verifique:
1. Logs dos containers (comandos acima)
2. Arquivo de credenciais: `~/NOVO-PREVEN-O/InstaladorVPS/CREDENCIAIS.txt`
3. Status do Tailscale: `tailscale status`

---

**✅ Instalação concluída!** Agora você pode usar o sistema normalmente.

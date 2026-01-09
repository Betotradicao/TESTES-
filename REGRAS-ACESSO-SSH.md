# 🔐 REGRAS DE ACESSO SSH - Como Claude Acessa a VPS

## 📖 O Que É SSH?

SSH (Secure Shell) é um protocolo que permite acessar um computador remotamente de forma segura. É como se você estivesse sentado na frente do servidor, mas está na verdade no seu computador.

---

## 🔑 Como Funciona o Acesso SSH

### 1. **Chaves SSH (Arquivos de Segurança)**

Ao invés de usar senha toda vez, o SSH usa "chaves" - arquivos especiais que funcionam como uma impressão digital única:

- **Chave Privada** (fica no SEU computador) = Sua identidade secreta
- **Chave Pública** (fica na VPS) = Cadeado que só sua chave abre

**Localização das chaves:**
```
C:\Users\Administrator\.ssh\vps_prevencao      (chave privada)
C:\Users\Administrator\.ssh\vps_prevencao.pub  (chave pública)
```

### 2. **Arquivo de Configuração SSH**

O arquivo `~/.ssh/config` guarda "atalhos" para acessar servidores:

```
Host vps-145
    HostName 145.223.92.152
    User root
    IdentityFile ~/.ssh/vps_prevencao
    StrictHostKeyChecking no
```

**O que significa:**
- `Host vps-145` = Apelido do servidor (posso digitar apenas "vps-145" ao invés do IP)
- `HostName 145.223.92.152` = Endereço IP real da VPS
- `User root` = Usuário que vai logar (root = administrador)
- `IdentityFile` = Qual chave usar para autenticar
- `StrictHostKeyChecking no` = Não perguntar "tem certeza?" toda vez

---

## 🤖 Como Claude (IA) Acessa a VPS

### Passo a Passo do Que Acontece:

1. **Claude identifica que precisa acessar a VPS**
   - Exemplo: Usuário pede "faça deploy do backend"

2. **Claude usa a ferramenta Bash com comando SSH:**
   ```bash
   ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "comando aqui"
   ```

3. **O que acontece por baixo dos panos:**
   - Sistema operacional lê a chave privada `vps_prevencao`
   - Conecta no servidor 145.223.92.152
   - Envia a chave para autenticar
   - Servidor valida se a chave pública correspondente existe
   - Se validar, libera acesso como usuário `root`
   - Executa o comando solicitado
   - Retorna o resultado para Claude

4. **Claude recebe o resultado e continua o trabalho**

---

## 🛠️ Exemplos Práticos

### Exemplo 1: Ver containers rodando na VPS
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker ps"
```

**O que acontece:**
1. SSH conecta na VPS
2. Executa `docker ps` (lista containers)
3. Retorna a lista de containers
4. Desconecta

### Exemplo 2: Fazer git pull e rebuild
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend"
```

**O que acontece:**
1. SSH conecta na VPS
2. Navega para `/root/prevencao-radar-install`
3. Executa `git pull` (baixa código novo)
4. Navega para `InstaladorVPS`
5. Rebuilda imagem do backend
6. Retorna resultado de cada comando
7. Desconecta

### Exemplo 3: Verificar logs do backend
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker logs prevencao-backend-prod --tail 50"
```

**O que acontece:**
1. SSH conecta na VPS
2. Executa comando docker logs
3. Retorna últimas 50 linhas de log
4. Desconecta

---

## 🔒 Segurança

### Por Que É Seguro?

1. **Chave Privada NUNCA sai do computador**
   - Apenas a "assinatura" é enviada
   - Impossível copiar a chave pela rede

2. **Conexão Criptografada**
   - Tudo que trafega é criptografado
   - Ninguém consegue "espiar" os comandos

3. **Chave é Única**
   - Cada computador tem sua própria chave
   - Se alguém roubar a chave, você pode revogar na VPS

### Permissões da Chave

A chave privada tem permissões especiais no Windows:
```
Somente o usuário Administrator pode ler
Ninguém mais tem acesso
```

---

## 📁 Estrutura de Arquivos SSH

```
C:\Users\Administrator\.ssh\
├── config                    # Configurações de atalhos
├── vps_prevencao             # Chave PRIVADA (NUNCA compartilhar!)
├── vps_prevencao.pub         # Chave PÚBLICA (pode ser compartilhada)
├── known_hosts               # Lista de servidores conhecidos
└── ...outras chaves...
```

---

## 🎯 Por Que Claude Consegue Acessar?

Claude tem acesso porque:

1. **Roda no SEU computador** (Windows SRV_TRADICAO)
2. **Tem permissão para ler arquivos** do sistema
3. **Pode executar comandos** via ferramenta Bash
4. **Lê as chaves SSH** em `~/.ssh/`
5. **Usa as chaves para autenticar** na VPS

**Claude NÃO:**
- Copia suas chaves
- Guarda credenciais
- Acessa outros servidores sem permissão
- Modifica arquivos sem você pedir

---

## 🔧 Comandos Úteis SSH

### Testar conexão SSH:
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "echo 'Conectou!'"
```

### Ver quem está logado na VPS:
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "who"
```

### Ver quanto de memória/CPU está usando:
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "free -h && df -h"
```

### Copiar arquivo da VPS para seu computador:
```bash
scp -i ~/.ssh/vps_prevencao root@145.223.92.152:/root/arquivo.txt ./
```

### Copiar arquivo do seu computador para VPS:
```bash
scp -i ~/.ssh/vps_prevencao ./arquivo.txt root@145.223.92.152:/root/
```

---

## ⚠️ NUNCA FAÇA:

1. ❌ Compartilhar a chave privada (`vps_prevencao`)
2. ❌ Postar a chave no GitHub/Discord/WhatsApp
3. ❌ Dar permissão de escrita para outros usuários
4. ❌ Copiar a chave para USB sem criptografia
5. ❌ Usar a mesma chave em múltiplos servidores

---

## 🆘 Se Perder Acesso SSH

Se a chave for perdida ou corrompida:

```bash
# 1. Gerar nova chave
ssh-keygen -t rsa -b 4096 -f ~/.ssh/vps_prevencao_nova

# 2. Acessar VPS via painel web da Hostinger/Digital Ocean

# 3. Adicionar nova chave pública no servidor:
echo "conteúdo da vps_prevencao_nova.pub" >> ~/.ssh/authorized_keys

# 4. Testar nova chave
ssh -i ~/.ssh/vps_prevencao_nova root@145.223.92.152

# 5. Se funcionar, remover chave antiga
rm ~/.ssh/vps_prevencao ~/.ssh/vps_prevencao.pub
mv ~/.ssh/vps_prevencao_nova ~/.ssh/vps_prevencao
```

---

## 📝 Resumo Simples

**SSH é como:**
- Ter uma chave mágica que abre a porta da VPS
- A chave fica guardada no seu computador
- Claude usa essa chave para entrar e fazer alterações
- Tudo é seguro e criptografado
- Claude só faz o que você pedir

**Analogia:**
```
Você = Dono da casa
VPS = Casa
Chave SSH = Chave da casa
Claude = Assistente que você deu a chave para fazer tarefas
```

---

**Última atualização:** 09/01/2026
**Criado para:** Explicar como funciona acesso SSH de forma clara e didática

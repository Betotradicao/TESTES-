# ✅ Checklist de Instalação em Cliente - Roberto Prevenção no Radar

## 📦 Preparação do Pen Drive (VOCÊ FAZ UMA VEZ)

### Downloads Necessários:

- [ ] **Docker Desktop Installer**
  - URL: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
  - Salvar em: `instaladores\Docker Desktop Installer.exe`
  - Tamanho: ~500MB

- [ ] **Projeto Completo**
  - Copiar toda a pasta `roberto-prevencao-no-radar-main`
  - Incluir todos os arquivos e subpastas
  - Verificar se os scripts `.bat` estão presentes

### Estrutura Final do Pen Drive:

```
E:\
├── roberto-prevencao-no-radar-main\
│   ├── packages\
│   ├── docker-compose.yml
│   ├── INSTALAR.bat ✨
│   ├── iniciar.bat
│   ├── parar.bat
│   ├── restart.bat
│   ├── logs.bat
│   ├── configurar-firewall.bat
│   ├── backup-database.bat
│   ├── README-INSTALACAO.txt
│   ├── INSTALACAO-CLIENTE.md
│   ├── INSTALACAO-MULTIPLAS-MAQUINAS.md
│   └── ...
└── instaladores\
    └── Docker Desktop Installer.exe
```

---

## 🏢 Instalação em Cliente - Máquina ÚNICA

Use este checklist quando o cliente tem **apenas 1 máquina**.

### Antes de Ir ao Cliente:

- [ ] Pen drive preparado com todos os arquivos
- [ ] Anotar dados do cliente:
  - [ ] Nome da empresa
  - [ ] CNPJ
  - [ ] IP do servidor Zanthus
  - [ ] Porta do Zanthus (geralmente 8080)
  - [ ] Token da API do Zanthus

### No Cliente:

#### 1. Pré-Instalação
- [ ] Verificar Windows 10/11 (64-bit)
- [ ] Verificar espaço em disco (mínimo 10GB livres)
- [ ] Verificar conexão com internet
- [ ] Obter privilégios de Administrador

#### 2. Instalação
- [ ] Inserir pen drive
- [ ] Clicar com **botão direito** em `INSTALAR.bat`
- [ ] Selecionar **"Executar como Administrador"**
- [ ] Preencher dados quando solicitado:
  - [ ] Nome da empresa
  - [ ] CNPJ
  - [ ] IP do Zanthus
  - [ ] Porta do Zanthus
  - [ ] Token do Zanthus
- [ ] Aguardar instalação (5-15 minutos)
- [ ] Se solicitado, reiniciar o computador
- [ ] Após reiniciar, executar `INSTALAR.bat` novamente (se necessário)

#### 3. Verificação
- [ ] Navegador abriu automaticamente em `http://localhost:3002`
- [ ] Tela de login apareceu
- [ ] Fazer login com:
  - Usuário: `admin@tradicaosjc.com.br`
  - Senha: `admin123`
- [ ] Sistema carregou corretamente
- [ ] Testar navegação pelas telas

#### 4. Configuração Inicial
- [ ] **TROCAR SENHA DO ADMIN** (OBRIGATÓRIO!)
- [ ] Criar usuários adicionais se necessário
- [ ] Cadastrar setores
- [ ] Cadastrar colaboradores
- [ ] Testar simulador de bipagens

#### 5. Testes
- [ ] Simular uma bipagem no sistema
- [ ] Verificar se aparece em "Bipagens Ao Vivo"
- [ ] Testar simulador de venda/conciliação
- [ ] Gerar um relatório básico

#### 6. Finalização
- [ ] Anotar dados de acesso para o cliente
- [ ] Criar atalho na área de trabalho
- [ ] Orientar cliente sobre uso básico
- [ ] Deixar cópia dos arquivos de instalação

---

## 🖥️🖥️ Instalação em Cliente - MÚLTIPLAS MÁQUINAS

Use este checklist quando o cliente tem **2+ máquinas**.

### Cenário:
- **Máquina 1 (SERVIDOR)**: Recebe bipagens dos scanners
- **Máquina 2 (CLIENTE)**: Visualiza vendas e relatórios
- **Máquinas 3, 4, N**: Podem acessar também

---

### MÁQUINA 1 - SERVIDOR (Com Scanners)

#### 1. Instalação do Sistema
- [ ] Inserir pen drive
- [ ] Executar `INSTALAR.bat` como Administrador
- [ ] Preencher dados da empresa
- [ ] Aguardar instalação completa

#### 2. Configurar IP Fixo
- [ ] Anotar IP atual: ________________
- [ ] Configurar IP fixo (ex: 192.168.1.100):
  - [ ] Painel de Controle → Rede
  - [ ] Propriedades do Adaptador
  - [ ] IPv4 → Propriedades
  - [ ] Usar o seguinte endereço IP:
    - IP: `192.168.1.100`
    - Máscara: `255.255.255.0`
    - Gateway: `192.168.1.1`
    - DNS: `8.8.8.8`
- [ ] Testar conexão (ping google.com)

#### 3. Configurar Firewall
- [ ] Executar `configurar-firewall.bat` como Administrador
- [ ] Verificar se regras foram criadas
- [ ] Anotar IP da máquina mostrado no script

#### 4. Teste Local
- [ ] Acessar: `http://localhost:3002`
- [ ] Fazer login
- [ ] Sistema funcionando OK

#### 5. Teste de Rede (da própria máquina)
- [ ] Acessar: `http://192.168.1.100:3002`
- [ ] Fazer login
- [ ] Sistema funcionando OK

---

### MÁQUINA 2 - CLIENTE (Visualização)

#### 1. Verificação de Rede
- [ ] Fazer ping para o servidor:
  ```
  ping 192.168.1.100
  ```
- [ ] Deve responder com sucesso

#### 2. Testar Backend
- [ ] Abrir navegador
- [ ] Acessar: `http://192.168.1.100:3001/api/health`
- [ ] Deve mostrar: `{"status":"ok"}`

#### 3. Acessar Sistema
- [ ] Abrir navegador
- [ ] Acessar: `http://192.168.1.100:3002`
- [ ] Fazer login:
  - Usuário: `admin@tradicaosjc.com.br`
  - Senha: `admin123`
- [ ] Sistema funcionando OK

#### 4. Criar Atalho
- [ ] Botão direito na área de trabalho
- [ ] Novo → Atalho
- [ ] Colar: `http://192.168.1.100:3002`
- [ ] Nomear: "Roberto Prevenção"
- [ ] Testar atalho

#### 5. Criar Usuário Específico (Opcional)
- [ ] No sistema (logado como admin)
- [ ] Configurações → Colaboradores
- [ ] Adicionar usuário para esta máquina
- [ ] Definir permissões apropriadas

---

### MÁQUINAS 3, 4, N... (Mais Clientes)

Repetir passos da **MÁQUINA 2** para cada máquina adicional.

---

## 🔧 Configurações Especiais

### Se o cliente usar Intersolid (Balança):

- [ ] Na Máquina 1, editar `packages/backend/.env`
- [ ] Configurar:
  ```
  INTERSOLID_ENABLED=true
  INTERSOLID_HOST=192.168.1.XXX
  INTERSOLID_PORT=3000
  ```
- [ ] Reiniciar sistema: `restart.bat`

### Se o cliente usar Evolution API (WhatsApp):

- [ ] Na Máquina 1, editar `packages/backend/.env`
- [ ] Configurar:
  ```
  EVOLUTION_ENABLED=true
  EVOLUTION_HOST=192.168.1.XXX
  EVOLUTION_PORT=8081
  EVOLUTION_API_TOKEN=seu-token
  ```
- [ ] Reiniciar sistema: `restart.bat`

---

## 🆘 Problemas Comuns

### ❌ "Docker não inicia"
- [ ] Verificar virtualização habilitada no BIOS
- [ ] Executar como Admin: `bcdedit /set hypervisorlaunchtype auto`
- [ ] Reiniciar computador

### ❌ "Não consigo acessar de outra máquina"
- [ ] Verificar firewall está configurado (`configurar-firewall.bat`)
- [ ] Testar ping entre máquinas
- [ ] Verificar se IP está correto
- [ ] Verificar se Docker está rodando no servidor

### ❌ "Sistema lento"
- [ ] Verificar recursos do computador (RAM, CPU)
- [ ] Fechar programas desnecessários
- [ ] Considerar aumentar recursos do Docker Desktop

### ❌ "Erro ao conectar com Zanthus"
- [ ] Verificar IP e porta do Zanthus
- [ ] Testar conexão: `telnet 192.168.1.XXX 8080`
- [ ] Verificar firewall do servidor Zanthus
- [ ] Verificar token da API

---

## 📋 Informações para Deixar com o Cliente

### Dados de Acesso:
```
Sistema: Roberto Prevenção no Radar
URL: http://localhost:3002 (ou http://192.168.1.100:3002)

Login Padrão:
  Usuário: admin@tradicaosjc.com.br
  Senha: [ANOTAR NOVA SENHA APÓS TROCAR]

Instalado em: ___/___/2025
Instalado por: _______________
```

### Comandos Úteis:
```
Iniciar sistema:  C:\roberto-prevencao-no-radar\iniciar.bat
Parar sistema:    C:\roberto-prevencao-no-radar\parar.bat
Ver logs:         C:\roberto-prevencao-no-radar\logs.bat
Fazer backup:     C:\roberto-prevencao-no-radar\backup-database.bat
```

### Contatos de Suporte:
```
Técnico: ______________
Telefone: ______________
Email: ______________
```

---

## ✅ Assinatura de Conclusão

**Cliente**: _______________________________________________

**Técnico**: _______________________________________________

**Data**: ___/___/2025

**Observações**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

**Versão do Checklist**: 1.0
**Última Atualização**: 2025-12-07

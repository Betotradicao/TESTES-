# 🖥️ Instalação em Múltiplas Máquinas - Roberto Prevenção no Radar

## 📋 Cenário do Cliente

**Situação**: Cliente possui 2 (ou mais) máquinas

- **Máquina 1**: Onde os scanners/leitores de barcode estão conectados (Recebe bipagens)
- **Máquina 2**: Apenas para visualizar vendas e relatórios (Gerência)

---

## ✅ Solução Recomendada: Arquitetura Cliente-Servidor

### 🖥️ Máquina 1 - SERVIDOR (Recepção + Backend)

**Função**:
- Servidor principal do sistema
- Recebe bipagens dos scanners
- Processa dados
- Armazena banco de dados

**O que instalar**:
```
✅ Sistema COMPLETO:
   - Backend (API)
   - Frontend (Interface)
   - PostgreSQL (Banco de Dados)
   - MinIO (Armazenamento)
```

**Instalação**:
1. Execute `INSTALAR.bat` nesta máquina
2. Configure um **IP FIXO** para esta máquina (ex: `192.168.1.100`)

**Configurar IP Fixo no Windows**:
```
1. Painel de Controle → Rede e Internet → Central de Rede e Compartilhamento
2. Alterar configurações do adaptador
3. Botão direito no adaptador → Propriedades
4. IPv4 → Propriedades
5. Usar o seguinte endereço IP:
   - IP: 192.168.1.100
   - Máscara: 255.255.255.0
   - Gateway: 192.168.1.1
   - DNS: 8.8.8.8
```

---

### 💻 Máquina 2 - CLIENTE (Apenas Visualização)

**Função**:
- Visualizar vendas e bipagens
- Gerar relatórios
- Gerenciar sistema

**O que instalar**:
```
❌ NADA! Apenas usar o navegador!
```

**Como acessar**:
1. Abrir navegador (Chrome, Edge, Firefox)
2. Digitar na barra de endereços:
   ```
   http://192.168.1.100:3002
   ```
   (Onde `192.168.1.100` é o IP da Máquina 1)

3. Fazer login normalmente:
   - Usuário: `admin@tradicaosjc.com.br`
   - Senha: `admin123`

4. **Criar um atalho na área de trabalho** (Opcional):
   - Botão direito na área de trabalho → Novo → Atalho
   - Colar: `http://192.168.1.100:3002`
   - Nomear: "Roberto Prevenção"
   - Definir ícone personalizado (se desejar)

---

## 🔧 Configuração do Sistema para Acesso em Rede

### Passo 1: Configurar Firewall no SERVIDOR (Máquina 1)

Execute este comando como Administrador no PowerShell:

```powershell
# Permitir acesso ao Frontend (porta 3002)
New-NetFirewallRule -DisplayName "Roberto - Frontend" -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Allow

# Permitir acesso ao Backend (porta 3001)
New-NetFirewallRule -DisplayName "Roberto - Backend" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow

# Permitir acesso ao MinIO (porta 9001)
New-NetFirewallRule -DisplayName "Roberto - MinIO" -Direction Inbound -Protocol TCP -LocalPort 9001 -Action Allow
```

OU manualmente:
```
1. Painel de Controle → Firewall do Windows → Configurações Avançadas
2. Regras de Entrada → Nova Regra
3. Porta → Avançar
4. TCP → Portas específicas: 3001, 3002, 9001
5. Permitir conexão → Avançar
6. Nome: "Roberto Prevenção no Radar"
```

### Passo 2: Atualizar docker-compose.yml

No arquivo `docker-compose.yml` da Máquina 1, mudar de `localhost` para `0.0.0.0`:

**ANTES**:
```yaml
frontend:
  ports:
    - "3002:3000"  # Apenas localhost
```

**DEPOIS** (já está assim no projeto):
```yaml
frontend:
  ports:
    - "0.0.0.0:3002:3000"  # Acessível de qualquer IP da rede
```

### Passo 3: Reiniciar sistema no servidor

```batch
cd C:\roberto-prevencao-no-radar
restart.bat
```

---

## 📱 Testando a Conexão

### Na Máquina 2 (Cliente):

1. **Testar ping** (verificar comunicação):
   ```
   ping 192.168.1.100
   ```
   Deve responder com sucesso!

2. **Testar acesso ao backend**:
   ```
   http://192.168.1.100:3001/api/health
   ```
   Deve retornar: `{"status":"ok"}`

3. **Acessar frontend**:
   ```
   http://192.168.1.100:3002
   ```
   Deve abrir a tela de login!

---

## 🌐 Configurações Adicionais

### Configurar Múltiplos Clientes (3+ máquinas)

Se você tem mais máquinas, todas podem acessar da mesma forma:

- **Máquina 3**: Acessa `http://192.168.1.100:3002`
- **Máquina 4**: Acessa `http://192.168.1.100:3002`
- **Máquina N**: Acessa `http://192.168.1.100:3002`

**Todos compartilham**:
- ✅ Mesmo banco de dados
- ✅ Mesmas bipagens em tempo real
- ✅ Mesmo sistema de usuários
- ✅ Dados sincronizados

---

## 🔐 Segurança e Permissões

### Criar Usuários Específicos por Máquina

**Máquina 1 (Recepção)** - Usuário operador:
```
Usuário: operador@empresa.com
Senha: senha123
Permissões: Apenas visualizar bipagens
```

**Máquina 2 (Gerência)** - Usuário gerente:
```
Usuário: gerente@empresa.com
Senha: senha456
Permissões: Visualizar relatórios, configurações
```

Criar usuários no sistema:
1. Login como admin
2. Ir em Configurações → Colaboradores
3. Adicionar novo usuário
4. Definir permissões

---

## 🚨 Problemas Comuns e Soluções

### ❌ Problema: "Não consigo acessar de outra máquina"

**Soluções**:

1. **Verificar firewall**:
   ```
   Desabilitar temporariamente o firewall para testar
   Se funcionar, o problema é firewall
   ```

2. **Verificar IP**:
   ```
   Na Máquina 1, executar: ipconfig
   Confirmar que o IP é 192.168.1.100
   ```

3. **Verificar se Docker está rodando**:
   ```
   Na Máquina 1: docker ps
   Deve listar os containers
   ```

4. **Testar na própria máquina servidor primeiro**:
   ```
   Na Máquina 1, abrir: http://localhost:3002
   Se não funcionar, o problema não é de rede
   ```

---

### ❌ Problema: "Acesso lento entre máquinas"

**Soluções**:
- Verificar qualidade da rede (switches, cabos)
- Usar cabo de rede ao invés de WiFi quando possível
- Verificar se não há outros programas consumindo muita rede

---

### ❌ Problema: "Algumas funcionalidades não funcionam"

**Causa**: Configuração de CORS ou proxy

**Solução**: Atualizar variável de ambiente no frontend

No arquivo `packages/frontend/.env`:
```env
VITE_API_URL=http://192.168.1.100:3001/api
```

Depois reconstruir o container:
```batch
docker-compose down
docker-compose up -d --build
```

---

## 📊 Arquitetura Final

```
┌─────────────────────────────────────────────────────────────┐
│                      REDE LOCAL (192.168.1.x)                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  MÁQUINA 1 (SERVIDOR) - 192.168.1.100               │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  Sistema Completo (Docker)                  │    │   │
│  │  │  - Frontend :3002                           │    │   │
│  │  │  - Backend :3001                            │    │   │
│  │  │  - PostgreSQL :5432                         │    │   │
│  │  │  - MinIO :9000, :9001                       │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  Scanner USB conectado aqui                 │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            │ REDE                           │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │  MÁQUINA 2 (CLIENTE) - 192.168.1.101                │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  Apenas Navegador                           │    │   │
│  │  │  Acessa: http://192.168.1.100:3002          │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  MÁQUINA 3, 4, 5... (Mais clientes)                 │   │
│  │  Todos acessam: http://192.168.1.100:3002           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist de Instalação

### Máquina 1 (Servidor):
- [ ] Executar `INSTALAR.bat`
- [ ] Configurar IP fixo: `192.168.1.100`
- [ ] Abrir portas no firewall (3001, 3002, 9001)
- [ ] Testar acesso local: `http://localhost:3002`
- [ ] Verificar se Docker está rodando: `docker ps`

### Máquina 2 (Cliente):
- [ ] Testar ping: `ping 192.168.1.100`
- [ ] Testar backend: `http://192.168.1.100:3001/api/health`
- [ ] Acessar frontend: `http://192.168.1.100:3002`
- [ ] Criar atalho na área de trabalho
- [ ] Fazer login e testar funcionalidades

---

## 🎓 Resumo

**Para o seu caso específico**:

1. **Máquina com scanner** (Máquina 1):
   - Instalar sistema completo
   - IP fixo: `192.168.1.100`
   - Liberar firewall

2. **Máquina de visualização** (Máquina 2):
   - NADA para instalar
   - Apenas abrir navegador
   - Acessar: `http://192.168.1.100:3002`

**Vantagens**:
- ✅ Dados centralizados
- ✅ Atualizações em tempo real
- ✅ Um único banco de dados
- ✅ Fácil adicionar mais máquinas
- ✅ Backup em um só lugar

---

**Criado em**: 2025-12-07
**Atualizado em**: 2025-12-07
**Versão**: 1.0

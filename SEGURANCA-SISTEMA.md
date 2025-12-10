# 🔒 Sistema de Proteção - Roberto Prevenção no Radar

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Como Funciona](#como-funciona)
3. [Como Ativar](#como-ativar)
4. [Como Desativar](#como-desativar)
5. [Proteções Implementadas](#proteções-implementadas)
6. [Logs de Segurança](#logs-de-segurança)
7. [Solução de Problemas](#solução-de-problemas)
8. [Perguntas Frequentes](#perguntas-frequentes)

---

## 🎯 Visão Geral

O sistema de proteção foi desenvolvido para **impedir** que clientes:

- ❌ **Copiem** a pasta do sistema para outra máquina
- ❌ **Modifiquem** arquivos de configuração
- ❌ **Excluam** o sistema sem autorização
- ❌ **Acessem** arquivos críticos (.env, docker-compose, etc)
- ❌ **Desinstalem** sem credenciais

### ✅ O que é protegido:

| Item | Proteção |
|------|----------|
| Pasta completa | Permissões NTFS restritivas |
| Arquivos .bat | Somente leitura |
| docker-compose.yml | Somente leitura |
| .env | Somente leitura + oculto |
| Desinstalação | Requer senha |
| Cópia | Bloqueada para usuários sem permissão |

---

## 🔧 Como Funciona

### Sistema de 3 Camadas

#### **Camada 1: Usuário Protegido**
- Cria usuário Windows: `Beto`
- Senha: `Beto3107`
- Único com controle total sobre a pasta

#### **Camada 2: Permissões NTFS**
- Remove herança de permissões
- Usuários comuns: **Nenhum acesso**
- Administradores: **Somente leitura**
- Beto + SYSTEM: **Controle total**

#### **Camada 3: Atributos de Arquivo**
- Arquivos críticos marcados como **somente leitura**
- .env marcado como **oculto**
- Logs de todas as tentativas de acesso

---

## 🚀 Como Ativar

### Opção 1: Durante a Instalação

Ao executar o `INSTALAR.bat`, no final você verá:

```
════════════════════════════════════════════════════════════════════════
 PROTEÇÃO DO SISTEMA (Opcional)
════════════════════════════════════════════════════════════════════════

Deseja proteger a pasta do sistema contra cópia/modificação? [S/N]
```

**Digite:** `S` + `Enter`

O sistema será automaticamente protegido!

---

### Opção 2: Após a Instalação

Se já instalou sem proteção, pode ativar depois:

1. Navegue até: `C:\roberto-prevencao-no-radar`

2. **Botão DIREITO** em `proteger-sistema.bat`

3. Selecione: **"Executar como Administrador"**

4. Aguarde a conclusão

#### O que acontece:

```
[1/5] Criando usuário protegido...
     ✓ Usuário Beto configurado

[2/5] Configurando permissões NTFS...
     ✓ Permissões NTFS configuradas

[3/5] Protegendo arquivos críticos...
     ✓ docker-compose.yml protegido
     ✓ .env protegido e oculto
     ✓ Scripts .bat protegidos

[4/5] Configurando sistema de log...
     ✓ Sistema de log configurado

[5/5] Criando configuração de segurança...
     ✓ Arquivo de configuração criado

╔════════════════════════════════════════════════════════════════════════╗
║                    ✓ SISTEMA PROTEGIDO COM SUCESSO                    ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

## 🔓 Como Desativar

⚠️ **ATENÇÃO:** Você precisará das credenciais!

### Credenciais Padrão:
```
Usuário: Beto
Senha:   Beto3107
```

### Passo a Passo:

1. Navegue até: `C:\roberto-prevencao-no-radar`

2. **Botão DIREITO** em `desproteger-sistema.bat`

3. Selecione: **"Executar como Administrador"**

4. Digite o usuário: `Beto`

5. Digite a senha: `Beto3107`

6. Escolha se deseja remover o usuário Beto: `S` ou `N`

#### O que acontece:

```
AUTENTICAÇÃO NECESSÁRIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Digite o usuário: Beto
Digite a senha: ********

✓ Credenciais válidas!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REMOVENDO PROTEÇÕES...

[1/4] Removendo atributos de proteção...
     ✓ Atributos removidos

[2/4] Restaurando permissões NTFS...
     ✓ Permissões NTFS restauradas

[3/4] Removendo usuário protegido...
     ✓ Usuário Beto removido

[4/4] Finalizando...
     ✓ Concluído

╔════════════════════════════════════════════════════════════════════════╗
║                 ✓ SISTEMA DESPROTEGIDO COM SUCESSO                    ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

## 🛡️ Proteções Implementadas

### 1. Proteção Contra Cópia

**Como funciona:**
- Permissões NTFS impedem usuários não autorizados de ler a pasta
- Apenas o usuário `Beto` e `SYSTEM` têm acesso

**Tentativa de cópia resulta em:**
```
Acesso negado
```

---

### 2. Proteção Contra Modificação

**Como funciona:**
- Arquivos críticos marcados como somente leitura
- Permissões NTFS impedem escrita

**Arquivos protegidos:**
- `docker-compose.yml`
- `packages/backend/.env`
- Todos os arquivos `.bat`

**Tentativa de modificação resulta em:**
```
Acesso negado - arquivo somente leitura
```

---

### 3. Proteção Contra Exclusão

**Como funciona:**
- Permissões NTFS impedem exclusão por usuários não autorizados
- Apenas `Beto` pode excluir

**Tentativa de exclusão resulta em:**
```
Acesso negado
```

---

### 4. Proteção de Arquivos Sensíveis

**Arquivo `.env` especial:**
- Marcado como **somente leitura**
- Marcado como **oculto**
- Não aparece em listagens normais
- Não pode ser editado

---

### 5. Desinstalação Protegida

Para desinstalar, é necessário:

1. Executar `desproteger-sistema.bat` **como Admin**
2. Fornecer usuário: `Beto`
3. Fornecer senha: `Beto3107`
4. Apenas depois disso, excluir a pasta

---

## 📊 Logs de Segurança

Todos os acessos e tentativas são registrados!

### Localização dos Logs:

```
C:\roberto-prevencao-no-radar\logs-seguranca\
```

### Tipos de Log:

| Arquivo | Conteúdo |
|---------|----------|
| `acessos-YYYYMMDD.log` | Acessos normais ao sistema |
| `tentativas-falhas.log` | Tentativas de senha incorreta |
| `desprotecoes.log` | Remoções autorizadas de proteção |

### Exemplo de Log:

```
[07/12/2025 14:30:15] Acesso ao sistema - Usuário: ADMIN
[07/12/2025 14:35:22] FALHA - Usuário: Admin - Por: CLIENTE
[07/12/2025 14:40:10] DESPROTEC̣ÃO AUTORIZADA - Por: Beto
```

---

## 🔧 Solução de Problemas

### ❌ "Esqueci a senha!"

**Solução:**

As credenciais padrão são:
```
Usuário: Beto
Senha:   Beto3107
```

Se você alterou e esqueceu:

1. Execute como **Administrador do Windows**:

```batch
net user Beto Beto3107
```

2. Isso reseta a senha para o padrão

---

### ❌ "Não consigo executar os scripts .bat!"

**Causa:** Arquivos estão protegidos como somente leitura

**Solução:**

Os scripts ainda podem ser **executados**, mas não **modificados**.

Para executar: **Duplo clique** ou **Botão direito** → Executar como Admin

---

### ❌ "Preciso editar o .env mas está protegido!"

**Solução:**

1. Execute `desproteger-sistema.bat`
2. Forneça credenciais: `Beto` / `Beto3107`
3. Edite o `.env`
4. Execute `proteger-sistema.bat` novamente

**OU**

Execute como Admin:
```batch
attrib -R -H C:\roberto-prevencao-no-radar\packages\backend\.env
```

Edite o arquivo, depois:
```batch
attrib +R +H C:\roberto-prevencao-no-radar\packages\backend\.env
```

---

### ❌ "O usuário Beto foi excluído acidentalmente!"

**Solução:**

Execute `proteger-sistema.bat` novamente.

Ele irá recriar o usuário automaticamente.

---

### ❌ "Não consigo acessar a pasta mesmo como Admin!"

**Causa:** Permissões NTFS muito restritivas

**Solução:**

Execute como Admin:
```batch
takeown /F C:\roberto-prevencao-no-radar /R /D Y
icacls C:\roberto-prevencao-no-radar /grant Administradores:F /T
```

Isso dá controle total de volta aos administradores.

---

### ❌ "A proteção não funciona!"

**Verificações:**

1. **Executou como Administrador?**
   ```
   net session
   ```
   Deve retornar sucesso.

2. **Usuário Beto existe?**
   ```
   net user Beto
   ```
   Deve mostrar detalhes do usuário.

3. **Permissões NTFS aplicadas?**
   ```
   icacls C:\roberto-prevencao-no-radar
   ```
   Deve mostrar Beto com controle total.

---

## ❓ Perguntas Frequentes

### **P: O sistema continua funcionando com a proteção ativa?**

**R:** Sim! A proteção não afeta o funcionamento normal do sistema.

- Docker continua rodando normalmente
- Frontend e Backend funcionam
- Usuários podem fazer login e usar o sistema

A proteção apenas impede **modificações não autorizadas** nos arquivos.

---

### **P: Posso mudar o usuário e senha?**

**R:** Sim! Edite os scripts `proteger-sistema.bat` e `desproteger-sistema.bat`

Procure por:
```batch
net user Beto Beto3107
```

E altere para:
```batch
net user SeuUsuario SuaSenha
```

**⚠️ IMPORTANTE:** Faça isso **antes** de proteger! Ou **após** desproteger!

---

### **P: O cliente consegue burlar a proteção?**

**R:** Depende do nível de conhecimento:

| Usuário | Consegue burlar? |
|---------|------------------|
| Usuário comum | ❌ Não |
| Usuário avançado | ⚠️ Dificilmente |
| Administrador local | ⚠️ Talvez (com takeown) |
| Administrador experiente | ✅ Sim (sempre possível) |

**Nota:** A proteção é contra **ações acidentais** e **usuários não técnicos**. Não é uma solução de criptografia militar.

---

### **P: Posso usar BitLocker ao invés disso?**

**R:** Sim! BitLocker oferece proteção mais forte.

**Vantagens do BitLocker:**
- Criptografia de disco completo
- Impossível burlar sem senha
- Padrão corporativo

**Desvantagens:**
- Só em Windows Pro/Enterprise
- Mais complexo de configurar
- Pode ter problemas de recuperação

**Recomendação:** Use **ambos** para máxima segurança!

---

### **P: Os logs podem ser adulterados?**

**R:** Sim, se o usuário tiver acesso de Admin.

Os logs servem para:
- ✅ Auditar acessos normais
- ✅ Detectar tentativas de invasão
- ✅ Responsabilizar ações

Não são à prova de adulteração.

Para logs seguros, use **SIEM** ou **syslog remoto**.

---

### **P: Preciso proteger em TODAS as instalações?**

**R:** Depende do cliente!

**Proteja quando:**
- ✅ Cliente tem múltiplos funcionários
- ✅ Alta rotatividade de pessoal
- ✅ Ambiente compartilhado
- ✅ Cliente solicita proteção
- ✅ Dados sensíveis

**Não precisa quando:**
- ❌ Instalação caseira/pessoal
- ❌ Cliente confiável
- ❌ Única pessoa usa
- ❌ Ambiente controlado

---

### **P: Como fazer backup antes de proteger?**

**R:** Execute antes de proteger:

```batch
xcopy C:\roberto-prevencao-no-radar C:\backup-roberto /E /I /H /Y
```

Isso cria cópia completa em `C:\backup-roberto`

---

## 📞 Suporte

Se tiver problemas com o sistema de proteção:

1. Consulte esta documentação
2. Verifique os logs em `logs-seguranca/`
3. Tente desproteger e proteger novamente
4. Em último caso, use `takeown` para recuperar acesso

---

## ⚠️ Avisos Importantes

### 🔴 **NUNCA** perca as credenciais!

Anote em local seguro:
- Usuário: `Beto`
- Senha: `Beto3107`

Sem elas, você não consegue desinstalar!

---

### 🔴 **SEMPRE** teste antes no cliente!

Antes de sair do local do cliente:
1. Ative a proteção
2. Tente copiar a pasta (deve falhar)
3. Execute `desproteger-sistema.bat`
4. Confirme que a senha funciona
5. Proteja novamente
6. **ANOTE** as credenciais para o cliente

---

### 🔴 **CUIDADO** com updates!

Ao atualizar o sistema:
1. Desproteja **antes** de atualizar
2. Faça o update
3. Proteja **depois** do update

Caso contrário, pode falhar!

---

## 📝 Resumo Rápido

### ✅ Ativar Proteção:
```
Executar como Admin: proteger-sistema.bat
```

### ❌ Desativar Proteção:
```
Executar como Admin: desproteger-sistema.bat
Usuário: Beto
Senha: Beto3107
```

### 📊 Ver Logs:
```
C:\roberto-prevencao-no-radar\logs-seguranca\
```

### 🔄 Recuperar Acesso:
```batch
net user Beto Beto3107
```

---

**Versão:** 1.0
**Data:** 07/12/2025
**Sistema:** Roberto Prevenção no Radar

---

╔════════════════════════════════════════════════════════════════════════╗
║                                                                        ║
║                    🔒 Sistema de Proteção Ativo                       ║
║                 Desenvolvido para sua segurança                       ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝

# REGRAS DE ACESSO SSH

## VPS Principal

| VPS | IP | Alias SSH | Uso |
|-----|-----|-----------|-----|
| VPS 46 | `46.202.150.64` | `vps2-hostinger` | Multi-clientes (TESTE) |

> VPS 145 e VPS 31 foram descontinuadas.

## Como Acessar

```bash
# Usar SEMPRE o alias configurado
ssh vps2-hostinger "comando"

# Exemplo: ver containers
ssh vps2-hostinger "docker ps --filter name=prevencao"
```

O alias `vps2-hostinger` esta configurado em `~/.ssh/config` e aponta para `46.202.150.64` com a chave correta.

## Chaves SSH

```
C:\Users\Administrator\.ssh\
├── config              # Aliases SSH (vps2-hostinger, etc.)
├── vps_prevencao       # Chave privada para VPS
├── vps_prevencao.pub   # Chave publica
└── known_hosts         # Servidores conhecidos
```

## Seguranca

- Chave privada NUNCA sai do computador
- Conexao criptografada
- NUNCA compartilhar a chave privada
- NUNCA postar chave no GitHub/WhatsApp

## Se Perder Acesso

1. Acessar VPS via painel web da Hostinger
2. Gerar nova chave: `ssh-keygen -t rsa -b 4096 -f ~/.ssh/vps_prevencao_nova`
3. Adicionar chave publica no servidor via painel
4. Testar e substituir chave antiga

---

**Atualizado em:** 09/02/2026

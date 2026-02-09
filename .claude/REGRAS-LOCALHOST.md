# REGRAS DE LOCALHOST - Desenvolvimento Local

## Portas

| Servico | Porta | Descricao |
|---------|-------|-----------|
| Backend (PM2) | 3000 | API Node.js Express |
| Frontend (Vite) | 3004 | Servidor de desenvolvimento React |
| PostgreSQL | 5432 | Banco de dados local |
| Oracle | 1521 | Banco Oracle (direto na rede local) |

## Enderecos

```
Backend API:  http://localhost:3000/api
Frontend Dev: http://localhost:3004
Oracle:       10.6.1.100:1521/orcl.intersoul
PostgreSQL:   localhost:5432
```

## Configuracao Backend (.env)

Arquivo: `packages/backend/.env`

```env
PORT=3000

# Oracle (conexao direta na rede local)
ORACLE_USER=POWERBI
ORACLE_PASSWORD=OdRz6J4LY6Y6
ORACLE_CONNECT_STRING=10.6.1.100:1521/orcl.intersoul
```

A variavel `ORACLE_CONNECT_STRING` tem prioridade sobre o banco de dados. Se existir, o OracleService usa ela.

## Configuracao Frontend (vite.config.js)

```javascript
server: {
  port: 3004,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      secure: false,
    },
  },
}
```

## Comandos PM2

```bash
pm2 status              # Ver status
pm2 restart 0           # Reiniciar backend
pm2 logs 0              # Logs em tempo real
pm2 logs 0 --lines 50 --nostream  # Ultimas 50 linhas
```

## Oracle Instant Client (Windows)

Path: `C:\oracle\instantclient_64\instantclient_23_4`

Deve estar no PATH do Windows para Thick mode funcionar.

## Troubleshooting

### Frontend nao conecta ao Backend
1. Verificar backend porta 3000: `netstat -ano | findstr ":3000"`
2. Verificar Vite porta 3004: `netstat -ano | findstr ":3004"`
3. Verificar proxy no vite.config.js

### Oracle nao conecta
1. Verificar .env com ORACLE_CONNECT_STRING
2. Verificar Oracle Instant Client no PATH
3. Verificar se maquina esta na mesma rede (10.6.1.x)

### Backend nao inicia
1. `pm2 logs 0 --lines 100 --nostream`
2. Verificar porta 3000 em uso
3. Matar e reiniciar: `taskkill /PID <PID> /F && pm2 restart 0`

---

**Atualizado em:** 09/02/2026

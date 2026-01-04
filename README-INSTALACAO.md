# 🚀 INSTALAÇÃO PREVENÇÃO NO RADAR

## 📋 COMANDO ÚNICO PARA INSTALAR

**Cole este comando na VPS para instalar tudo automaticamente:**

```bash
curl -fsSL https://raw.githubusercontent.com/betotradicao/prevencao-no-radar/main/InstaladorVPS/install.sh | bash
```

---

## 🔧 OU INSTALAÇÃO MANUAL (3 comandos)

Se preferir fazer passo a passo:

```bash
# 1. Baixar o instalador
wget https://raw.githubusercontent.com/betotradicao/prevencao-no-radar/main/InstaladorVPS/install.sh

# 2. Dar permissão de execução
chmod +x install.sh

# 3. Executar
./install.sh
```

---

## 📦 O QUE SERÁ INSTALADO

- ✅ Docker & Docker Compose
- ✅ PostgreSQL 15 (banco de dados)
- ✅ MinIO (storage de arquivos)
- ✅ Backend Node.js + TypeScript
- ✅ Frontend React + Vite
- ✅ Tailscale VPN (opcional)

---

## 🎯 APÓS A INSTALAÇÃO

O instalador vai te pedir:

1. **IP da VPS** (ex: 46.202.150.64)
2. **Instalar Tailscale?** (s/n)
   - Se sim: IP Tailscale da VPS e do Cliente

Depois disso, **tudo será instalado automaticamente!**

---

## 🌐 ACESSO AO SISTEMA

Após a instalação, acesse:

- **Frontend**: `http://SEU_IP:3000`
- **Login**: Beto / Beto14

---

## 📝 CREDENCIAIS

Todas as credenciais (banco, minio, etc) ficam salvas em:
```
/root/CREDENCIAIS.txt
```

---

## 🆘 SUPORTE

Se algo der errado, verifique os logs:

```bash
# Logs do backend
docker logs prevencao-backend -f

# Logs do frontend
docker logs prevencao-frontend -f

# Status geral
docker ps
```

---

## 🔄 REINICIAR TUDO

```bash
cd /root/prevencao-no-radar
docker-compose restart
```

---

**🎉 Pronto! Sistema instalado e funcionando!**

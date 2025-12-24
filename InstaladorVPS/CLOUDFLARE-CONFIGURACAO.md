# ☁️ Configuração Cloudflare - prevencaonoradar.com.br

## ⚠️ PROBLEMA IDENTIFICADO

A porta **80 está bloqueada** pelo provedor de hospedagem (Hostinger).
Apenas a porta **3000** está acessível externamente.

## ✅ SOLUÇÃO: Configurar Origin Rules no Cloudflare

### Passo 1: Ativar Proxy no Cloudflare

1. Acesse: https://dash.cloudflare.com
2. Selecione: `prevencaonoradar.com.br`
3. Vá em: **DNS** → **Records**
4. **IMPORTANTE**: Mude o status de **DNS only** (nuvem cinza) para **Proxied** (nuvem laranja) nos 2 registros:
   - `prevencaonoradar.com.br` → Proxied 🟠
   - `www.prevencaonoradar.com.br` → Proxied 🟠

### Passo 2: Configurar Origin Rules (Porta 3000)

1. No Cloudflare, vá em: **Rules** → **Origin Rules**
2. Clique em: **Create rule**
3. **Nome da regra**: `Redirecionar para porta 3000`
4. **Condição**:
   ```
   (http.host eq "prevencaonoradar.com.br" or http.host eq "www.prevencaonoradar.com.br")
   ```
5. **Ação**:
   - **Destination Port**: `3000`
6. Clique em: **Deploy**

### Passo 3: Configurar SSL/TLS

1. Vá em: **SSL/TLS** → **Overview**
2. Selecione: **Flexible** (Cloudflare ↔️ Browser: HTTPS, Cloudflare ↔️ Origin: HTTP)
3. Salve

### Passo 4: Testar

Aguarde 2-5 minutos e teste:
- http://prevencaonoradar.com.br
- https://prevencaonoradar.com.br (SSL grátis do Cloudflare)
- http://www.prevencaonoradar.com.br
- https://www.prevencaonoradar.com.br

---

## 🔄 ALTERNATIVA: Usar Cloudflare Tunnel (Mais avançado)

Se a solução acima não funcionar, você pode usar o **Cloudflare Tunnel** (Argo Tunnel):

### Vantagens:
- ✅ Não precisa expor NENHUMA porta da VPS
- ✅ Funciona através de um túnel criptografado
- ✅ Mais seguro

### Instalação:

```bash
# Na VPS
ssh root@31.97.82.235

# Instalar cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared.deb

# Autenticar
cloudflared tunnel login

# Criar túnel
cloudflared tunnel create prevencao-radar

# Configurar túnel
cat > ~/.cloudflared/config.yml << EOF
url: http://localhost:3000
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json
EOF

# Criar rota DNS
cloudflared tunnel route dns prevencao-radar prevencaonoradar.com.br
cloudflared tunnel route dns prevencao-radar www.prevencaonoradar.com.br

# Executar como serviço
cloudflared service install
systemctl start cloudflared
systemctl enable cloudflared
```

---

## 📋 Resumo do Status Atual

✅ DNS configurado corretamente (`31.97.82.235`)
✅ Aplicação rodando na porta 3000
✅ Porta 3000 acessível externamente
❌ Porta 80 bloqueada pelo provedor de hospedagem
⏳ Aguardando configuração do Cloudflare Origin Rules ou Tunnel

---

## 🎯 Próximos Passos

1. **Opção Recomendada**: Configure Origin Rules no Cloudflare (mais simples)
2. **Opção Avançada**: Use Cloudflare Tunnel (mais seguro)
3. **Teste** o acesso após configurar
4. **Ative HTTPS** no Cloudflare (SSL grátis)

---

**Dúvidas?** Consulte a documentação do Cloudflare ou peça ajuda!

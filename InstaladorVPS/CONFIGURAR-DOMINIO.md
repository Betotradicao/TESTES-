# 🌐 Configuração de Domínio - prevencaonoradar.com.br

Este guia explica como configurar o domínio `prevencaonoradar.com.br` para apontar para a aplicação rodando em `31.97.82.235:3000`.

---

## 📋 PASSO 1: Configurar DNS no Registro.br

### 1.1 Acessar o painel do Registro.br

1. Acesse: https://registro.br
2. Faça login com suas credenciais
3. Selecione o domínio: `prevencaonoradar.com.br`

### 1.2 Configurar servidores DNS

**Opção A - Usar DNS do próprio Registro.br (RECOMENDADO):**

1. Vá em: **DNS** → **Alterar servidores DNS**
2. Selecione: **Usar os servidores do Registro.br**
3. Clique em **Salvar**

**Opção B - Usar DNS externo (Cloudflare, AWS Route53, etc.):**

Se preferir usar Cloudflare ou outro provedor, configure os nameservers externos.

### 1.3 Adicionar registros DNS

Após configurar os servidores DNS, adicione os seguintes registros:

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | @ | 31.97.82.235 | 3600 |
| A | www | 31.97.82.235 | 3600 |

**Resultado:**
- `prevencaonoradar.com.br` → `31.97.82.235`
- `www.prevencaonoradar.com.br` → `31.97.82.235`

### 1.4 Aguardar propagação DNS

A propagação DNS pode levar de **1 hora até 48 horas** (geralmente 1-2h).

Para verificar se já propagou, execute no seu computador:
```cmd
nslookup prevencaonoradar.com.br
```

Você deve ver o IP `31.97.82.235` no resultado.

---

## 📋 PASSO 2: Instalar e Configurar Nginx na VPS

### 2.1 Conectar na VPS via SSH

```bash
ssh root@31.97.82.235
```

### 2.2 Ir para a pasta do instalador

```bash
cd /root/prevencao-no-radar/InstaladorVPS
```

### 2.3 Executar instalador do Nginx

```bash
chmod +x INSTALAR-NGINX.sh
./INSTALAR-NGINX.sh
```

**O que o script faz:**
1. ✅ Instala o Nginx
2. ✅ Copia arquivo de configuração para `/etc/nginx/sites-available/`
3. ✅ Habilita o site criando link simbólico
4. ✅ Remove site padrão do Nginx
5. ✅ Testa a configuração
6. ✅ Reinicia o Nginx
7. ✅ Exibe instruções para SSL/HTTPS

### 2.4 Verificar se Nginx está rodando

```bash
systemctl status nginx
```

Deve aparecer: **active (running)**

---

## 📋 PASSO 3: Testar o Acesso

Após a propagação DNS, teste os seguintes endereços no navegador:

1. **http://prevencaonoradar.com.br**
2. **http://www.prevencaonoradar.com.br**
3. **http://prevencaonoradar.com.br/reconhecimento-facial**

Todos devem carregar a aplicação!

---

## 🔒 PASSO 4 (OPCIONAL): Configurar SSL/HTTPS

### 4.1 Instalar Certbot (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
```

### 4.2 Gerar certificado SSL

```bash
certbot --nginx -d prevencaonoradar.com.br -d www.prevencaonoradar.com.br
```

**Durante a instalação:**
1. Digite seu e-mail
2. Aceite os termos de serviço
3. Escolha se quer redirecionar HTTP → HTTPS (recomendado: **SIM**)

### 4.3 Renovação automática

O Certbot já configura renovação automática. Para testar:

```bash
certbot renew --dry-run
```

---

## 🔧 Configuração Manual (Alternativa)

Se preferir configurar manualmente:

### Arquivo: `/etc/nginx/sites-available/prevencaonoradar.com.br`

```nginx
server {
    listen 80;
    server_name prevencaonoradar.com.br www.prevencaonoradar.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Habilitar site:

```bash
ln -s /etc/nginx/sites-available/prevencaonoradar.com.br /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## 🐛 Resolução de Problemas

### Problema 1: "Site não carrega" ou "Connection refused"

**Solução:**
1. Verifique se a aplicação está rodando na porta 3000:
   ```bash
   docker ps | grep frontend
   curl http://localhost:3000
   ```

2. Verifique se o Nginx está rodando:
   ```bash
   systemctl status nginx
   ```

3. Verifique logs do Nginx:
   ```bash
   tail -f /var/log/nginx/error.log
   ```

### Problema 2: DNS não resolveu

**Solução:**
1. Verifique se os registros DNS estão corretos no painel do Registro.br
2. Use ferramenta online para verificar propagação:
   - https://dnschecker.org
3. Aguarde mais tempo (pode levar até 48h)

### Problema 3: "502 Bad Gateway"

**Solução:**
1. A aplicação não está rodando na porta 3000
2. Inicie os containers:
   ```bash
   cd /opt/prevencao-radar/InstaladorVPS
   docker-compose -f docker-compose-producao.yml up -d
   ```

### Problema 4: "404 Not Found" ao acessar /reconhecimento-facial

**Solução:**
1. Verifique se o frontend está configurado com as rotas corretas
2. Verifique se o React Router está funcionando
3. Adicione configuração no Nginx para SPA (Single Page Application):
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
       proxy_pass http://localhost:3000;
       ...
   }
   ```

---

## 📚 Referências

- Registro.br - DNS: https://registro.br/tecnologia/ferramentas/dns/
- Nginx Docs: https://nginx.org/en/docs/
- Let's Encrypt Certbot: https://certbot.eff.org/

---

## ✅ Checklist Final

- [ ] DNS configurado no Registro.br
- [ ] Nginx instalado na VPS
- [ ] Site acessível via `http://prevencaonoradar.com.br`
- [ ] SSL/HTTPS configurado (opcional, mas recomendado)
- [ ] Renovação automática SSL funcionando
- [ ] Aplicação carregando corretamente

---

**Dúvidas?** Entre em contato ou consulte os logs do Nginx para diagnóstico.

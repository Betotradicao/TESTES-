# Guia de Conexão DVR - Intelbras/Dahua

## Visão Geral

O sistema suporta conexão com DVRs Intelbras/Dahua para exibir vídeos das câmeras na Vision Palavra Chave, Vision PDV e Vision Bipagens. A conexão é feita via túnel SSH seguro.

---

## Arquitetura

```
[Loja do Cliente]                          [VPS - Docker]
                                           
DVR (192.168.x.x)  ←─┐                    
  Porta HTTP: 80      │                    Container Backend
  Porta RTSP: 554     │  Túnel SSH         ├── API HTTP (RPC2 login)
  Porta TCP: 37777    ├──────────────→     ├── ffmpeg (RTSP → MP4 H.264)
                      │  Portas VPS:       └── Stream → Browser
Windows Server  ──────┘  38100 (HTTP)
(SSHTunnels-Loja1DVR)    38101 (RTSP)
```

---

## Passo a Passo: Conectar DVR de um Novo Cliente

### 1. Criar Túnel DVR

1. Acesse o sistema do cliente: `https://{cliente}.prevencaonoradar.com.br`
2. Vá em **Configurações de Tabelas → aba Túnel DVR**
3. Clique **"+ Adicionar Loja"**
4. Preencha:
   - **IP do DVR**: IP na rede local (ex: `192.168.102.169`)
   - **DVR HTTP**: Porta local `80` → Porta VPS (escolha uma livre, ex: `38100`)
   - **DVR RTSP**: Porta local `554` → Porta VPS (ex: `38101`)
5. Clique **"Gerar Instalador .BAT"**
6. Execute o .BAT **como Administrador** na máquina Windows da loja

**IMPORTANTE**: Cada cliente deve usar portas VPS DIFERENTES:
- Tradicao: 18080, 18554 (portas antigas)
- Nunes: 38100, 38101
- Próximo cliente: 48100, 48101 (ou similar)

### 2. Verificar Túnel

Após instalar o .BAT, verifique na VPS:
```bash
ss -tlnp | grep 38100   # Deve mostrar LISTEN
```

Teste se o DVR responde:
```bash
curl -s -o /dev/null -w "HTTP_%{http_code}" http://localhost:38100/
# Deve retornar HTTP_200
```

### 3. Configurar DVR no Sistema

1. Vá em **Configurações de Rede → DVR / CFTV**
2. Preencha:
   - **IP do DVR**: `host.docker.internal` (NÃO usar o IP local do DVR!)
   - **Porta HTTP (API)**: porta VPS do túnel (ex: `38100`)
   - **Porta RTSP (Vídeo)**: porta VPS do túnel (ex: `38101`)
   - **Usuário**: `admin`
   - **Senha**: senha do DVR
3. Clique **"Testar Conexão"** — deve mostrar "Conectado com sucesso"
4. Clique **"Detectar do DVR"** para mapear os canais automaticamente

### 4. Mapear Câmeras → PDVs

Na seção **"Mapeamento de Canais DVR → PDV"**:
1. Na coluna **"Pal. Chave 2"**, habilite o checkbox de cada câmera
2. Preencha o **PDV** correspondente (ex: 101, 102, 103, 104)
3. Configure **Antes (s)**: 20 e **Depois (s)**: 120
4. Salve

---

## Detalhes Técnicos

### Túnel SSH Separado

Cada túnel DVR usa:
- **Pasta separada**: `C:\ProgramData\SSHTunnels-{NomeLoja}DVR\`
- **Serviço Windows separado**: `SSH-Tunnel-{NomeLoja}DVR`
- **Chave SSH separada**: não interfere no túnel do banco de dados

O túnel do banco fica em `C:\ProgramData\SSHTunnels\` — NUNCA é sobrescrito.

### Codec de Vídeo

- DVRs mais antigos (Tradicao): gravam em **H.264** → browser reproduz direto
- DVRs mais novos (Nunes iMHDX 3132): gravam em **H.265 (HEVC)** → browser NÃO suporta
- O sistema detecta H.265 e converte automaticamente pra H.264 via ffmpeg
- A conversão usa `libx264 -preset ultrafast -crf 28` (rápida, qualidade boa)
- O vídeo demora **5-10 segundos** pra começar quando precisa converter

### Autenticação do DVR

O sistema usa **RPC2 Digest Auth** (protocolo Dahua):
1. Envia challenge com username → DVR retorna `realm` + `random`
2. Calcula: `MD5(user:realm:pass)` → `MD5(user:random:hash1)` (uppercase)
3. Envia hash → DVR valida e retorna sessão

**Nota**: Alguns modelos mais novos (iMHDX 3132+) podem ter autenticação diferente. Se "Testar Conexão" falhar com "invalid credentials" mas o login web funciona, pode ser incompatibilidade de firmware.

### Stream de Vídeo (RTSP)

O vídeo é buscado via RTSP pelo ffmpeg no container:
```
rtsp://{user}:{pass}@{ip}:{rtspPort}/cam/playback?channel={ch}&starttime={start}&endtime={end}
```

ffmpeg converte e envia como MP4 fragmentado para o browser:
```
ffmpeg -rtsp_transport tcp -i {rtsp_url} -c:v libx264 -preset ultrafast -crf 28 
       -movflags frag_keyframe+empty_moov+faststart -c:a aac -f mp4 pipe:1
```

### Formato de Data

O PG (RP INFO) retorna hora sem `:` (ex: `063825`). O sistema converte automaticamente para `06:38:25` antes de construir a URL RTSP.

---

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| "Testar Conexão" falha | IP/porta errada | Usar `host.docker.internal` e porta do túnel |
| Túnel OFFLINE | Chave SSH não instalada na VPS | Regenerar o .BAT e reinstalar |
| Vídeo preto | Codec H.265 não convertido | Verificar se o deploy tem a conversão H.264 |
| Vídeo não carrega | Data NaN no RTSP | Verificar parse de hora do PG (sem `:`) |
| "Nenhuma camera configurada" | PDV não mapeado | Configurar câmeras na coluna "Pal. Chave 2" |
| Play não faz nada | Comparação PDV string/number | Usar `String(c.pdv) === String(pdv)` |
| Túnel derruba o banco | Mesma pasta SSH | Usar pasta separada `SSHTunnels-{nome}DVR` |

---

## Clientes Configurados

| Cliente | DVR IP Local | VPS HTTP | VPS RTSP | Codec | Status |
|---------|-------------|----------|----------|-------|--------|
| Tradicao | 10.6.1.123 | 18080 | 18554 | H.264 | ✅ Funcionando |
| Nunes | 192.168.102.169 | 38100 | 38101 | H.265→H.264 | ✅ Funcionando |

---

**Última atualização:** 13/04/2026

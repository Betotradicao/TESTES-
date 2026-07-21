# ✅ DVR Tradição reiniciava ao dar Play — era a TOMADA

**Data:** 2026-07-15 · **Cliente:** [[../clientes/tradicao|Tradição]] · **Módulo:** [[../modulos/dvr-cameras|DVR]]

## ✅ SOLUÇÃO: Roberto trocou o DVR de tomada. Resolvido na hora.

Zero oscilação em 60s de monitoramento depois. Antes não passava de 11s de pé.

## 🔥 As duas lições

**1. Antes de caçar bug de software no vídeo do DVR, confirme que o DVR está de pé.**
Passamos o dia consertando túnel, firewall e config de um aparelho que **desligava sozinho**.

**2. Eu errei o diagnóstico e vale saber por quê.** Cheguei a "o HD está morrendo" por causa
da linha do tempo vazia + disco 100% cheio. Mas a **tabela vazia era CONSEQUÊNCIA dos
reinícios**, não sintoma de disco ruim — o DVR não conseguia listar gravação porque estava
reiniciando, não porque o disco falhava. **Li o efeito como se fosse a causa.**

> 🎯 **Regra:** quando o aparelho está em ciclo de reboot, **todo sintoma observado é suspeito**
> — pode ser só o reboot se manifestando. Estabilize o aparelho ANTES de interpretar qualquer
> outro sinal.

O sinal que eu deveria ter valorizado: **"foi trocado de lugar"** + reinício sob carga =
alimentação, direto. O pico de consumo (ler HD + decodificar) numa tomada ruim derruba na hora.
E o encolhimento do tempo de vida (80s → 44s → 11s) era o contato piorando/esquentando —
disco em falha não tem esse padrão progressivo tão limpo.

## 🎯 O que está acontecendo

**Dar Play numa gravação reinicia o DVR.** Reproduzível — dois ciclos capturados:

```
16:05:14  ping=MUDO     80=X  554=X  37777=X     <-- morto
16:05:49  ping=RESPONDE 80=X  554=X  37777=X     <-- rede volta, servicos nao
16:06:28  ping=RESPONDE 80=OK 554=OK 37777=OK    <-- pronto

16:17:21  ping=up       80=OK 554=OK 37777=OK    <-- normal
16:17:33  ping=DOWN     80=X  554=X  37777=X     <-- Roberto deu Play
16:18:09  ping=up       80=X  554=X  37777=X     <-- 36s: boot
16:18:53  ping=up       80=OK 554=OK 37777=OK    <-- 80s: tudo de volta
```

## 🧠 Como o teste separa hardware de software

O monitor checava **ping E portas** a cada 2s. Isso é o que discrimina:

| Sintoma | Significado |
|---|---|
| ping vive, portas morrem | software travou (firmware/serviço) |
| **ping morre junto com as portas** | **aparelho desligou** ← foi este |
| só a 554 morre | serviço de vídeo apenas |

Ping morrendo junto = **perda de energia / reset de hardware**. E 36s até o ping voltar é
**boot completo** — restart de serviço seriam 2-3s.

## ❌ A pista falsa que me enganou (fica de aviso)

O disco tem **2 TB gravados** mas o DVR **não conseguia listar nem ler** — eu li isso como
"HD morrendo". **Era o reboot.** O DVR não listava porque não ficava vivo tempo suficiente.

```
/dev/sda0  491 GB — 100% usado      linha do tempo: VAZIA o dia todo
/dev/sda1  499 GB — 100% usado      tela: "Não existe gravação neste horário"
/dev/sda2  499 GB — 100% usado
/dev/sda3  479 GB — 100% usado
HealthDataFlag: 0   IsError: false   State: Success
```

Padrão clássico de disco em falha:
- **Gravar** funciona (escrita sequencial) → por isso o disco encheu
- **Ler** falha (precisa buscar posição) → setor ruim aparece → erro de I/O → watchdog reseta

> ⚠️ O autoteste do DVR diz `IsError: false`. **Não confie** — ele não faz varredura de
> superfície. Disco pode passar nesse teste cheio de setor ruim.

**Contexto que fecha:** Roberto disse *"não foi trocado, só foi trocado de lugar"*. HD é a peça
mais frágil num transporte — solavanco com disco parado ou cabo SATA afrouxado.

## 🔧 Ordem de ação correta (aprendida na marra)

DVR que **reinicia** (ping morre junto com as portas), ainda mais se foi **movido de lugar**:

1. **TROCAR DE TOMADA** ← resolveu este caso, em segundos, de graça
2. Reencaixar a fonte / testar outra fonte
3. Reencaixar cabos do HD (SATA + força)
4. Trocar o HD

Eu tinha invertido essa lista. **Alimentação primeiro, sempre** — é o teste mais barato e
rápido, e a causa mais comum quando o aparelho *desliga* em vez de *travar*.

## 📇 Dados reais do aparelho (API RPC2, 15/07)

| | |
|---|---|
| Modelo | **iMHDX 5116** ⚠️ (vault dizia "MIB 1116" — **estava errado**) |
| Firmware | `4.001.00IB000.0.R` · build 2025-02-21 |
| Processador | ST7108 · série DBT0002572184 |
| CPU em repouso | 45% (faz reconhecimento facial — já vive carregado) |
| IP / portas | `10.6.1.123` · 80 (HTTP) · 554 (RTSP) · 37777 (TCP) |
| Login | `admin` / senha do vault — ✅ **confirmado OK em 15/07** |

Sendo iMHDX 5xxx (mesma família do iMHDX 3132 do Nunes), provavelmente grava **H.265** —
`codec_mode = transcode` está correto.

## 🧰 Como reproduzir o diagnóstico

```powershell
# Monitor que discrimina reboot de travamento (roda da maquina da loja)
foreach ($p in @(80,554,37777)) { <TcpClient 1.5s> }
Test-Connection 10.6.1.123 -Count 1 -Quiet
# reporta so quando o estado MUDA -> silencio = estavel
```

```javascript
// Login RPC2 + leitura de disco (somente leitura)
storage.getDeviceAllInfo   // saude e uso do disco
magicBox.getDeviceType     // modelo real
magicBox.getCPUUsage       // carga
// logmanager.startFind -> "Method not found!" neste firmware
```

Scripts completos: ver histórico desta sessão.

## 🔗 Relacionados
- [[2026-07-15-tunel-dvr-chave-nao-autorizada-matava-oracle]] — o túnel, consertado no mesmo dia
- [[../modulos/dvr-cameras]] · [[../../.claude/DVR-CFTV-TROUBLESHOOT]]

## 🏷️ Tags
#bug #dvr #hardware #hd #tradicao #causa-raiz

# 🚧 Trabalho em Andamento

> **Projeto ativo: RADAR 360**, em `D:\radar360`.
> Produção: `https://tradicaosjc.prevencaonoradar.com.br` (VPS `vps-prevencao`, 31.97.82.235).
> Repositório: `Betotradicao/RADAR360-INTERSOLID`, branch **`RADAR360`**.
> Regras de commit e deploy: `D:\radar360\CLAUDE.md`.
> ⚠️ O Prevenção no Radar (Tradição, VPS 46.202.150.64) é **referência só de leitura**.

---

## ✅ Feito hoje (28/08) e no ar

### EMAIL RADAR 360 + recuperação de senha — commits `9d2d38d` e `c70a7a2`
Tela em **Implantação › EMAIL RADAR 360** (remetente, senha de app do Gmail,
Testar Conexão, textos editáveis) e **"Esqueci minha senha"** no login, no lugar
do link de demonstração.

Lições registradas em
[[bugs-resolvidos/2026-08-feature-email-e-recuperacao-de-senha]].

### Leitor fantasma — commit `710cfa7` (deployado hoje)
Só cria leitor novo se a leitura for **etiqueta de balança ou crachá cadastrado**.
Digitação em teclado não cria mais equipamento.

### Clipes de ontem
Lote concluído: **19 gerados, 5 já existiam, 0 falharam**.

---

## ⏳ Próximo passo

**Roberto precisa preencher a tela de e-mail** — remetente + senha de app do
Gmail — e clicar em *Testar conexão*. Nada sai por e-mail enquanto isso não for
feito.

A conta `beto` (master) tem e-mail `supermercadotradicao@yahoo.com.br`, então a
recuperação funciona para ela assim que o remetente estiver configurado.

---

## 📌 Pendências abertas

| O quê | Estado |
|---|---|
| **Boas-vindas** — template pronto, ainda não dispara | Roberto: *"depois vemos em que momento"* |
| **`SCANNER_03` fantasma** no banco (id 4) | Aguardando decisão do Roberto para apagar; ele registrou uso às 14:00 de hoje |
| **Deploy Key no GitHub** para trocar scp por `git pull` na VPS | Falta Roberto cadastrar em Settings › Deploy keys (sem write): `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJGd4+J6QO9lC85afIBZMir9M1oSU7SPFpuEVECuiidb radar360-deploy-vps` |
| **Overlay do PDV (Zanthus) no vídeo** | Em espera por decisão do Roberto |
| **Rotacionar a senha do DVR** (`beto3107@`, exposta em chat) | Pendente |

---

## 🔗 Relacionado

- [[bugs-resolvidos/2026-08-feature-email-e-recuperacao-de-senha]]
- [[padroes/estilo-criacao]]
- [[padroes/regras-ssh-windows]]

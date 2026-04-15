# Tradição

Cliente de supermercado **loja única**, hospedado na VPS 46. É o cliente de **referência/desenvolvimento** — funcionalidades novas costumam ser testadas aqui primeiro.

## 📊 Dados Básicos
- **VPS:** `46.202.150.64` (alias SSH: `vps2-hostinger`)
- **Diretório:** `/root/clientes/tradicao`
- **Containers:** `prevencao-tradicao-frontend`, `prevencao-tradicao-backend`, `prevencao-tradicao-postgres`
- **Portas:** Frontend 3903, Backend 4903, Postgres 6303, MinIO 9903/10003

## 🔌 ERP
- Usa [[../arquitetura/oracle-intersolid|Oracle Intersolid]]
- Schema: `INTERSOLID`

## ⭐ Particularidades
- **Loja única** (diferente de [[supervital|SuperVital]] que é multi-loja)
- É a "rede local" do usuário — mais fácil de testar na hora
- Primeiro cliente a receber novos deploys geralmente

## 🚀 Deploy
Ver [[../arquitetura/deploy|Deploy Multi-Tenant]].

## 🏷️ Tags
#cliente #oracle #loja-unica #vps46 #rede-local

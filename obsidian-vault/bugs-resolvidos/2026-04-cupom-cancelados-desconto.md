# Feature: Itens cancelados e com desconto no rodapé do cupom

**Data:** 2026-04 (commits `84f02b3`, `d029dfa`)
**Módulo:** [[../modulos/vision-palavra-chave|Vision Palavra-Chave]]

## 🎯 O que mudou
1. `d029dfa` — `getCupomByTime` passou a exibir itens de **CANC. VENDA** (itens cancelados)
2. `84f02b3` — Rodapé do cupom fiscal agora expõe **itens cancelados** e **itens com desconto** separadamente

## 💡 Por que
Análise de prevenção precisava separar:
- Item cancelado = potencial tentativa de furto
- Item com desconto = risco de desconto indevido pelo operador

Antes, esses itens ficavam misturados no cupom e dificultavam a análise.

## 🏷️ Tags
#feature #vision #cupom-fiscal #prevencao #2026-04

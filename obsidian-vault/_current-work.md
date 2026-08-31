# Onde paramos

## Tarefa atual
**Primeiro treino da IA de reconhecimento na balança** — alvo: o GRUPO do produto.
Detalhes e decisões em [[modulos/ia-reconhecimento-balanca]].

## Já decidido (não reabrir)
- Grupos = os do ERP, não regex. `INSUMOS DE PRODUÇÃO` fora.
- Recorte = prato das duas balanças (percentuais na nota), **não** faixa da bancada.
- Prato vazio se descarta pela distância da mediana; corte em ~13.
- Grupo agora, apresentação (inteiro/fatiado/moído) só no segundo treino.

## Próximo passo (meu)
1. Baixar as 439 fotos, recortar os dois pratos, descartar os vazios
2. Rotular pelo grupo do `CatalogoService`
3. Treinar classificador; separar 20% para medir
4. Gravar `ia_palpite` / `ia_confianca` / `ia_modelo` em `fotos_balanca`
5. Levar ao Roberto: acerto por grupo + **lista de divergências** (bipou X, IA diz Y)

## Esperando o Roberto (não trava o treino)
- Julgar o resultado quando eu trouxer o número
- Olhar ~10 divergências e dizer se é a IA que erra ou gente digitando errado

## Pendências antigas
- Trocar a senha do DVR (`beto3107@` foi exposta em chat)
- Apagar o lixo dos meus testes no banco facial (`ZZ CONFERINDO FOTO` em ASSALTOS, `uid 31` em FURTOS)
- Habilitar gravação nos caixas; reinstalar o leitor na segunda máquina (ainda manda token `wNfE`)
- C: com ~6 GB livres — treino roda em D:

## Estado do código
`radar360` limpo, igual ao origin/RADAR360. Produção com `index-BcUpVb8E.js`, containers saudáveis.

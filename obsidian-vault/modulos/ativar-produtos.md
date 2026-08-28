---
tags: [modulo, produtos, minio, radar360]
atualizado: 2026-08-26
---

# Ativar Produtos (RADAR 360)

Escolhe quais itens o coletor deve **exigir bipagem**. Espelha a tela do
Tradição: 4 cartões, 7 filtros, seleção em massa e ordenação por coluna.

---

## 🎯 O que é da gente e o que é do ERP

⚠️ A tabela `produtos` **não é cadastro de produto** e não espelha o ERP.
Descrição, EAN, seção, preço e estoque são lidos do Oracle a cada consulta.
Aqui fica só o que o ERP não tem onde guardar: **este item exige bipagem?**

Copiar o cadastro para cá criaria um segundo cadastro que envelhece sozinho e
passa a mentir sem avisar.

### UPSERT, sempre

O sistema de origem gravava só com `UPDATE`. Produto que existe no Oracle mas
não tinha linha local era **pulado em silêncio** — o Roberto marcava, a tela
dizia OK e nada acontecia (bug de 22/08, grupo de similares). Ausência de linha
significa "nunca foi ativado", **nunca** "não existe".

---

## 📋 Colunas e filtros

| | |
|---|---|
| **Cartões** | Total · Ativos · Inativos · Selecionados |
| **Filtros** | Buscar (código/EAN/descrição) · Situação · Seção · Grupo · Subgrupo · Tipo Espécie · Tipo Evento |
| **Colunas** | ☑ · Foto · Código · EAN · Descrição · Tipo Espécie · Tipo Evento · Pesável · Ação · Status |

> Peso Médio Und e Dias de Produção existem no Tradição mas **ficaram de fora**
> por decisão do Roberto (26/08) — não são de prevenção.

### Códigos do Intersolid (conferidos no ERP real)

```
tipo_especie: 0 MERCADORIA · 2 SERVICO · 3 IMOBILIZADO · 4 INSUMO · else OUTROS
tipo_evento:  0 Direta · 1 Decomposição · 2 Composição · 3 Produção · else Outros
pesavel:      'S' = pesável
```

⚠️ **Subgrupo não é único sozinho.** A chave é `(seção, grupo, subgrupo)`.
Juntar só por `codigo_subgrupo` traz o subgrupo de outra seção e o produto
aparece no lugar errado.

---

## 🔴 Por que a lista vem inteira, sem paginar no banco

São ~8 mil itens por loja e vêm **todos de uma vez**; o filtro roda no navegador.

Não é preguiça: o botão **"Selecionar todos do filtro (N)"** precisa saber
quantos itens o filtro pegou, inclusive os fora da página visível. Com paginação
no servidor esse N mentiria — e **seleção em massa que mente ativa produto
errado, em silêncio**.

A paginação de 50 linhas é só de exibição: 8 mil linhas no DOM travam o navegador.

---

## 🔴 Coluna obrigatória x OPCIONAL — a lição de 26/08

`exigencias.ts` tem dois campos: `colunas` (obrigatórias) e `opcionais`.

⚠️ **Coluna de filtro NÃO pode ser obrigatória.** Ao entrar `tipo_especie` &
companhia como obrigatórias, a tela inteira de Ativar Produtos morreu — sem
lista, sem contadores — num cliente cujo mapeamento tinha sido salvo antes de o
filtro existir. Adicionar exigência no código **não preenche mapeamento antigo**.

Hoje: coluna opcional sem mapeamento apenas **esconde o filtro** dela. A lista
funciona.

### O erro seguinte, que veio junto

Tornar opcional não bastava: a tela de Mapeamento e a descoberta iteravam só
`e.colunas`. As opcionais **sumiram da tela de Mapeamento** — o mapeamento
aparecia 100% completo enquanto Ativar Produtos reclamava de 8 colunas, e não
havia como mapeá-las.

Regra que fica: **toda coluna que o código pode usar tem de APARECER na tela de
Mapeamento**, obrigatória ou não. Opcional entra marcada como `opcional`, em
cinza (não vermelho — vazia não é erro) e fora da contagem de pendências.

> Nada de chutar nome de coluna Oracle como faz o sistema de origem
> (`TIPO_ESPECIE` como padrão). Chute quebra calado no cliente cujo ERP usa
> outro nome. Sem mapeamento → recurso desligado, e ponto.

---

## 🖼️ Fotos: MinIO com bucket PRIVADO

⚠️ **Diferença deliberada para o sistema de origem.**

| | Prevenção no Radar | RADAR 360 |
|---|---|---|
| Bucket | público | **privado** |
| Quem serve a imagem | o navegador fala direto com o MinIO | **o backend** |
| Porta do MinIO | publicada | **não publicada** |
| Configuração | endpoint interno **+** `minio_public_endpoint`, `_port`, `_use_ssl`, `_path` | uma só |

O endereço interno (`minio:9000`) não é o que o navegador alcança, então o
sistema de origem mantém um segundo conjunto de configurações públicas. **Errar
qualquer uma delas quebra TODAS as imagens de uma vez**, e a tela só mostra
ícone quebrado, sem dizer o motivo.

Servindo pelo backend some a classe inteira de problema: sem política de bucket,
sem CORS, sem console de administração exposto. Custa uma passada de bytes pelo
Node — irrelevante para foto de produto.

### Detalhes que importam

- **Chave nova a cada envio** (`<cod>-<8 hex>.<ext>`): reusar a mesma faz o
  navegador mostrar a foto antiga por cache. Como a chave é única, a resposta
  vai com `Cache-Control: immutable`.
- A foto anterior é **apagada** no envio da nova — senão o bucket cresce para
  sempre com imagens que nenhuma tela referencia.
- A rota que serve a imagem **não exige token**: `<img>` não manda cabeçalho
  `Authorization`. Protege o nome aleatório. ⚠️ **Não reaproveitar esse caminho
  para imagem com pessoa** (reconhecimento facial).
- `depends_on: minio: service_started` (não `healthy`): MinIO fora do ar **não
  pode impedir o RADAR de subir**. O bucket é criado sob demanda no 1º envio.
- Upload chega em **base64 no corpo JSON**, não multipart — evita uma
  dependência só para isso. Teto de 1,5 MB.

---

## Ver também
- [[modulos/leitor-codigo-barras]]
- [[arquitetura/mapeamento-tabelas]]

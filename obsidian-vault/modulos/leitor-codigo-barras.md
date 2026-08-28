---
tags: [modulo, leitor, coletor, bipagens, radar360]
atualizado: 2026-08-26
---

# Leitor de código de barras (coletor da loja)

Pacote Python que roda na **máquina da loja**: lê o coletor USB e manda cada
leitura para o servidor. É a porta de entrada das bipagens.

> Existe nos dois sistemas. No **Prevenção no Radar** (Tradição) fica em
> `barcode-installer.controller.ts` → `/api/bipagens/webhook`.
> No **RADAR 360** fica em `instalador-leitor.controller.ts` → `/api/coletor/bipagem`.

---

## 📦 O que o pacote contém

| Arquivo | Papel |
|---|---|
| `NOVO-INSTALAR.bat` | instala dependências e registra o serviço |
| `novo_instalador_visual.py` | GUI Tkinter: servidor, token, nome da máquina |
| `scanner_service.py` | o serviço: captura, fila em disco, envio |
| `raw_input_handler.py` | captura via Raw Input API do Windows |
| `device_manager.py` | identifica cada coletor por `device_path` |
| `INICIAR-SCANNER.bat` / `DESINSTALAR.bat` | operação |

⚠️ **Pré-requisito Python 3.8+ com "Add Python to PATH" marcado.** Sem o PATH o
serviço não inicia e a mensagem de erro não diz o porquê.

O Python **não foi reescrito** no RADAR 360 — foi portado. Só mudaram marca e
endpoint. Reescrever seria recomprar bugs de teclado, encoding e reconexão.

---

## 🔴 A regra que quebra tudo se esquecer: recusa responde 200

`scanner_service.py`, no `queue_worker`:

```python
if self.send_to_webhook(data):
    self.save_queue()
else:
    self.scan_queue.put(data)          # devolve pra fila
    time.sleep(self.config['RETRY_INTERVAL'])   # 30s
```

Qualquer resposta que **não** seja 200/201 volta pra fila e é tentada de novo —
sempre o **mesmo item**, que está na frente. Um único código inválido respondido
com `400` **trava a fila para sempre** e nenhuma bipagem seguinte chega.

**Recusa vai no corpo (`aceita: false`), nunca no status.** Vale para: entrada de
teclado, código não reconhecido, produto sem cadastro.

---

## 🏷️ Etiqueta de balança (EAN-13)

Layout: `[1 díg. esquema][PLU][campo variável][1 díg. verificador]`

| `d1` | Campo variável é | Exemplo |
|---|---|---|
| `2` | **preço** em centavos | `2037040050854` → PLU 03704, R$ 50,85 |
| `1` | **peso** em gramas | `1037040011559` → PLU 03704, 1,155 kg |

O que a etiqueta não traz sai por divisão pelo preço do quilo do ERP — usando o
**preço de oferta quando existe**, senão item em promoção calcula peso a menor.

⚠️ **Divisão por zero:** produto sem preço no ERP existe (cadastro incompleto).
`Infinity` estoura o INSERT em `numeric`. Tem teto no cálculo.

### `ean_digits` — quantos dígitos são o PLU

**Muda por cliente e até por balança.** `2 40075 003205 0` lido com 5 dígitos dá
PLU `40075`; com 6 dá `400750` — outro produto, ou nenhum, sem erro aparente.

- Sistema de origem: coluna em `equipments`.
- RADAR 360: `equipamentos.ean_digits`, editável em **Leitores** e no
  **Instalador do Leitor**. Padrão 5.

---

## 🤖 O leitor SE CADASTRA SOZINHO — não existe "novo leitor"

Este é o ponto que o RADAR 360 errou primeiro e teve que refazer (26/08).

Quem instala está **na loja, com o coletor na mão**, e não tem como saber o
identificador do scanner: ele só existe depois que o Windows enxerga o
dispositivo. Pedir cadastro antes é pedir para adivinhar.

O fluxo real, nos dois sistemas:

```
copia o token → instala o pacote → bipa um código → o leitor aparece na tela
```

### Identidade = o scanner FÍSICO

`findOrCreateByScannerId(scanner_id, machine_id, device_path)` busca **só** por
`scanner_id`.

⚠️ Incluir `machine_id` na busca faria o mesmo coletor virar um equipamento novo
toda vez que trocasse de computador, partindo o histórico do aparelho. Máquina e
porta são apenas **atualizados** quando mudam — é assim que a tela mostra onde o
aparelho está *agora* sem perder quem ele é.

Vários coletores no mesmo PC = vários leitores, um por porta USB.

### Porta USB sai do `device_path`

```
\\?\HID#VID_05E0&PID_1200#6&1f2a3b4c&0&0000#{...}
                             ↑ regex /#(\d+)&/
```
Serve só para achar o aparelho físico. Se o formato mudar, devolve vazio — nunca
quebra a bipagem por causa disso.

### ⚠️ O botão "Testar" do instalador não pode usar `/bipagem`

A versão original mandava `{"raw": "TESTE_INSTALACAO", "scanner_id": "TESTE"}`
pelo endpoint normal. Com auto-cadastro, **cada teste cria um leitor fantasma**
chamado TESTE — é de onde vêm as linhas `TEST` e `PC TESTE ESCRITORIO` na lista
do Tradição, e ninguém sabia a origem.

No RADAR 360 o teste usa `GET /api/coletor/testar`: confere o token, devolve de
qual loja ele é, **não grava nada**.

---

## 🔑 Token: a diferença entre os dois sistemas

O token identifica a **instalação**, não o leitor — no momento de instalar, o
equipamento ainda não existe para ter token próprio.

| | Prevenção no Radar | RADAR 360 |
|---|---|---|
| Escopo | **um** `API_TOKEN` pra tudo | **um por LOJA** |
| Guardado como | texto no banco | SHA-256 (hash) |
| Aparece | sempre, na tela de Segurança | **uma vez**, na geração |
| Revogar | troca em **todas** as lojas | só naquela loja |
| Loja do leitor | definida na mão depois | **vem do token** |

Por loja e não único do sistema por dois motivos: é ele que diz **em qual loja o
leitor nasce** (loja digitada errada faz a bipagem sumir do relatório certo), e
coletor perdido numa loja se corta sem derrubar as outras.

⚠️ Como é hash, **não há como mostrar de novo**. Perdeu, gera outro — mas gerar
outro derruba **todos os coletores daquela loja** até serem reinstalados.

Gera-se em **Instalador do Leitor**, escolhendo a loja.

---

## 👤 Login do operador por crachá

O funcionário **bipa o próprio crachá** e assume o leitor. Dali em diante as
bipagens saem no nome dele — é assim que a coluna *Vendedor* se preenche.

- Origem: detecta pelo prefixo **`3122`** (particularidade do Tradição).
- RADAR 360: **sem prefixo fixo** — se não é etiqueta de balança (`d1` 1 ou 2),
  procura em `funcionarios.codigo_barras`. Funciona em qualquer cliente.

⚠️ **A sessão expira em 12h.** Na origem ela ficava aberta até alguém deslogar —
e ninguém desloga: o coletor era desligado no fim do expediente e no dia seguinte
as bipagens continuavam saindo no nome de quem trabalhou na véspera. Atribuição
errada de furto é pior que atribuição nenhuma.

---

## ⏰ Hora: sempre a do SERVIDOR

O relógio do PC da loja vive errado (bateria de placa fraca) e já gerou bipagem
com horas de defasagem, que nunca casava com a venda. A leitura chega em tempo
real, então a hora do servidor **é** a hora da bipagem.

O `event_date` que o Python manda é ignorado no caminho `raw`.

---

## 📦 Produto não encontrado no ERP → grava assim mesmo

Marcada como `[SEM CADASTRO] PLU xxxxx`. Deliberado: **bipagem perdida é furto
que ninguém vê**; bipagem com descrição provisória ainda dá pra resolver depois.
ERP fora do ar não pode fazer o sistema perder leitura.

---

## Ver também
- [[bugs-resolvidos/2026-08-26-archiver-8-esm-quebra-instalador]]
- [[modulos/bipagens]]

# Projeto
Preciso desenvolver um projeto que o objetivo final será a prevenção e inteligencia contra furtos em um mercado.

## Critérios gerais
- Aqui terá um monorepo
- Para API, vamos usar express com typescript 
- Para FRONTEND, vamos usar react com typescript
- No backend, devemos ter um controle do banco de dados (migrations) usando algum ORM
- Aqui teremos um monorepo com front e backend
- Midificações no banco de dados só são aceitas usando migrations
- Utilize playwright-mcp para testar o frontend sempre que tiver uma tarefa de front para fazer
- Utilize context7 mcp para tomar conhecimento quando for fazer instalações de pacotes para o front ou backend
- Não é necessário fazer testes automatizados nesse projeto
- O projeto deve funcionar PERFEITAMENTE no mobile e desktop

## Epic 1 - Gerando base (OK)
### Tasks
1. Elaborar docker-compose para rodar back, front e postgress
2. Iniciar monorepo
3. Iniciar frontend (para o docker-compose utilizar npm run dev)
4. Iniciar backend (para o docker-compose utilizar npm run dev)
5. Instalar swegger na api 
6. Rodar swegger da api no docker-compose
7. Criar rota de health no backend
8. Documentar rota de health no swegger
9. Testar se tudo que foi desenvolvido está funcionando corretamente. Se necessário, utilize o MCP para validar o front e swegger


## Epic 2 - Gerando autenticação (OK)
### Tasks
1. Criar autenticação na api
2. Documentar autenticação da api no swegger
3. Criar tela de autenticação conectada com a api
4. Criar comando no package para criar um usuário passando email e senha
5. Criar tela de dashboard autenticada com texto simples "DASHBOARD" centralizado
6. Testar se tudo que foi desenvolvido está funcionando corretamente. Se necessário, utilize o MCP para validar o front e swegger


## Epic 3 - Adequando visual (OK)
### Tasks
1. Deixar o estilo da dashboard como em DASH VISUAL.jpg
2. Colocar no menu os mesmo itens contidos em FULL MENU.jpg
3. Usar LOGO.jpg como logo no menu e tela de login
4. Testar se tudo que foi desenvolvido está funcionando corretamente. Se necessário, utilize o MCP para validar o front e swegger


## Epic 4 - Visualização de "bipagens" - SOMENTE API (OK)
### DDL
CREATE TABLE bips ( id serial4 NOT NULL, ean varchar(20) NOT NULL, event_date timestamp NOT NULL, bip_price_cents int4 NOT NULL, product_id varchar(20) NOT NULL, product_description text NULL, product_full_price_cents_kg int4 NULL, product_discount_price_cents_kg int4 NULL, bip_weight numeric(12, 3) NULL, tax_cupon varchar(50) NULL, status varchar(20) DEFAULT 'pending'::character varying NOT NULL, CONSTRAINT bips_pkey PRIMARY KEY (id), CONSTRAINT bips_status_check CHECK (((status)::text = ANY ((ARRAY['verified'::character varying, 'notified'::character varying, 'pending'::character varying])::text[]))));

### DDL description
Essa é a tabela de bipagens, o objetivo dela é armazenar as leituras de código de barras de um estabeleciomento como açouge e posteriormente validar se essa saida do açougue se consolidou em venda no caixa.

id => ID gerado automaticamente
ean => Código de barras no padrão EAN-13, que é enviado pelo scanner
event_date => Data em que esse evento é recebido
bip_price_cents => Valor em centavos contido no EAN-13 (valor de venda)
product_id => ID do produto no ERP do cliente (PLU)
product_description => Descrição do produto no ERP do cliente
product_full_price_cents_kg  => Valor do produto no momento da bipagem em centavos
product_discount_price_cents_kg => Valor do produto - desconto no momento da bipagem em centavos
bip_weight => Calculo de quanto do produto foi vendido de acordo com o preço do produto e preço da bipagem
tax_cupon => Cupom fiscal quando a venda é consolidada
status => Status da validação de venda

Funciona assim, quando ocorre a "bipagem" desse código de barras, esse evento é enviado para um N8N que registra id, ean, event_date, bip_price_cents, product_id, product_description, product_full_price_cents_kg, product_discount_price_cents_kg, bip_weight e status = pending

As 5h da manhã ocorre um evento no N8N que vai validar todos os eventos do dia anterior com status pendente e puxar na api do ERP do cliente se há uma venda para aquele registro, se tiver, colocamos como verified (verificado) e colocamos o tax_cupon gerado para essa venda, se não tiver, então algo aconteceu com o produto que saiu do açougue e nesse caso, enviamos uma notificação no whatsapp do cliente e colocamos status = notified

Nada do que foi explicado até aqui precisa ter na API. Tudo já funciona e armazena os dados perfeitamente através do fluxo do n8n

### Tasks
1. Criar migration para bips na api (em produção a tabela já existe e possúi dados, por isso, é importante que seja create if not exists ou algo nesse sentido)
2. Criar rota autenticada na api para buscar as bipagens
    - Permitir paginação
    - Permitir filtro por data (hoje por padrão)
    - Permitir filtro por status da bipagem (pending, verified, notified)
    - Permitir filtro por produto
    - Deve ser permitido usar 1 ou N desses filtros juntos
3. Documentar rota de bipagens no swegger
4. Testar se tudo que foi desenvolvido está funcionando corretamente. Se necessário, utilize o MCP para validar o front e swegger


## Epic 5 - Gestão de produtos - SOMENTE API (OK)
### O que significa um produto ativo?
Um produto ativo, significa um produto para ser monitorado, essa é a base para a gestão futura de outro tipo de fraude, provavelmente devemos elaborar melhor no epic 6 ou 7

### Estrutura da tabela de produtos
Podemos pegar um padrão através da tabela de PRODUTOS.json (exemplo de retorno do ERP) e através disso, crir nosso proprio modelo para salvar. O que é importante é que erp_product_id exista para que a gente consiga saber os que estão ativos. Também é importante termos um "active" que vai sinalizar quando nós vamos monitorar aquele produto.

Só deve existir um registro de produto por codigo em produtos (unique por erp_product_id)

Nessa tabela não vamos salvar todos os produtos, só os que foram ativos ou inativos em algum momento

Não é necessário salvar valores no banco de dados pois esses valores podem ser atualizados no ERP, o que acabaria sendo um problema futuro (falta de sincronia). 

### Estrutura da tabela de historico de ativações (product_activation_history)
- user_id => quem ativou ou desativou um produto
- product_id => id do produto no nosso banco de dados
- active => valor que esse usuário mandou para ficar (se ativou ou desativou o produto)
- created_at => data da criação do registro para saber quando 

### Tasks
1. No .env, vamos configurar uma URL para buscar produtos de uma API externa, que retornará no formato de PRDUTOS.json
2. Criar tabela de produtos com base no exemplo de retorno e descrição da estrutura
3. Criar rota autenticada para buscar produtos
    - Basicamente vai ser um proxy para buscar na api do ERP (configurado no .env)
    - Para definir active, buscar na tabela de produtos
    - Se tiver active no nosso banco de dados, podemos colocar o campo "active = true" no retorno
    - Se tiver active = false no nosso banco de dados ou não existir, podemos colocar active = false no retorno
4. Criar rota autenticada para ativar um produto
    - Ao receber um ID de produto, vamos salvar esse produto em uma tabela para sinalizar que ele está ativo
    - Passar "active" que pode ser true ou false
    - Se o produto existir no banco, só altere o active
    - Se o produto não existir no banco, crie com active definido na request
    - Salvar alteração/criação em product_activation_history
5. Documente as duas request no swegger
6. Testar se tudo que foi desenvolvido está funcionando corretamente. Se necessário, utilize o MCP para validar o front e swegger


## Epic 6 - Proxy de vendas - SOMENTE API (OK)

### Tasks
1. Criar rota autenticada para buscar vendas no ERP (semelhante a produtos)
    - Basicamente vai ser um proxy para buscar na api do ERP (configurado no .env)
    - O retorno está documentado em VENDAS.json
    - Nenhum dado de venda deve ser salvo ainda
    - Essa api exige que enviemos o parametro dta_de e dta_ate, no formato YYYYMMDD, mas a nossa api, deve receber to e from no formato YYYY-MM-DD e converter para mandar para a api do ERP
    - use cache service para isso
    - não permita pegar vendas de hoje (retorne erro dizendo que só pode pegar vendas a partir de ontem)
2. Documente a rota de buscar vendas no swegger
3. Testar se tudo que foi desenvolvido está funcionando corretamente. Se necessário, utilize o MCP para validar o front e swegger


## Epic 7 - Armazenamento de vendas - CRON (OK)
O objetivo dessa épic é criarmos uma forma de armazenar as venda de produtos ativados que não tiveram saida no caixa, ou seja:
- Comando para executar todo dia as 5h que seguira o fluxo

### Fluxo inverso
- Buscar usando o service criado em epic 6 as vendas de ontem
- Filtrar do retorno somente vendas de produtos ativos no banco de dados
- Buscar bipagens de ontem (usando event_date) na tabela bips
- Para cada venda de produto ativo:
    - Filtrar se encontramos nas bipagens alguma (bater se codProduto de vendas exite product_id de bips e valTotalProduto de vendas é igual a bip_price_cents/100 de bips)
    - Se encontrar, salvar em sells o registro com status = validate
    - Se não encontrar, salvar em sells o registros com status = notified


### Estrutura da tabela sells
activated_product_id => id do produto ativo no nosso banco de dados
product_id => codProduto de vendas
product_description => desProduto de vendas
sell_date => dtaSaida de vendas, mas no formato YYYY-MM-DD
sell_value_cents => valTotalProduto de vendas, mas semente os números
product_weight => qtdTotalProduto em vendas
bip_id => id da bipagem (nullable) se existir
status => verified (tudo certo) ou notified (se a validação falhou)


### Tasks
1. Criar e executar migration para a tabela sells
2. Criar cron para executar todo dia as 5h
3. Criar service que vai executar o "fluxo" descrito na epic
4. Criar comando para executar o service instântaneamente tipo assim: "npm run sells:validate ---date 2025-09-16"
5. Criar rota autenticada na api para buscar as vendas (sells)
    - Permitir paginação
    - Permitir filtro por data (hoje por padrão)
    - Permitir filtro por status (verified, notified)
    - Permitir filtro por produto (dos ativados)
    - Deve ser permitido usar 1 ou N desses filtros juntos
6. Documentar rota de vendas no swegger
7. Testar se tudo que foi desenvolvido está funcionando corretamente. Se necessário, utilize o MCP para validar o front e swegger


## Epic 8 - Tela de bipagens (menu Bipagens Ao Vivo) - FRONTEND (OK)

### Tasks
- Desenvolver o frontend da tela para o menu já existente 
- Utilizar a API descrita e documentada em EPIC 4 para consultas
- permita filtrar de acordo com o swegger
- Utilize laze loading para carregar os dados 
- Testar se tudo que foi desenvolvido está funcionando corretamente. Se necessário, utilize o MCP para validar o front e swegger


## Epic 9 - Tela de gestão de produtos (menu Ativar Produtos) - FRONTEND (OK)

### Tasks
- Desenvolver o frontend da tela para o menu já existente 
- Utilizar a API descrita e documentada em EPIC 5 para fazer a gestão de produtos no frontend
7. Testar se tudo que foi desenvolvido está funcionando corretamente. Se necessário, utilize o MCP para validar o front e swegger


## Epic 10 - Tela de vendas (menu Resultados do Dia) - FRONTEND (OK)

### Tasks
- Desenvolver o frontend da tela para o menu já existente 
- Utilizar a API descrita e documentada em EPIC 7 para consultas
7. Testar se tudo que foi desenvolvido está funcionando corretamente. Se necessário, utilize o MCP para validar o front e swegger

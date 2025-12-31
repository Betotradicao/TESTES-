# 🤖 YOLO v8 Service - Análise de Produtos GRATUITA

Serviço de análise de imagens usando YOLO v8 para detectar características de produtos (carnes).

## ✨ Vantagens

- **100% GRÁTIS** - Sem custos de API
- **Rápido** - Análise em ~200ms por imagem
- **Local** - Roda no seu próprio servidor
- **Privado** - Imagens não são enviadas para nenhuma empresa
- **Escalável** - Pode analisar milhares de imagens por dia sem custo

## 📦 Instalação

### Windows

```bash
# 1. Instalar dependências
install.bat

# 2. Iniciar serviço
start.bat
```

### Linux/VPS

```bash
# 1. Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# 2. Instalar dependências
pip install -r requirements.txt

# 3. Iniciar serviço
python yolo_analyzer.py
```

## 🚀 Uso

O serviço roda na porta **5001** e expõe 3 endpoints:

### 1. Health Check

```bash
GET http://localhost:5001/health
```

### 2. Analisar Imagem

```bash
POST http://localhost:5001/analyze
Content-Type: multipart/form-data

Body:
- image: arquivo de imagem (JPG, PNG, etc)

Resposta:
{
  "coloracao": "vermelho escuro",
  "coloracao_rgb": "#8B0000",
  "formato": "retangular",
  "gordura_visivel": "pouca",
  "presenca_osso": false,
  "confianca": 85.5,
  "descricao_detalhada": "Produto com cor vermelho escuro..."
}
```

### 3. Comparar Imagens

```bash
POST http://localhost:5001/compare
Content-Type: application/json

Body:
{
  "image1": "base64_encoded_image",
  "image2": "base64_encoded_image"
}

Resposta:
{
  "similaridade": 87,
  "diferencas": ["Cor ligeiramente diferente"],
  "mesmo_produto": true
}
```

## 🔧 Integração com Backend

O backend Node.js já está configurado para usar este serviço automaticamente.

Variável de ambiente (opcional):
```
YOLO_SERVICE_URL=http://localhost:5001
```

## 📊 Performance

- Análise: ~200ms por imagem
- Comparação: ~400ms por par
- Custo: **R$ 0,00**

Comparado com OpenAI Vision:
- OpenAI: $0.01/imagem = R$ 30,00 por 100 imagens/dia
- YOLO: R$ 0,00 (sempre grátis!)

## 🎯 Características Detectadas

### Cor
- vermelho escuro
- vermelho
- rosa claro
- rosa
- branco amarelado
- branco
- marrom claro
- marrom
- misto

### Formato
- retangular
- redondo
- alongado
- cilindrico
- irregular

### Gordura Visível
- nenhuma (< 5%)
- pouca (5-15%)
- media (15-30%)
- muita (> 30%)

### Osso
- true/false (baseado em áreas muito brancas e rígidas)

## 🔄 Rodando em Produção (VPS)

### Com PM2

```bash
# Instalar PM2
npm install -g pm2

# Criar script de start
cat > start-yolo.sh << 'EOF'
#!/bin/bash
cd /path/to/yolo-service
source venv/bin/activate
python yolo_analyzer.py
EOF

chmod +x start-yolo.sh

# Iniciar com PM2
pm2 start start-yolo.sh --name yolo-service

# Salvar configuração
pm2 save
pm2 startup
```

### Com Docker (opcional)

```dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY yolo_analyzer.py .

EXPOSE 5001
CMD ["python", "yolo_analyzer.py"]
```

```bash
docker build -t yolo-service .
docker run -d -p 5001:5001 --name yolo yolo-service
```

## 🛠️ Troubleshooting

### Erro: "Serviço YOLO não está rodando"
- Verifique se o serviço está ativo: `curl http://localhost:5001/health`
- Inicie com: `start.bat` (Windows) ou `python yolo_analyzer.py` (Linux)

### Erro: "Modelo não encontrado"
- Na primeira execução, o YOLO baixará automaticamente o modelo (6MB)
- Aguarde o download completar

### Baixa precisão
- Considere treinar modelo customizado com suas próprias imagens de carnes
- Coletar ~500-1000 imagens de produtos reais
- Fine-tuning com ultralytics é simples e gratuito

## 📚 Próximos Passos

Para melhorar ainda mais a precisão:

1. **Coletar dataset próprio** - Tire 500+ fotos de produtos reais
2. **Anotar imagens** - Use LabelImg ou Roboflow (grátis)
3. **Treinar modelo customizado**:
   ```python
   from ultralytics import YOLO
   model = YOLO('yolov8n.pt')
   model.train(data='products.yaml', epochs=100)
   ```
4. **Deploy** - Substituir yolov8n.pt pelo modelo treinado

## 💡 Dicas

- Use GPU se disponível (10x mais rápido)
- Para GPU NVIDIA: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118`
- Modelo nano (6MB) é suficiente para produtos
- Modelo small (22MB) tem melhor precisão mas é mais lento

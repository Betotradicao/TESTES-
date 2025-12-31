"""
🤖 Serviço de Análise de Produtos com YOLO v8
Analisa imagens de produtos (carnes) e extrai características visuais
"""

from ultralytics import YOLO
import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import io
import base64
import os
from typing import Dict, Tuple, List

app = Flask(__name__)
CORS(app)

# Carregar modelo YOLO v8 (nano - mais leve e rápido)
# Para produção, você pode treinar um modelo customizado com imagens de carnes
model = YOLO('yolov8n.pt')  # nano model (6MB, muito rápido)

def extract_dominant_color(image_array: np.ndarray) -> Tuple[str, str]:
    """
    Extrai cor predominante da imagem usando K-means clustering
    Returns: (nome_cor, codigo_rgb)
    """
    # Redimensionar para acelerar processamento
    small = cv2.resize(image_array, (100, 100))

    # Converter BGR para RGB
    small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

    # Reshape para lista de pixels
    pixels = small.reshape(-1, 3)

    # Calcular cor média
    avg_color = pixels.mean(axis=0).astype(int)

    # Converter RGB para nome de cor aproximado
    r, g, b = avg_color

    color_name = ""
    if r > 180 and g < 100 and b < 100:
        color_name = "vermelho escuro"
    elif r > 150 and g > 100 and b < 100:
        color_name = "vermelho"
    elif r > 200 and g > 150 and b > 150:
        color_name = "rosa claro"
    elif r > 150 and g > 100 and b > 100:
        color_name = "rosa"
    elif r > 200 and g > 200 and b > 150:
        color_name = "branco amarelado"
    elif r > 200 and g > 200 and b > 200:
        color_name = "branco"
    elif r > 150 and g > 120 and b < 80:
        color_name = "marrom claro"
    elif r > 100 and g > 70 and b < 50:
        color_name = "marrom"
    else:
        color_name = "misto"

    # Código RGB hexadecimal
    rgb_code = f"#{r:02x}{g:02x}{b:02x}"

    return color_name, rgb_code


def detect_fat_percentage(image_array: np.ndarray) -> str:
    """
    Detecta quantidade de gordura branca visível
    Returns: "nenhuma", "pouca", "media", "muita"
    """
    # Converter para HSV para detectar áreas brancas/amareladas (gordura)
    hsv = cv2.cvtColor(image_array, cv2.COLOR_BGR2HSV)

    # Máscaras para detectar gordura (branco/amarelo)
    lower_white = np.array([0, 0, 180])
    upper_white = np.array([180, 50, 255])

    lower_yellow = np.array([20, 50, 150])
    upper_yellow = np.array([40, 255, 255])

    mask_white = cv2.inRange(hsv, lower_white, upper_white)
    mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)

    fat_mask = cv2.bitwise_or(mask_white, mask_yellow)

    # Calcular percentual de pixels de gordura
    total_pixels = image_array.shape[0] * image_array.shape[1]
    fat_pixels = cv2.countNonZero(fat_mask)
    fat_percentage = (fat_pixels / total_pixels) * 100

    if fat_percentage < 5:
        return "nenhuma"
    elif fat_percentage < 15:
        return "pouca"
    elif fat_percentage < 30:
        return "media"
    else:
        return "muita"


def detect_bone(image_array: np.ndarray) -> bool:
    """
    Detecta presença de osso (áreas muito brancas e rígidas)
    """
    # Converter para escala de cinza
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)

    # Detectar áreas muito brancas (osso)
    _, thresh = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY)

    # Contar pixels brancos
    white_pixels = cv2.countNonZero(thresh)
    total_pixels = gray.shape[0] * gray.shape[1]
    white_percentage = (white_pixels / total_pixels) * 100

    # Se mais de 10% for muito branco, provavelmente tem osso
    return white_percentage > 10


def detect_shape(results) -> str:
    """
    Detecta formato baseado no bounding box
    """
    if len(results[0].boxes) == 0:
        return "irregular"

    # Pegar primeira detecção
    box = results[0].boxes[0]
    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()

    width = x2 - x1
    height = y2 - y1

    aspect_ratio = width / height if height > 0 else 1

    # Classificar formato baseado em aspect ratio
    if 0.9 <= aspect_ratio <= 1.1:
        return "redondo"
    elif aspect_ratio > 1.5:
        return "alongado"
    elif aspect_ratio < 0.7:
        return "cilindrico"
    elif 0.7 <= aspect_ratio <= 1.3:
        return "retangular"
    else:
        return "irregular"


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'model': 'yolov8n'})


@app.route('/analyze', methods=['POST'])
def analyze_image():
    """
    Analisa imagem de produto e retorna características

    Request body:
    {
        "image": "base64_encoded_image" ou arquivo multipart
    }

    Response:
    {
        "coloracao": "vermelho escuro",
        "coloracao_rgb": "#8B0000",
        "formato": "retangular",
        "gordura_visivel": "pouca",
        "presenca_osso": false,
        "confianca": 85,
        "descricao_detalhada": "Produto com cor vermelho escuro..."
    }
    """
    try:
        # Receber imagem (base64 ou arquivo)
        if 'image' in request.files:
            # Upload de arquivo
            file = request.files['image']
            image = Image.open(file.stream)
        elif request.json and 'image' in request.json:
            # Base64
            image_data = base64.b64decode(request.json['image'])
            image = Image.open(io.BytesIO(image_data))
        else:
            return jsonify({'error': 'Nenhuma imagem fornecida'}), 400

        # Converter PIL para numpy array
        image_array = np.array(image)

        # Garantir que está em BGR (OpenCV format)
        if len(image_array.shape) == 2:
            # Grayscale
            image_array = cv2.cvtColor(image_array, cv2.COLOR_GRAY2BGR)
        elif image_array.shape[2] == 4:
            # RGBA
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGBA2BGR)
        elif image_array.shape[2] == 3:
            # RGB -> BGR
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)

        # Rodar YOLO detection
        results = model(image_array, verbose=False)

        # Extrair características
        coloracao, coloracao_rgb = extract_dominant_color(image_array)
        formato = detect_shape(results)
        gordura_visivel = detect_fat_percentage(image_array)
        presenca_osso = detect_bone(image_array)

        # Calcular confiança baseado nas detecções do YOLO
        if len(results[0].boxes) > 0:
            confianca = float(results[0].boxes[0].conf[0].cpu().numpy()) * 100
        else:
            confianca = 60  # Confiança base se não detectou objeto

        # Descrição detalhada
        descricao = f"Produto com cor {coloracao} ({coloracao_rgb}), formato {formato}, "
        descricao += f"gordura visível {gordura_visivel}"
        if presenca_osso:
            descricao += ", com presença de osso"
        descricao += "."

        return jsonify({
            'coloracao': coloracao,
            'coloracao_rgb': coloracao_rgb,
            'formato': formato,
            'gordura_visivel': gordura_visivel,
            'presenca_osso': presenca_osso,
            'confianca': round(confianca, 2),
            'descricao_detalhada': descricao
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/compare', methods=['POST'])
def compare_images():
    """
    Compara duas imagens e retorna score de similaridade

    Request body:
    {
        "image1": "base64_encoded_image",
        "image2": "base64_encoded_image"
    }

    Response:
    {
        "similaridade": 85,
        "diferencas": ["cor mais escura", "formato ligeiramente diferente"],
        "mesmo_produto": true
    }
    """
    try:
        # Receber imagens
        image1_data = base64.b64decode(request.json['image1'])
        image2_data = base64.b64decode(request.json['image2'])

        image1 = Image.open(io.BytesIO(image1_data))
        image2 = Image.open(io.BytesIO(image2_data))

        # Converter para numpy arrays
        img1_array = np.array(image1)
        img2_array = np.array(image2)

        # Redimensionar para mesmo tamanho
        size = (300, 300)
        img1_resized = cv2.resize(img1_array, size)
        img2_resized = cv2.resize(img2_array, size)

        # Calcular similaridade estrutural (SSIM)
        from skimage.metrics import structural_similarity as ssim

        # Converter para grayscale
        gray1 = cv2.cvtColor(img1_resized, cv2.COLOR_RGB2GRAY)
        gray2 = cv2.cvtColor(img2_resized, cv2.COLOR_RGB2GRAY)

        similarity_score = ssim(gray1, gray2)
        similarity_percentage = int(similarity_score * 100)

        # Analisar diferenças
        diferencas = []

        # Comparar cores
        color1, _ = extract_dominant_color(cv2.cvtColor(img1_resized, cv2.COLOR_RGB2BGR))
        color2, _ = extract_dominant_color(cv2.cvtColor(img2_resized, cv2.COLOR_RGB2BGR))
        if color1 != color2:
            diferencas.append(f"Cor diferente: {color1} vs {color2}")

        # Comparar gordura
        fat1 = detect_fat_percentage(cv2.cvtColor(img1_resized, cv2.COLOR_RGB2BGR))
        fat2 = detect_fat_percentage(cv2.cvtColor(img2_resized, cv2.COLOR_RGB2BGR))
        if fat1 != fat2:
            diferencas.append(f"Gordura diferente: {fat1} vs {fat2}")

        mesmo_produto = similarity_percentage >= 70

        return jsonify({
            'similaridade': similarity_percentage,
            'diferencas': diferencas,
            'mesmo_produto': mesmo_produto
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("🚀 Iniciando serviço YOLO v8...")
    print("📦 Modelo: YOLOv8n (Nano - 6MB)")
    print("🌐 Porta: 5001")
    print("✅ GRÁTIS - Sem custos de API!")

    # Baixar modelo na primeira execução
    if not os.path.exists('yolov8n.pt'):
        print("📥 Baixando modelo YOLO v8 nano (6MB)...")
        model = YOLO('yolov8n.pt')
        print("✅ Modelo baixado!")

    app.run(host='0.0.0.0', port=5001, debug=False)

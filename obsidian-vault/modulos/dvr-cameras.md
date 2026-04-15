# DVR e Câmeras

Integração com sistemas DVR das lojas para visualização de câmeras e análise de vídeos no PDV.

## 📂 Arquivos
- `VisualizarCameras.jsx` — grid de câmeras ao vivo
- `VisionPDV.jsx` — associa vídeo ao PDV
- `MonitorarEmailDVR.jsx` — monitora e-mails com alertas do DVR

## 🎥 Stream
Backend converte stream do DVR em H.264 via FFmpeg (libx264) para o browser.
- **H.264 nativo** → `copy` (mais rápido, sem transcodificação)
- **H.265/HEVC** → converte (browsers não suportam HEVC nativamente)

Detecção automática do codec.

## 🔌 Túneis DVR
Cada cliente tem túneis SSH reversos isolados pra conectar no DVR da rede local. Ver [[../arquitetura/estrutura-vps|Estrutura VPS]].

## 🏷️ Tags
#modulo #dvr #cameras #streaming

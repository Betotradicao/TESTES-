import { Request, Response } from 'express';
import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Controller para gerar instalador do Scanner Service (Barcode)
 *
 * Gera um pacote ZIP com todos os arquivos necessários para instalar
 * o serviço de captura de códigos de barras na máquina do cliente.
 *
 * Os arquivos Python são embutidos como templates e a configuração
 * (.env) é gerada com os valores informados pelo frontend.
 */
export class BarcodeInstallerController {

  /**
   * POST /api/barcode-installer/generate
   * Gera e retorna um ZIP com o instalador completo do Scanner Service
   */
  async generate(req: Request, res: Response) {
    try {
      const { domain, token, machineName } = req.body;

      if (!token) {
        return res.status(400).json({ success: false, message: 'Token é obrigatório' });
      }
      if (!machineName) {
        return res.status(400).json({ success: false, message: 'Nome da máquina é obrigatório' });
      }

      // Monta URL do webhook
      let webhookUrl: string;
      if (domain) {
        const cleanDomain = domain.replace(/^https?:\/\//, '');
        webhookUrl = `https://${cleanDomain}/api/bipagens/webhook`;
      } else {
        return res.status(400).json({ success: false, message: 'Domínio é obrigatório' });
      }

      // Gera conteúdo do .env
      const envContent = `# Configuração Scanner Service - Prevenção no Radar
# Gerado automaticamente pelo frontend
# Data: ${new Date().toISOString()}

WEBHOOK_URL=${webhookUrl}
AUTH_TOKEN=${token}
MACHINE_ID=${machineName}
USE_RAW_INPUT=true
RETRY_INTERVAL=30000
LOG_MAX_SIZE=10485760
`;

      // Configura resposta como ZIP
      const zipFileName = `ScannerService-${machineName.replace(/[^a-zA-Z0-9_-]/g, '')}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

      // Cria arquivo ZIP com archiver
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err: any) => {
        console.error('Erro ao gerar ZIP:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Erro ao gerar ZIP' });
        }
      });
      archive.pipe(res);

      // Pasta raiz dentro do ZIP
      const prefix = 'ScannerService/';

      // 1. .env (pré-configurado)
      archive.append(envContent, { name: `${prefix}.env` });

      // 2. requirements.txt
      archive.append(REQUIREMENTS_TXT, { name: `${prefix}requirements.txt` });

      // 3. INSTALAR.bat (simplificado - config já está no .env)
      archive.append(getInstallerBat(machineName), { name: `${prefix}INSTALAR.bat` });

      // 4. INICIAR-SCANNER.bat
      archive.append(INICIAR_SCANNER_BAT, { name: `${prefix}INICIAR-SCANNER.bat` });

      // 5. DESINSTALAR.bat
      archive.append(DESINSTALAR_BAT, { name: `${prefix}DESINSTALAR.bat` });

      // 6. scanner_service.py
      archive.append(SCANNER_SERVICE_PY, { name: `${prefix}scanner_service.py` });

      // 7. raw_input_handler.py
      archive.append(RAW_INPUT_HANDLER_PY, { name: `${prefix}raw_input_handler.py` });

      // 8. device_manager.py
      archive.append(DEVICE_MANAGER_PY, { name: `${prefix}device_manager.py` });

      await archive.finalize();

    } catch (error: any) {
      console.error('Erro ao gerar instalador barcode:', error);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, message: error.message });
      }
    }
  }

  /**
   * GET /api/barcode-installer/defaults
   * Retorna valores padrão para pré-preencher o formulário
   */
  async getDefaults(req: Request, res: Response) {
    try {
      const apiToken = process.env.API_TOKEN || '';
      const hostIp = process.env.HOST_IP || '';

      return res.json({
        success: true,
        defaults: {
          apiToken,
          hostIp
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

// ====================================================
// TEMPLATES DOS ARQUIVOS
// ====================================================

const REQUIREMENTS_TXT = `keyboard>=0.13.5
requests>=2.28.0
python-dotenv>=1.0.0
pywin32>=306
`;

function getInstallerBat(machineName: string): string {
  return `@echo off
:: ============================================
:: INSTALADOR - SCANNER SERVICE
:: Sistema Prevencao no Radar
:: Gerado automaticamente pelo frontend
:: ============================================

title Instalador Scanner Service - Prevencao no Radar

:: Verificar se esta rodando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ========================================
    echo   ERRO: PRECISA SER ADMINISTRADOR!
    echo ========================================
    echo.
    echo Este instalador precisa ser executado como Administrador.
    echo.
    echo Clique com botao direito neste arquivo e escolha:
    echo   "Executar como administrador"
    echo.
    echo ========================================
    pause
    exit /b 1
)

cls
echo.
echo ========================================
echo   INSTALADOR SCANNER SERVICE
echo   Sistema Prevencao no Radar
echo   Maquina: ${machineName}
echo ========================================
echo.

:: Mudar para o diretorio do script
cd /d "%~dp0"

:: Verificar se Python esta instalado
echo [PASSO 1/4] Verificando Python...
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ========================================
    echo   ERRO: PYTHON NAO ENCONTRADO!
    echo ========================================
    echo.
    echo Python nao esta instalado ou nao esta no PATH.
    echo.
    echo Por favor, instale Python 3.8+ de:
    echo https://www.python.org/downloads/
    echo.
    echo IMPORTANTE: Marque "Add Python to PATH" durante a instalacao!
    echo.
    echo ========================================
    pause
    exit /b 1
)
echo [OK] Python encontrado!
echo.

:: Instalar dependencias automaticamente
echo [PASSO 2/4] Instalando dependencias...
echo.
echo Instalando: keyboard, requests, pywin32, python-dotenv
echo Por favor aguarde...
echo.

python -m pip install --upgrade pip >nul 2>&1
python -m pip install -r requirements.txt

if %errorLevel% neq 0 (
    echo.
    echo ========================================
    echo   AVISO: Erro ao instalar dependencias
    echo ========================================
    echo.
    echo Tentando continuar mesmo assim...
    echo Algumas funcionalidades podem nao funcionar.
    echo.
    pause
)

echo.
echo [OK] Dependencias instaladas!
echo.

:: Limpar processos anteriores
echo [PASSO 3/4] Limpando instalacao anterior (se existir)...
wmic process where "name='pythonw.exe'" delete >nul 2>&1
schtasks /Delete /TN "Scanner Service" /F >nul 2>&1
timeout /t 2 /nobreak >nul
echo [OK] Limpeza concluida!
echo.

:: Configurar tarefa agendada + iniciar
echo [PASSO 4/4] Instalando servico e configurando inicio automatico...

set BAT_PATH=%~dp0INICIAR-SCANNER.bat
schtasks /Create /TN "Scanner Service" /TR "\\"%BAT_PATH%\\"" /SC ONLOGON /RL HIGHEST /F

if %errorLevel% neq 0 (
    echo.
    echo AVISO: Nao foi possivel criar tarefa agendada.
    echo O servico precisara ser iniciado manualmente.
    echo.
)

:: Iniciar servico agora
echo.
echo Iniciando Scanner Service...
start /B pythonw scanner_service.py debug
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================
echo.
echo O Scanner Service esta rodando em background.
echo.
echo Configuracao:
echo   Maquina: ${machineName}
echo   Inicio automatico: SIM (ao fazer login)
echo.
echo Basta conectar o scanner USB e escanear codigos.
echo Os scanners serao detectados automaticamente!
echo.
echo Para DESINSTALAR: execute DESINSTALAR.bat
echo.
echo ========================================
pause
`;
}

const INICIAR_SCANNER_BAT = `@echo off
TITLE Scanner Service - Prevencao no Radar
echo.
echo ========================================
echo   SCANNER SERVICE - PREVENCAO NO RADAR
echo ========================================
echo.
echo Iniciando Scanner Service em modo background...
echo.

cd /d "%~dp0"

REM Matar qualquer pythonw.exe existente
taskkill /F /IM pythonw.exe 2>nul

REM Iniciar em modo debug (background)
start /B pythonw scanner_service.py debug

timeout /t 3 /nobreak >nul

echo.
echo OK - Scanner Service iniciado com sucesso!
echo.
echo O servico esta rodando em background.
echo Feche esta janela.
echo.
pause
`;

const DESINSTALAR_BAT = `@echo off
:: ============================================
:: DESINSTALADOR - SCANNER SERVICE
:: Sistema Prevencao no Radar
:: ============================================

title Desinstalador Scanner Service - Prevencao no Radar

:: Verificar se esta rodando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ========================================
    echo   ERRO: PRECISA SER ADMINISTRADOR!
    echo ========================================
    echo.
    echo Este desinstalador precisa ser executado como Administrador.
    echo.
    echo Clique com botao direito neste arquivo e escolha:
    echo   "Executar como administrador"
    echo.
    echo ========================================
    pause
    exit /b 1
)

cls
echo.
echo ========================================
echo   DESINSTALADOR SCANNER SERVICE
echo   Sistema Prevencao no Radar
echo ========================================
echo.
echo Este script ira REMOVER COMPLETAMENTE:
echo   - Todos os processos do Scanner Service
echo   - Tarefas agendadas
echo   - Arquivo de lock
echo.
echo ========================================
echo.
pause

echo.
echo [1/4] Matando TODOS os processos pythonw.exe...
wmic process where "name='pythonw.exe'" delete >nul 2>&1
timeout /t 2 /nobreak >nul
echo       OK - Processos encerrados

echo.
echo [2/4] Removendo tarefas agendadas...
schtasks /Delete /TN "Scanner Service" /F >nul 2>&1
timeout /t 1 /nobreak >nul
echo       OK - Tarefas removidas

echo.
echo [3/4] Removendo arquivo de lock...
del "%TEMP%\\scanner_service.lock" /F /Q >nul 2>&1
echo       OK - Lock removido

echo.
echo [4/4] Limpando configuracoes de scanners...
del scanners.json /F /Q >nul 2>&1
echo       OK - Configuracoes limpas

echo.
echo ========================================
echo   DESINSTALACAO CONCLUIDA!
echo ========================================
echo.
echo Todos os componentes do Scanner Service
echo foram removidos com sucesso.
echo.
echo Para reinstalar, execute INSTALAR.bat
echo.
echo ========================================
pause
`;

// ====================================================
// ARQUIVOS PYTHON (fonte do barcode-service)
// ====================================================

const SCANNER_SERVICE_PY = `#!/usr/bin/env python3
"""
Scanner Service para Windows
Sistema de captura de leituras de codigo de barras via scanner USB
Gerado automaticamente pelo Sistema Prevencao no Radar
"""

import json
import logging
import os
import threading
import time
from datetime import datetime
from pathlib import Path
from queue import Queue
from typing import Dict, Any, Optional
import signal
import sys
import msvcrt

try:
    import keyboard
    import requests
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    from dotenv import load_dotenv
    from raw_input_handler import RawInputScanner
    from device_manager import DeviceManager
except ImportError as e:
    print(f"Erro: Dependencia nao encontrada: {e}")
    print("Instale as dependencias com: pip install keyboard requests python-dotenv pywin32")
    sys.exit(1)


LOCK_FILE = os.path.join(os.environ.get('TEMP', 'C:\\\\Windows\\\\Temp'), 'scanner_service.lock')
lock_file_handle = None


def acquire_lock():
    global lock_file_handle
    try:
        lock_file_handle = open(LOCK_FILE, 'w')
        msvcrt.locking(lock_file_handle.fileno(), msvcrt.LK_NBLCK, 1)
        lock_file_handle.write(str(os.getpid()))
        lock_file_handle.flush()
        return True
    except (IOError, OSError):
        print("ERRO: Outra instancia do Scanner Service ja esta rodando!")
        if lock_file_handle:
            lock_file_handle.close()
        return False


def release_lock():
    global lock_file_handle
    if lock_file_handle:
        try:
            msvcrt.locking(lock_file_handle.fileno(), msvcrt.LK_UNLCK, 1)
            lock_file_handle.close()
            os.remove(LOCK_FILE)
        except:
            pass


class DebugService:
    def __init__(self):
        self.is_running = True
        self.config = {}
        self.load_config()
        self.setup_logging()
        self.scan_buffer = ""
        self.last_scan_time = 0
        self.scan_timeout = 1.0
        self.scan_queue = Queue()
        self.queue_file = Path(self.config.get('QUEUE_FILE', 'scanner_queue.json'))
        self.load_queue()
        self.pid_file = Path('scanner.pid')
        self.write_pid()
        self.logger.info("Scanner Service inicializado (modo debug)")

    def load_config(self):
        script_dir = Path(__file__).parent.absolute()
        os.chdir(script_dir)
        env_path = script_dir / '.env'
        if env_path.exists():
            load_dotenv(env_path)
        self.config = {
            'WEBHOOK_URL': os.getenv('WEBHOOK_URL', ''),
            'AUTH_TOKEN': os.getenv('AUTH_TOKEN', ''),
            'LOG_MAX_SIZE': int(os.getenv('LOG_MAX_SIZE', '10485760')),
            'RETRY_INTERVAL': int(os.getenv('RETRY_INTERVAL', '30000')) / 1000,
            'QUEUE_FILE': os.getenv('QUEUE_FILE', 'scanner_queue.json'),
            'USE_RAW_INPUT': os.getenv('USE_RAW_INPUT', 'true').lower() == 'true',
            'MACHINE_ID': os.getenv('MACHINE_ID', os.environ.get('COMPUTERNAME', 'UNKNOWN'))
        }

    def setup_logging(self):
        log_dir = Path('logs')
        log_dir.mkdir(exist_ok=True)
        log_file = log_dir / 'scanner-service.log'
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        self.logger = logging.getLogger('ScannerService')
        self.logger.setLevel(logging.INFO)
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
        if log_file.exists() and log_file.stat().st_size > self.config['LOG_MAX_SIZE']:
            backup_file = log_dir / f'scanner-service-{int(time.time())}.log'
            log_file.rename(backup_file)

    def write_pid(self):
        try:
            with open(self.pid_file, 'w') as f:
                f.write(str(os.getpid()))
        except Exception as e:
            self.logger.error(f"Erro ao escrever PID: {e}")

    def remove_pid(self):
        try:
            if self.pid_file.exists():
                self.pid_file.unlink()
        except Exception as e:
            self.logger.error(f"Erro ao remover PID: {e}")

    def load_queue(self):
        if self.queue_file.exists():
            try:
                with open(self.queue_file, 'r', encoding='utf-8') as f:
                    queue_data = json.load(f)
                    for item in queue_data:
                        self.scan_queue.put(item)
                self.logger.info(f"Fila carregada: {len(queue_data)} itens pendentes")
            except Exception as e:
                self.logger.error(f"Erro ao carregar fila: {e}")
                self.save_queue()

    def save_queue(self):
        try:
            queue_data = []
            temp_queue = Queue()
            while not self.scan_queue.empty():
                try:
                    item = self.scan_queue.get_nowait()
                    queue_data.append(item)
                    temp_queue.put(item)
                except:
                    break
            while not temp_queue.empty():
                self.scan_queue.put(temp_queue.get_nowait())
            self.queue_file.parent.mkdir(exist_ok=True)
            with open(self.queue_file, 'w', encoding='utf-8') as f:
                json.dump(queue_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            self.logger.error(f"Erro ao salvar fila: {e}")

    def process_scan(self, code, scanner_id="UNKNOWN", device_path=None):
        try:
            scan_data = {
                "raw": code,
                "event_date": datetime.utcnow().isoformat() + "Z",
                "scanner_id": scanner_id,
                "machine_id": self.config.get('MACHINE_ID', 'UNKNOWN')
            }
            if device_path:
                scan_data["device_path"] = device_path
            self.scan_queue.put(scan_data)
            self.save_queue()
            self.logger.info(f"Codigo capturado de {scanner_id}: {code}")
        except Exception as e:
            self.logger.error(f"Erro ao processar scan: {e}")

    def send_to_webhook(self, data):
        try:
            if not self.config['WEBHOOK_URL']:
                self.logger.error("WEBHOOK_URL nao configurado")
                return False
            headers = {'Content-Type': 'application/json'}
            if self.config['AUTH_TOKEN']:
                headers['Authorization'] = f"Bearer {self.config['AUTH_TOKEN']}"
            response = requests.post(
                self.config['WEBHOOK_URL'],
                json=data,
                headers=headers,
                timeout=30,
                verify=False
            )
            if response.status_code in [200, 201]:
                self.logger.info(f"Dados enviados com sucesso: {data['raw']}")
                return True
            else:
                self.logger.error(f"Webhook retornou status {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Erro de conexao com webhook: {e}")
            return False
        except Exception as e:
            self.logger.error(f"Erro ao enviar para webhook: {e}")
            return False

    def queue_worker(self):
        while self.is_running:
            try:
                if not self.scan_queue.empty():
                    data = self.scan_queue.get_nowait()
                    if self.send_to_webhook(data):
                        self.save_queue()
                    else:
                        self.scan_queue.put(data)
                        time.sleep(self.config['RETRY_INTERVAL'])
                else:
                    time.sleep(1)
            except Exception as e:
                self.logger.error(f"Erro no worker da fila: {e}")
                time.sleep(5)


def run_debug():
    print("Executando em modo debug - Ctrl+C para parar")

    if not acquire_lock():
        print("Nao foi possivel adquirir lock. Outra instancia ja esta rodando.")
        sys.exit(1)

    service = DebugService()

    def signal_handler(sig, frame):
        print("\\nParando servico...")
        service.is_running = False
        release_lock()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    worker_thread = threading.Thread(target=service.queue_worker, daemon=True)
    worker_thread.start()

    use_raw_input = service.config.get('USE_RAW_INPUT', True)

    if use_raw_input:
        print("Modo: Raw Input API (identifica multiplos scanners)")
        device_manager = DeviceManager(logger=service.logger)

        def raw_input_callback(code, device_path):
            if not device_manager.is_device_known(device_path):
                if not code.isdigit():
                    service.logger.debug(f"Ignorando entrada de dispositivo desconhecido")
                    return
                service.logger.info(f"Novo scanner detectado: {device_path}")
            scanner_id = device_manager.get_or_create_scanner(device_path)
            service.process_scan(code, scanner_id, device_path)

        raw_scanner = RawInputScanner(
            callback=raw_input_callback,
            logger=service.logger
        )
        raw_scanner.set_device_manager(device_manager)
        raw_scanner.start()

        print("Servico ativo - scanner pronto para capturar codigos (Raw Input)")
        print("Pressione Ctrl+C para parar")

        try:
            while service.is_running:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            raw_scanner.stop()
            service.save_queue()
            service.remove_pid()
            release_lock()
    else:
        print("Modo: Keyboard Hook (modo legado)")
        keyboard.on_press(service.on_key_press)
        print("Servico ativo - Keyboard Hook")

        try:
            while service.is_running:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            keyboard.unhook_all()
            service.save_queue()
            service.remove_pid()
            release_lock()


def main():
    if len(sys.argv) == 1:
        run_debug()
    else:
        command = sys.argv[1].lower()
        if command == 'debug':
            run_debug()
        else:
            print(f"""
Uso: {sys.argv[0]} [comando]

Comandos:
  debug    - Executar em modo debug (console/background)

Sem comando: Executar em modo debug
""")


if __name__ == '__main__':
    main()
`;

const RAW_INPUT_HANDLER_PY = `#!/usr/bin/env python3
"""
Raw Input Handler - Captura de codigos de barras com identificacao de dispositivo
Usa Windows Raw Input API para diferenciar multiplos scanners USB
"""

import win32gui
import win32con
import win32api
import threading
import time
import logging
from ctypes import (
    windll, Structure, POINTER, c_long, c_ulong, c_ushort,
    c_uint, c_void_p, sizeof, byref, cast, WINFUNCTYPE
)
from typing import Callable, Dict, Optional


class RAWINPUTDEVICE(Structure):
    _fields_ = [
        ("usUsagePage", c_ushort),
        ("usUsage", c_ushort),
        ("dwFlags", c_uint),
        ("hwndTarget", c_void_p)
    ]


class RAWINPUTHEADER(Structure):
    _fields_ = [
        ("dwType", c_uint),
        ("dwSize", c_uint),
        ("hDevice", c_void_p),
        ("wParam", c_void_p)
    ]


class RAWKEYBOARD(Structure):
    _fields_ = [
        ("MakeCode", c_ushort),
        ("Flags", c_ushort),
        ("Reserved", c_ushort),
        ("VKey", c_ushort),
        ("Message", c_uint),
        ("ExtraInformation", c_ulong)
    ]


class RAWINPUT(Structure):
    class _U(Structure):
        _fields_ = [
            ("keyboard", RAWKEYBOARD)
        ]
    _fields_ = [
        ("header", RAWINPUTHEADER),
        ("data", _U)
    ]


WM_INPUT = 0x00FF
RIM_TYPEKEYBOARD = 1
RIDEV_INPUTSINK = 0x00000100
RIDEV_DEVNOTIFY = 0x00002000
RID_INPUT = 0x10000003
RIDI_DEVICENAME = 0x20000007
VK_RETURN = 0x0D
VK_SHIFT = 0x10
VK_CONTROL = 0x11
VK_MENU = 0x12


class RawInputScanner:
    def __init__(self, callback, logger=None):
        self.callback = callback
        self.logger = logger or logging.getLogger(__name__)
        self.device_buffers = {}
        self.last_input_time = {}
        self.input_timeout = 1.0
        self.device_manager = None
        self.running = False
        self.hwnd = None
        self.thread = None
        self.shift_pressed = False

    def set_device_manager(self, device_manager):
        self.device_manager = device_manager

    def start(self):
        if self.running:
            self.logger.warning("Scanner ja esta rodando")
            return
        self.running = True
        self.thread = threading.Thread(target=self._run_message_loop, daemon=True)
        self.thread.start()
        self.logger.info("Raw Input Scanner iniciado")

    def stop(self):
        self.running = False
        if self.hwnd:
            try:
                win32gui.PostMessage(self.hwnd, win32con.WM_QUIT, 0, 0)
            except:
                pass
        self.logger.info("Raw Input Scanner parado")

    def _run_message_loop(self):
        try:
            wc = win32gui.WNDCLASS()
            wc.lpfnWndProc = self._wndproc
            wc.lpszClassName = "RawInputScannerWindow"
            wc.hInstance = win32api.GetModuleHandle(None)
            try:
                class_atom = win32gui.RegisterClass(wc)
            except win32gui.error:
                pass
            self.hwnd = win32gui.CreateWindow(
                "RawInputScannerWindow", "Scanner Window",
                0, 0, 0, 0, 0, 0, 0, wc.hInstance, None
            )
            self.logger.info(f"Janela criada: HWND={self.hwnd}")
            self._register_raw_input_devices()
            self.logger.info("Iniciando message loop...")
            win32gui.PumpMessages()
        except Exception as e:
            self.logger.error(f"Erro no message loop: {e}", exc_info=True)

    def _register_raw_input_devices(self):
        rid = RAWINPUTDEVICE()
        rid.usUsagePage = 0x01
        rid.usUsage = 0x06
        rid.dwFlags = RIDEV_INPUTSINK | RIDEV_DEVNOTIFY
        rid.hwndTarget = self.hwnd
        result = windll.user32.RegisterRawInputDevices(
            byref(rid), 1, sizeof(RAWINPUTDEVICE)
        )
        if not result:
            error = win32api.GetLastError()
            raise Exception(f"Falha ao registrar Raw Input devices. Error: {error}")
        self.logger.info("Raw Input devices registrados com sucesso")

    def _wndproc(self, hwnd, msg, wparam, lparam):
        if msg == WM_INPUT:
            self._handle_raw_input(lparam)
            return 0
        elif msg == win32con.WM_DESTROY:
            win32gui.PostQuitMessage(0)
            return 0
        return win32gui.DefWindowProc(hwnd, msg, wparam, lparam)

    def _handle_raw_input(self, lparam):
        try:
            size = c_uint()
            windll.user32.GetRawInputData(
                lparam, RID_INPUT, None, byref(size), sizeof(RAWINPUTHEADER)
            )
            buffer = (c_uint * (size.value // 4 + 1))()
            result = windll.user32.GetRawInputData(
                lparam, RID_INPUT, byref(buffer), byref(size), sizeof(RAWINPUTHEADER)
            )
            if result != size.value:
                return
            raw = cast(buffer, POINTER(RAWINPUT)).contents
            if raw.header.dwType != RIM_TYPEKEYBOARD:
                return
            h_device = raw.header.hDevice
            device_id = self._get_device_id(h_device)
            keyboard_data = raw.data.keyboard
            vkey = keyboard_data.VKey
            is_keydown = (keyboard_data.Flags & 0x01) == 0
            if is_keydown:
                self._process_key(device_id, vkey)
        except Exception as e:
            self.logger.error(f"Erro ao processar Raw Input: {e}", exc_info=True)

    def _get_device_id(self, h_device):
        try:
            size = c_uint()
            windll.user32.GetRawInputDeviceInfoA(
                h_device, RIDI_DEVICENAME, None, byref(size)
            )
            buffer = (c_uint * (size.value // 4 + 1))()
            windll.user32.GetRawInputDeviceInfoA(
                h_device, RIDI_DEVICENAME, byref(buffer), byref(size)
            )
            device_path = cast(buffer, c_void_p).value
            if device_path:
                device_name = bytes(buffer).decode('ascii', errors='ignore').split('\\x00')[0]
            else:
                device_name = f"DEVICE_{h_device}"
            return device_name
        except Exception as e:
            self.logger.error(f"Erro ao obter device ID: {e}")
            return f"UNKNOWN_{h_device}"

    def _process_key(self, device_id, vkey):
        current_time = time.time()
        if device_id not in self.device_buffers:
            self.device_buffers[device_id] = ""
            self.last_input_time[device_id] = current_time
        if current_time - self.last_input_time.get(device_id, 0) > self.input_timeout:
            self.device_buffers[device_id] = ""
        self.last_input_time[device_id] = current_time
        if vkey == VK_SHIFT:
            self.shift_pressed = True
            return
        elif vkey == VK_CONTROL or vkey == VK_MENU:
            return
        if vkey == VK_RETURN:
            code = self.device_buffers[device_id].strip()
            if code:
                code = code[-15:]
                self.logger.info(f"Codigo lido de {device_id}: {code}")
                try:
                    self.callback(code, device_id)
                except Exception as e:
                    self.logger.error(f"Erro no callback: {e}", exc_info=True)
            self.device_buffers[device_id] = ""
            return
        char = self._vkey_to_char(vkey)
        if char:
            self.device_buffers[device_id] += char
            if len(self.device_buffers[device_id]) > 50:
                self.device_buffers[device_id] = self.device_buffers[device_id][-50:]

    def _vkey_to_char(self, vkey):
        if 0x30 <= vkey <= 0x39:
            return chr(vkey)
        if 0x41 <= vkey <= 0x5A:
            char = chr(vkey)
            return char if not self.shift_pressed else char.upper()
        if 0x60 <= vkey <= 0x69:
            return str(vkey - 0x60)
        char_map = {
            0xBD: '-', 0xBB: '=', 0xBA: ':',
            0xDB: '[', 0xDD: ']', 0xDC: '\\\\',
            0xBF: '/', 0xBE: '.', 0xBC: ','
        }
        return char_map.get(vkey, None)
`;

const DEVICE_MANAGER_PY = `#!/usr/bin/env python3
"""
Device Manager - Gerencia mapeamento de dispositivos Raw Input para IDs amigaveis
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime
import re
from dotenv import load_dotenv


class DeviceManager:
    def __init__(self, config_file="scanners.json", logger=None):
        self.config_file = Path(config_file)
        self.logger = logger or logging.getLogger(__name__)
        self.devices = {}
        script_dir = Path(__file__).parent.absolute()
        env_path = script_dir / '.env'
        if env_path.exists():
            load_dotenv(env_path)
        self.machine_id = os.getenv('MACHINE_ID', 'SCANNER')
        self.logger.info(f"MACHINE_ID carregado do .env: {self.machine_id}")
        self.load_config()

    def load_config(self):
        if not self.config_file.exists():
            self.logger.warning(f"Arquivo de configuracao nao encontrado: {self.config_file}. Criando...")
            self.devices = {}
            self.save_config()
            return
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.devices = {}
            for scanner in data.get('scanners', []):
                device_path = scanner.get('device_path')
                if device_path:
                    self.devices[device_path] = scanner
            self.logger.info(f"Carregados {len(self.devices)} scanners configurados")
        except Exception as e:
            self.logger.error(f"Erro ao carregar configuracao: {e}")
            self.devices = {}

    def save_config(self):
        try:
            data = {"scanners": list(self.devices.values())}
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            self.logger.info(f"Configuracao salva: {len(self.devices)} scanners")
        except Exception as e:
            self.logger.error(f"Erro ao salvar configuracao: {e}")

    def get_friendly_name(self, device_path):
        if device_path in self.devices:
            return self.devices[device_path].get('friendly_name')
        return None

    def get_or_create_scanner(self, device_path):
        friendly_name = self.get_friendly_name(device_path)
        if friendly_name:
            return friendly_name
        friendly_name = self.get_next_scanner_id()
        vid_pid = self._extract_vid_pid(device_path)
        self.devices[device_path] = {
            'device_path': device_path,
            'friendly_name': friendly_name,
            'description': f'Scanner detectado automaticamente em {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
            'vid_pid': vid_pid
        }
        self.save_config()
        self.logger.info(f"Novo scanner registrado: {friendly_name} -> {device_path}")
        return friendly_name

    def is_device_known(self, device_path):
        if device_path in self.devices:
            return True
        vid_pid = self._extract_vid_pid(device_path)
        if vid_pid:
            for path in self.devices.keys():
                if self._extract_vid_pid(path) == vid_pid:
                    return True
        return False

    def _extract_vid_pid(self, device_path):
        try:
            match = re.search(r'VID_([0-9A-F]{4})&PID_([0-9A-F]{4})', device_path, re.IGNORECASE)
            if match:
                return f"VID_{match.group(1)}&PID_{match.group(2)}".upper()
        except:
            pass
        return None

    def get_next_scanner_id(self):
        existing_ids = []
        for info in self.devices.values():
            name = info.get('friendly_name', '')
            if name.startswith('SCANNER_'):
                try:
                    num = int(name.split('_')[1])
                    existing_ids.append(num)
                except:
                    pass
        if not existing_ids:
            return "SCANNER_02"
        next_id = max(existing_ids) + 1
        return f"SCANNER_{next_id:02d}"

    def list_devices(self):
        return list(self.devices.values())
`;

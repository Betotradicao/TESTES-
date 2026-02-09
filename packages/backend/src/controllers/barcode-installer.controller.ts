import { Request, Response } from 'express';
import archiver from 'archiver';

/**
 * Controller para gerar pacote ZIP do Scanner Service (Barcode)
 *
 * Gera um ZIP com todos os arquivos necessários para instalar o serviço
 * de captura de código de barras na máquina do cliente.
 * O usuário extrai, roda NOVO-INSTALAR.bat e a GUI Tkinter abre.
 */
export class BarcodeInstallerController {

  /**
   * GET /api/barcode-installer/download
   * Retorna ZIP com todos os arquivos do instalador
   */
  async download(req: Request, res: Response) {
    try {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="ScannerService-Instalador.zip"');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err: any) => {
        console.error('Erro ao gerar ZIP:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Erro ao gerar ZIP' });
        }
      });
      archive.pipe(res);

      const p = 'INSTALADOR/';

      // BATs
      archive.append(NOVO_INSTALAR_BAT, { name: `${p}NOVO-INSTALAR.bat` });
      archive.append(INICIAR_SCANNER_BAT, { name: `${p}INICIAR-SCANNER.bat` });
      archive.append(DESINSTALAR_BAT, { name: `${p}DESINSTALAR.bat` });

      // Python
      archive.append(REQUIREMENTS_TXT, { name: `${p}requirements.txt` });
      archive.append(NOVO_INSTALADOR_VISUAL_PY, { name: `${p}novo_instalador_visual.py` });
      archive.append(SCANNER_SERVICE_PY, { name: `${p}scanner_service.py` });
      archive.append(RAW_INPUT_HANDLER_PY, { name: `${p}raw_input_handler.py` });
      archive.append(DEVICE_MANAGER_PY, { name: `${p}device_manager.py` });

      await archive.finalize();

    } catch (error: any) {
      console.error('Erro ao gerar instalador barcode:', error);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, message: error.message });
      }
    }
  }
}

// ==========================================
// TEMPLATES DOS ARQUIVOS
// ==========================================

const REQUIREMENTS_TXT = `keyboard>=0.13.5
requests>=2.28.0
python-dotenv>=1.0.0
pywin32>=306
`;

const NOVO_INSTALAR_BAT = `@echo off
:: ============================================
:: NOVO INSTALADOR - SCANNER SERVICE
:: Sistema Prevencao no Radar
:: VERSAO COM SUPORTE A DOMINIO (Multi-tenant)
:: ============================================

title NOVO Instalador Scanner Service - Prevencao no Radar

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
echo   NOVO INSTALADOR SCANNER SERVICE
echo   Sistema Prevencao no Radar
echo   (COM SUPORTE A DOMINIO)
echo ========================================
echo.

:: Mudar para o diretorio do script (corrige bug ao executar como Admin)
cd /d "%~dp0"

:: Verificar se Python esta instalado
echo [PASSO 1/3] Verificando Python...
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
echo [PASSO 2/3] Instalando dependencias...
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

:: Executar o NOVO instalador visual com suporte a dominio
echo [PASSO 3/3] Iniciando NOVO instalador visual...
echo.
python novo_instalador_visual.py

if %errorLevel% neq 0 (
    echo.
    echo ========================================
    echo   ERRO AO EXECUTAR INSTALADOR
    echo ========================================
    echo.
    echo Verifique se o Python esta instalado corretamente.
    echo.
    pause
    exit /b 1
)

exit /b 0
`;

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

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ========================================
    echo   ERRO: PRECISA SER ADMINISTRADOR!
    echo ========================================
    echo.
    echo Clique com botao direito neste arquivo e escolha:
    echo   "Executar como administrador"
    echo.
    pause
    exit /b 1
)

cls
echo.
echo ========================================
echo   DESINSTALADOR SCANNER SERVICE
echo ========================================
echo.
echo Este script ira REMOVER COMPLETAMENTE:
echo   - Todos os processos do Scanner Service
echo   - Tarefas agendadas
echo   - Arquivo de lock
echo.
pause

echo.
echo [1/4] Matando processos pythonw.exe...
wmic process where "name='pythonw.exe'" delete >nul 2>&1
timeout /t 2 /nobreak >nul
echo       OK

echo.
echo [2/4] Removendo tarefas agendadas...
schtasks /Delete /TN "Scanner Service" /F >nul 2>&1
timeout /t 1 /nobreak >nul
echo       OK

echo.
echo [3/4] Removendo arquivo de lock...
del "%TEMP%\\scanner_service.lock" /F /Q >nul 2>&1
echo       OK

echo.
echo [4/4] Limpando configuracoes de scanners...
del scanners.json /F /Q >nul 2>&1
echo       OK

echo.
echo ========================================
echo   DESINSTALACAO CONCLUIDA!
echo ========================================
echo.
echo Para reinstalar, execute NOVO-INSTALAR.bat
echo.
pause
`;

// ==========================================
// NOVO INSTALADOR VISUAL (Tkinter GUI)
// ==========================================

const NOVO_INSTALADOR_VISUAL_PY = String.raw`"""
NOVO INSTALADOR VISUAL - SCANNER SERVICE
Sistema Prevencao no Radar

Instalador visual para uso em clientes finais.
Interface simples para configurar e instalar o servico de scanner.

VERSAO COM SUPORTE A DOMINIO (Multi-tenant)
"""

import tkinter as tk
from tkinter import ttk, messagebox
import os
import socket
import subprocess
import sys
from pathlib import Path
import requests
from dotenv import set_key
import time
from datetime import datetime

class InstaladorVisual:
    def __init__(self, root):
        self.root = root
        self.root.title("NOVO Instalador - Scanner Service | Prevencao no Radar (Multi-tenant)")
        self.root.geometry("700x750")
        self.root.resizable(True, True)
        self.cor_sucesso = "#28a745"
        self.cor_erro = "#dc3545"
        self.cor_aviso = "#ffc107"
        self.cor_info = "#17a2b8"
        self.env_file = Path(".env")
        self.local_ip = self.get_local_ip()
        self.create_widgets()

    def get_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.1)
            try:
                s.connect(('10.255.255.255', 1))
                ip = s.getsockname()[0]
            except Exception:
                ip = '127.0.0.1'
            finally:
                s.close()
            return ip
        except Exception:
            return '127.0.0.1'

    def create_widgets(self):
        header_frame = tk.Frame(self.root, bg="#2c3e50", height=80)
        header_frame.pack(fill=tk.X)
        header_frame.pack_propagate(False)
        tk.Label(header_frame, text="NOVO Instalador Scanner Service", font=("Arial", 18, "bold"), bg="#2c3e50", fg="white").pack(pady=10)
        tk.Label(header_frame, text="Sistema Prevencao no Radar (Multi-tenant)", font=("Arial", 12), bg="#2c3e50", fg="#ecf0f1").pack()

        canvas = tk.Canvas(self.root, bg="white")
        scrollbar = ttk.Scrollbar(self.root, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        main_frame = ttk.Frame(canvas, padding="20")
        canvas.create_window((0, 0), window=main_frame, anchor="nw")
        def on_frame_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))
        main_frame.bind("<Configure>", on_frame_configure)
        def on_mousewheel(event):
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        canvas.bind_all("<MouseWheel>", on_mousewheel)

        info_frame = tk.Frame(main_frame, bg="#e8f4f8", relief=tk.RIDGE, bd=2)
        info_frame.pack(fill=tk.X, pady=(0, 10))
        tk.Label(info_frame, text="Preencha os dados abaixo para configurar o scanner nesta maquina", font=("Arial", 10, "bold"), bg="#e8f4f8", fg="#0c5460", pady=10).pack()

        instrucoes_frame = tk.Frame(main_frame, bg="#fff3cd", relief=tk.RIDGE, bd=2)
        instrucoes_frame.pack(fill=tk.X, pady=(0, 20))
        tk.Label(instrucoes_frame, text="ORDEM DE USO:", font=("Arial", 10, "bold"), bg="#fff3cd", fg="#856404", pady=5).pack()
        tk.Label(instrucoes_frame, text="1 Preencher campos -> 2 Salvar Config -> 3 Detectar Scanners -> 4 Instalar Servico -> 5 Atualizar Monitor", font=("Arial", 9), bg="#fff3cd", fg="#856404", pady=5).pack()

        webhook_frame = tk.Frame(main_frame, bg="#f8f9fa", relief=tk.RIDGE, bd=2)
        webhook_frame.pack(fill=tk.X, pady=(0, 20))
        tk.Label(webhook_frame, text="Como Funciona a Integracao", font=("Arial", 11, "bold"), bg="#f8f9fa", fg="#495057").pack(pady=(10, 5))
        tk.Label(webhook_frame, text="1. Scanner USB le o codigo de barras\n2. Scanner Service captura o codigo\n3. Envia para o Webhook da aplicacao via HTTP POST\n4. Aplicacao processa e registra a bipagem\n5. Atualizacao em tempo real no dashboard", font=("Arial", 9), bg="#f8f9fa", fg="#6c757d", justify=tk.LEFT, pady=5).pack(padx=20, pady=(0, 10))

        config_frame = ttk.LabelFrame(main_frame, text="Configuracoes", padding="15")
        config_frame.pack(fill=tk.X, pady=(0, 10))

        ttk.Label(config_frame, text="IP do Servidor:", font=("Arial", 10, "bold")).grid(row=0, column=0, sticky=tk.W, pady=5)
        ip_frame = ttk.Frame(config_frame)
        ip_frame.grid(row=1, column=0, sticky=tk.EW, pady=(0, 10))
        self.ip_entry = ttk.Entry(ip_frame, width=30, font=("Arial", 10))
        self.ip_entry.insert(0, self.local_ip)
        self.ip_entry.pack(side=tk.LEFT)
        ttk.Button(ip_frame, text="Detectar", width=12, command=self.detectar_ip).pack(side=tk.LEFT, padx=5)
        ttk.Label(config_frame, text=f"IP local detectado: {self.local_ip}", foreground="blue", font=("Arial", 9)).grid(row=2, column=0, sticky=tk.W, pady=(0, 10))

        ttk.Label(config_frame, text="Porta do Backend:", font=("Arial", 10, "bold")).grid(row=3, column=0, sticky=tk.W, pady=5)
        self.porta_entry = ttk.Entry(config_frame, width=30, font=("Arial", 10))
        self.porta_entry.insert(0, "3001")
        self.porta_entry.grid(row=4, column=0, sticky=tk.W, pady=(0, 10))

        separator_frame = tk.Frame(config_frame, bg="#17a2b8", height=2)
        separator_frame.grid(row=5, column=0, sticky=tk.EW, pady=10)
        ttk.Label(config_frame, text="--- OU USE DOMINIO (Multi-tenant) ---", foreground="#17a2b8", font=("Arial", 10, "bold")).grid(row=6, column=0, pady=5)

        ttk.Label(config_frame, text="Dominio do Servidor:", font=("Arial", 10, "bold")).grid(row=7, column=0, sticky=tk.W, pady=5)
        dominio_frame = ttk.Frame(config_frame)
        dominio_frame.grid(row=8, column=0, sticky=tk.EW, pady=(0, 5))
        self.dominio_entry = ttk.Entry(dominio_frame, width=40, font=("Arial", 10))
        self.dominio_entry.pack(side=tk.LEFT)
        ttk.Label(config_frame, text="Ex: tradicao.prevencaonoradar.com.br (deixe vazio para usar IP)", foreground="blue", font=("Arial", 9)).grid(row=9, column=0, sticky=tk.W, pady=(0, 5))
        ttk.Label(config_frame, text="Se preencher dominio, IP e Porta serao IGNORADOS!", foreground="red", font=("Arial", 9, "bold")).grid(row=10, column=0, sticky=tk.W, pady=(0, 10))

        tk.Frame(config_frame, bg="#6c757d", height=1).grid(row=11, column=0, sticky=tk.EW, pady=10)

        ttk.Label(config_frame, text="Token de Autenticacao:", font=("Arial", 10, "bold")).grid(row=12, column=0, sticky=tk.W, pady=5)
        token_frame = ttk.Frame(config_frame)
        token_frame.grid(row=13, column=0, sticky=tk.EW, pady=(0, 10))
        self.token_entry = ttk.Entry(token_frame, width=40, font=("Arial", 10), show="*")
        self.token_entry.pack(side=tk.LEFT)
        self.carregar_token_do_env()
        self.mostrar_token_var = tk.BooleanVar()
        ttk.Checkbutton(token_frame, text="Mostrar", variable=self.mostrar_token_var, command=self.toggle_token).pack(side=tk.LEFT, padx=5)
        ttk.Label(config_frame, text="Copie o token do arquivo .env do backend (API_TOKEN)", foreground="gray", font=("Arial", 9)).grid(row=14, column=0, sticky=tk.W, pady=(0, 10))

        ttk.Label(config_frame, text="Nome desta Maquina/Caixa:", font=("Arial", 10, "bold")).grid(row=15, column=0, sticky=tk.W, pady=5)
        machine_frame = ttk.Frame(config_frame)
        machine_frame.grid(row=16, column=0, sticky=tk.EW, pady=(0, 10))
        self.machine_entry = ttk.Entry(machine_frame, width=30, font=("Arial", 10))
        self.machine_entry.insert(0, os.environ.get('COMPUTERNAME', 'CAIXA_01'))
        self.machine_entry.pack(side=tk.LEFT)
        ttk.Label(config_frame, text="Ex: CAIXA_01, CAIXA_02, BALCAO_01, etc.", foreground="gray", font=("Arial", 9)).grid(row=17, column=0, sticky=tk.W)

        webhook_tech_frame = tk.Frame(main_frame, bg="#fff3cd", relief=tk.RIDGE, bd=2)
        webhook_tech_frame.pack(fill=tk.X, pady=10)
        tk.Label(webhook_tech_frame, text="Configuracao do Webhook", font=("Arial", 10, "bold"), bg="#fff3cd", fg="#856404").pack(pady=(10, 5))
        self.webhook_url_label = tk.Label(webhook_tech_frame, text="URL do Webhook: (preencha o IP e porta acima)", font=("Arial", 9, "bold"), bg="#fff3cd", fg="#856404")
        self.webhook_url_label.pack(pady=5)
        tk.Label(webhook_tech_frame, text="O Scanner Service enviara os codigos lidos para este endpoint.\nMetodo: POST | Autenticacao: Bearer Token", font=("Arial", 8), bg="#fff3cd", fg="#856404", justify=tk.CENTER).pack(pady=(0, 10))

        self.ip_entry.bind('<KeyRelease>', self.atualizar_webhook_url)
        self.porta_entry.bind('<KeyRelease>', self.atualizar_webhook_url)
        self.dominio_entry.bind('<KeyRelease>', self.atualizar_webhook_url)
        self.atualizar_webhook_url()

        self.status_frame = tk.Frame(main_frame, relief=tk.RIDGE, bd=2, bg="white")
        self.status_frame.pack(fill=tk.X, pady=10)
        self.status_label = tk.Label(self.status_frame, text="Aguardando configuracao...", font=("Arial", 10), bg="white", fg="gray", pady=15)
        self.status_label.pack()

        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=10)
        self.btn_salvar = ttk.Button(button_frame, text="Salvar Config", command=self.salvar_configuracoes)
        self.btn_salvar.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        self.btn_testar = ttk.Button(button_frame, text="Testar Conexao", command=self.testar_conexao)
        self.btn_testar.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        self.btn_instalar = ttk.Button(button_frame, text="Instalar Servico", command=self.instalar_servico, state=tk.DISABLED)
        self.btn_instalar.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        self.btn_sair = ttk.Button(button_frame, text="Sair", command=self.root.quit)
        self.btn_sair.pack(side=tk.LEFT, padx=5)

        monitor_frame = ttk.LabelFrame(main_frame, text="Monitor em Tempo Real", padding="15")
        monitor_frame.pack(fill=tk.BOTH, expand=True, pady=(10, 0))
        monitor_frame.grid_columnconfigure(0, weight=1)

        status_frame2 = ttk.Frame(monitor_frame)
        status_frame2.grid(row=0, column=0, sticky=tk.EW, pady=(0, 15))
        ttk.Label(status_frame2, text="Conexao com Aplicacao:", font=("Arial", 11, "bold")).pack(side=tk.LEFT)
        self.status_connection = ttk.Label(status_frame2, text="Desconhecido", font=("Arial", 10), foreground="gray")
        self.status_connection.pack(side=tk.LEFT, padx=10)

        test_frame = tk.Frame(monitor_frame, relief=tk.RIDGE, bd=3, bg="#e3f2fd")
        test_frame.grid(row=1, column=0, sticky=tk.EW, pady=(0, 15))
        tk.Label(test_frame, text="TESTE: Clique no campo abaixo e bipe um codigo", font=("Arial", 13, "bold"), bg="#e3f2fd", fg="#1565c0").pack(pady=(10, 5))
        self.test_entry = tk.Entry(test_frame, font=("Courier New", 16, "bold"), bg="#ffffff", fg="#999999", justify=tk.CENTER, relief=tk.SUNKEN, bd=2)
        self.test_entry.pack(padx=20, pady=(5, 5), fill=tk.X)
        self.test_entry.insert(0, "Clique aqui e bipe um codigo")
        self.test_entry.bind("<FocusIn>", self.on_test_entry_focus)
        self.test_entry.bind("<Return>", self.on_test_code_scanned)
        tk.Label(test_frame, text="O codigo aparecera em tempo real abaixo quando voce bipar!", font=("Arial", 9), bg="#e3f2fd", fg="#1565c0").pack(pady=(0, 10))

        ttk.Label(monitor_frame, text="Scanners Detectados:", font=("Arial", 11, "bold")).grid(row=2, column=0, sticky=tk.W, pady=5)
        self.scanners_text = tk.Text(monitor_frame, height=5, font=("Arial", 10), bg="#f8f9fa", wrap=tk.WORD)
        self.scanners_text.grid(row=3, column=0, sticky=tk.EW, pady=(0, 15))
        self.scanners_text.insert("1.0", "Nenhum scanner detectado ainda...")
        self.scanners_text.config(state=tk.DISABLED)

        ttk.Label(monitor_frame, text="Ultimas Bipagens:", font=("Arial", 11, "bold")).grid(row=4, column=0, sticky=tk.W, pady=5)
        self.bipagens_text = tk.Text(monitor_frame, height=12, font=("Courier New", 10), bg="#f8f9fa", wrap=tk.WORD)
        self.bipagens_text.grid(row=5, column=0, sticky=tk.EW, pady=(0, 10))
        self.bipagens_text.insert("1.0", "Aguardando bipagens...\n\nBipe um codigo acima para testar!")
        self.bipagens_text.config(state=tk.DISABLED)

        monitor_buttons = ttk.Frame(monitor_frame)
        monitor_buttons.grid(row=6, column=0, sticky=tk.EW)
        self.btn_atualizar = ttk.Button(monitor_buttons, text="Atualizar Monitor", command=self.atualizar_monitor)
        self.btn_atualizar.pack(side=tk.LEFT, padx=5)
        self.auto_refresh_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(monitor_buttons, text="Atualizacao Automatica (5s)", variable=self.auto_refresh_var, command=self.toggle_auto_refresh).pack(side=tk.LEFT, padx=10)

        footer_frame = tk.Frame(self.root, bg="#ecf0f1", height=40)
        footer_frame.pack(fill=tk.X, side=tk.BOTTOM)
        footer_frame.pack_propagate(False)
        tk.Label(footer_frame, text="Sistema Prevencao no Radar", font=("Arial", 9), bg="#ecf0f1", fg="#7f8c8d").pack(pady=10)

    def toggle_token(self):
        self.token_entry.config(show="" if self.mostrar_token_var.get() else "*")

    def carregar_token_do_env(self):
        try:
            if self.env_file.exists():
                with open(self.env_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.startswith('AUTH_TOKEN='):
                            token = line.split('=', 1)[1].strip()
                            self.token_entry.delete(0, tk.END)
                            self.token_entry.insert(0, token)
                            break
        except Exception:
            pass

    def atualizar_webhook_url(self, event=None):
        dominio = self.dominio_entry.get().strip()
        ip = self.ip_entry.get().strip()
        porta = self.porta_entry.get().strip()
        if dominio:
            dominio = dominio.replace("https://", "").replace("http://", "")
            self.webhook_url_label.config(text=f"URL do Webhook: https://{dominio}/api/bipagens/webhook", fg="#155724")
        elif ip and porta:
            self.webhook_url_label.config(text=f"URL do Webhook: http://{ip}:{porta}/api/bipagens/webhook", fg="#155724")
        else:
            self.webhook_url_label.config(text="URL do Webhook: (preencha IP+Porta OU Dominio)", fg="#856404")

    def detectar_ip(self):
        self.local_ip = self.get_local_ip()
        self.ip_entry.delete(0, tk.END)
        self.ip_entry.insert(0, self.local_ip)
        self.atualizar_webhook_url()
        messagebox.showinfo("IP Detectado", f"IP local detectado:\n{self.local_ip}")

    def atualizar_status(self, mensagem, tipo="info"):
        cores = {"info": ("gray", "white"), "sucesso": (self.cor_sucesso, "#d4edda"), "erro": (self.cor_erro, "#f8d7da"), "aviso": (self.cor_aviso, "#fff3cd")}
        fg, bg = cores.get(tipo, cores["info"])
        self.status_frame.config(bg=bg)
        self.status_label.config(text=mensagem, fg=fg, bg=bg)
        self.root.update()

    def testar_conexao(self):
        dominio = self.dominio_entry.get().strip()
        ip = self.ip_entry.get().strip()
        porta = self.porta_entry.get().strip()
        token = self.token_entry.get().strip()
        if not dominio and not ip:
            messagebox.showerror("Erro", "Preencha o Dominio OU o IP do servidor!")
            return
        if not dominio and not porta:
            messagebox.showerror("Erro", "Preencha a porta (ou use Dominio)!")
            return
        if not token:
            messagebox.showerror("Erro", "Preencha o token de autenticacao!")
            return
        self.atualizar_status("Testando conexao com o servidor...", "info")
        self.btn_testar.config(state=tk.DISABLED)
        self.root.update()
        try:
            if dominio:
                dominio = dominio.replace("https://", "").replace("http://", "")
                webhook_url = f"https://{dominio}/api/bipagens/webhook"
            else:
                webhook_url = f"http://{ip}:{porta}/api/bipagens/webhook"
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            payload = {"raw": "TESTE_INSTALACAO", "event_date": "2025-01-01T00:00:00Z", "scanner_id": "TESTE", "machine_id": self.machine_entry.get().strip()}
            response = requests.post(webhook_url, json=payload, headers=headers, timeout=15, verify=True)
            if response.status_code in [200, 201]:
                self.atualizar_status("Conexao OK! Servidor respondeu com sucesso!", "sucesso")
                self.btn_instalar.config(state=tk.NORMAL)
                messagebox.showinfo("Sucesso!", f"Conexao testada com sucesso!\n\nURL: {webhook_url}\n\nAgora voce pode clicar em 'Instalar Servico'.")
            elif response.status_code in [401, 403]:
                self.atualizar_status("Token invalido! Verifique o token.", "erro")
                messagebox.showerror("Erro de Autenticacao", "Token invalido!\n\nCopie o token correto do arquivo .env do backend.")
            else:
                self.atualizar_status(f"Servidor respondeu com codigo {response.status_code}", "aviso")
        except requests.exceptions.SSLError as e:
            self.atualizar_status("Erro de certificado SSL!", "erro")
            messagebox.showerror("Erro SSL", f"Erro de certificado SSL!\n\nDetalhes: {str(e)}")
        except requests.exceptions.ConnectionError:
            self.atualizar_status("Nao foi possivel conectar ao servidor!", "erro")
            messagebox.showerror("Erro de Conexao", "Nao foi possivel conectar!\n\nVerifique o dominio/IP, backend e firewall.")
        except requests.exceptions.Timeout:
            self.atualizar_status("Timeout! Servidor nao respondeu.", "erro")
        except Exception as e:
            self.atualizar_status(f"Erro: {str(e)}", "erro")
        finally:
            self.btn_testar.config(state=tk.NORMAL)

    def salvar_configuracoes(self):
        dominio = self.dominio_entry.get().strip()
        ip = self.ip_entry.get().strip()
        porta = self.porta_entry.get().strip()
        token = self.token_entry.get().strip()
        machine_id = self.machine_entry.get().strip()
        if not dominio and not ip:
            messagebox.showerror("Erro", "Preencha o Dominio OU o IP!")
            return
        if not dominio and not porta:
            messagebox.showerror("Erro", "Preencha a porta (ou use Dominio)!")
            return
        if not token:
            messagebox.showerror("Erro", "Preencha o token!")
            return
        if not machine_id:
            messagebox.showerror("Erro", "Preencha o nome da maquina!")
            return
        try:
            self.atualizar_status("Salvando configuracoes...", "info")
            self.salvar_env()
            modo = "DOMINIO (Multi-tenant)" if dominio else "IP DIRETO"
            self.atualizar_status(f"Configuracoes salvas! Modo: {modo}", "sucesso")
            messagebox.showinfo("Sucesso", f"Configuracoes salvas no arquivo .env!\n\nModo: {modo}\n\nAgora voce pode testar a conexao e instalar o servico.")
        except Exception as e:
            self.atualizar_status(f"Erro ao salvar: {str(e)}", "erro")

    def salvar_env(self):
        dominio = self.dominio_entry.get().strip()
        ip = self.ip_entry.get().strip()
        porta = self.porta_entry.get().strip()
        token = self.token_entry.get().strip()
        machine_id = self.machine_entry.get().strip()
        if dominio:
            dominio = dominio.replace("https://", "").replace("http://", "")
            webhook_url = f"https://{dominio}/api/bipagens/webhook"
        else:
            webhook_url = f"http://{ip}:{porta}/api/bipagens/webhook"
        env_content = f"""# Configuracao Scanner Service - Prevencao no Radar
# Modo: {'DOMINIO (Multi-tenant)' if dominio else 'IP DIRETO'}

WEBHOOK_URL={webhook_url}
AUTH_TOKEN={token}
MACHINE_ID={machine_id}
USE_RAW_INPUT=true
RETRY_INTERVAL=30000
LOG_MAX_SIZE=10485760
"""
        with open(self.env_file, 'w', encoding='utf-8') as f:
            f.write(env_content)
        return True

    def on_test_entry_focus(self, event):
        current = self.test_entry.get()
        if current == "Clique aqui e bipe um codigo":
            self.test_entry.delete(0, tk.END)
            self.test_entry.config(fg="#000000")

    def on_test_code_scanned(self, event):
        code = self.test_entry.get().strip()
        if code and code != "Clique aqui e bipe um codigo":
            timestamp = datetime.now().strftime("%H:%M:%S")
            self.test_entry.config(bg="#d4edda")
            self.bipagens_text.config(state=tk.NORMAL)
            self.bipagens_text.insert("1.0", f"[{timestamp}] Teste visual: {code}\n")
            self.bipagens_text.config(state=tk.DISABLED)
            self.root.after(200, lambda: self.test_entry.config(bg="#ffffff"))
            self.root.after(300, self._limpar_campo_teste)

    def _limpar_campo_teste(self):
        self.test_entry.delete(0, tk.END)
        self.test_entry.insert(0, "Clique aqui e bipe um codigo")
        self.test_entry.config(fg="#999999")

    def atualizar_monitor(self):
        try:
            scanners_file = Path("scanners.json")
            if scanners_file.exists():
                import json
                with open(scanners_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self.scanners_text.config(state=tk.NORMAL)
                self.scanners_text.delete("1.0", tk.END)
                scanners_list = data.get('scanners', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
                if scanners_list:
                    self.scanners_text.insert(tk.END, f"SCANNERS ATIVOS: {len(scanners_list)}\n\n")
                    for idx, scanner in enumerate(scanners_list, 1):
                        friendly_name = scanner.get('friendly_name', f'SCANNER_{idx:02d}') if isinstance(scanner, dict) else f'SCANNER_{idx:02d}'
                        self.scanners_text.insert(tk.END, f"  {friendly_name}\n")
                else:
                    self.scanners_text.insert(tk.END, "Nenhum scanner detectado.\nBipe um codigo para detectar automaticamente!")
                self.scanners_text.config(state=tk.DISABLED)
        except Exception as e:
            self.scanners_text.config(state=tk.NORMAL)
            self.scanners_text.delete("1.0", tk.END)
            self.scanners_text.insert(tk.END, f"Erro ao ler scanners: {str(e)}")
            self.scanners_text.config(state=tk.DISABLED)

        try:
            log_file = Path("logs/scanner-service.log")
            if log_file.exists():
                with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                    last_lines = lines[-15:] if len(lines) > 15 else lines
                self.bipagens_text.config(state=tk.NORMAL)
                self.bipagens_text.delete("1.0", tk.END)
                found = False
                for line in reversed(last_lines):
                    if 'Codigo lido' in line or 'Enviando' in line or 'Resposta' in line:
                        self.bipagens_text.insert(tk.END, line)
                        found = True
                if not found:
                    self.bipagens_text.insert(tk.END, "Nenhuma bipagem registrada ainda\nBipe um codigo para testar!")
                self.bipagens_text.config(state=tk.DISABLED)
        except Exception:
            pass

    def toggle_auto_refresh(self):
        if self.auto_refresh_var.get():
            self.auto_refresh_monitor()
        elif hasattr(self, '_refresh_job'):
            self.root.after_cancel(self._refresh_job)

    def auto_refresh_monitor(self):
        if self.auto_refresh_var.get():
            self.atualizar_monitor()
            self._refresh_job = self.root.after(5000, self.auto_refresh_monitor)

    def instalar_servico(self):
        self.atualizar_status("Salvando configuracoes...", "info")
        self.btn_instalar.config(state=tk.DISABLED)
        self.root.update()
        try:
            self.salvar_env()
            time.sleep(1)
            self.atualizar_status("Limpando processos anteriores...", "info")
            self.root.update()
            try:
                subprocess.run(['wmic', 'process', 'where', "name='pythonw.exe'", 'delete'], capture_output=True, timeout=5)
                time.sleep(2)
            except:
                pass
            try:
                Path("scanners.json").unlink(missing_ok=True)
            except:
                pass
            try:
                subprocess.run([sys.executable, "scanner_service.py", "stop"], capture_output=True, timeout=10)
                time.sleep(1)
                subprocess.run([sys.executable, "scanner_service.py", "uninstall"], capture_output=True, timeout=10)
                time.sleep(1)
            except:
                pass
            try:
                subprocess.run(['schtasks', '/Delete', '/TN', 'Scanner Service', '/F'], capture_output=True, timeout=5)
            except:
                pass

            self.atualizar_status("Configurando inicio automatico...", "info")
            self.root.update()
            bat_path = str(Path.cwd() / "INICIAR-SCANNER.bat")
            subprocess.run(['schtasks', '/Create', '/TN', 'Scanner Service', '/TR', f'"{bat_path}"', '/SC', 'ONLOGON', '/RL', 'HIGHEST', '/F'], capture_output=True, timeout=10, check=True)

            self.atualizar_status("Iniciando Scanner Service...", "info")
            self.root.update()
            subprocess.Popen([sys.executable.replace("python.exe", "pythonw.exe"), "scanner_service.py", "debug"], cwd=Path.cwd(), creationflags=subprocess.CREATE_NO_WINDOW)
            time.sleep(3)

            self.atualizar_status("Scanner Service instalado e iniciado!", "sucesso")
            messagebox.showinfo("Instalacao Concluida!", "Scanner Service instalado com sucesso!\n\nServico iniciado em background\nRaw Input API ativa\nInicio automatico configurado\n\nConecte o scanner USB e escaneie codigos.")
        except Exception as e:
            self.atualizar_status(f"Erro: {str(e)}", "erro")
            messagebox.showerror("Erro", f"Erro ao instalar:\n\n{str(e)}\n\nExecute como Administrador!")
            self.btn_instalar.config(state=tk.NORMAL)


def main():
    try:
        import ctypes
        is_admin = ctypes.windll.shell32.IsUserAnAdmin()
        if not is_admin:
            messagebox.showwarning("Aviso", "Este instalador precisa ser executado como Administrador!\n\nClique com botao direito no NOVO-INSTALAR.bat e escolha:\n'Executar como administrador'")
    except:
        pass
    root = tk.Tk()
    app = InstaladorVisual(root)
    root.mainloop()


if __name__ == "__main__":
    main()
`;

// ==========================================
// SCANNER SERVICE (Python)
// ==========================================
const SCANNER_SERVICE_PY = String.raw`#!/usr/bin/env python3
"""
Scanner Service para Windows
Sistema de captura de leituras de codigo de barras via scanner USB
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
    print("Instale com: pip install keyboard requests python-dotenv pywin32")
    sys.exit(1)

LOCK_FILE = os.path.join(os.environ.get('TEMP', 'C:\\Windows\\Temp'), 'scanner_service.lock')
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
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        self.logger = logging.getLogger('ScannerService')
        self.logger.setLevel(logging.INFO)
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
        if log_file.exists() and log_file.stat().st_size > self.config['LOG_MAX_SIZE']:
            backup = log_dir / f'scanner-service-{int(time.time())}.log'
            log_file.rename(backup)

    def write_pid(self):
        try:
            with open(self.pid_file, 'w') as f:
                f.write(str(os.getpid()))
        except:
            pass

    def remove_pid(self):
        try:
            if self.pid_file.exists():
                self.pid_file.unlink()
        except:
            pass

    def load_queue(self):
        if self.queue_file.exists():
            try:
                with open(self.queue_file, 'r', encoding='utf-8') as f:
                    for item in json.load(f):
                        self.scan_queue.put(item)
            except:
                self.save_queue()

    def save_queue(self):
        try:
            items = []
            temp = Queue()
            while not self.scan_queue.empty():
                try:
                    item = self.scan_queue.get_nowait()
                    items.append(item)
                    temp.put(item)
                except:
                    break
            while not temp.empty():
                self.scan_queue.put(temp.get_nowait())
            with open(self.queue_file, 'w', encoding='utf-8') as f:
                json.dump(items, f, ensure_ascii=False, indent=2)
        except:
            pass

    def process_scan(self, code, scanner_id="UNKNOWN", device_path=None):
        try:
            data = {"raw": code, "event_date": datetime.utcnow().isoformat() + "Z", "scanner_id": scanner_id, "machine_id": self.config.get('MACHINE_ID', 'UNKNOWN')}
            if device_path:
                data["device_path"] = device_path
            self.scan_queue.put(data)
            self.save_queue()
            self.logger.info(f"Codigo capturado de {scanner_id}: {code}")
        except Exception as e:
            self.logger.error(f"Erro ao processar scan: {e}")

    def send_to_webhook(self, data):
        try:
            if not self.config['WEBHOOK_URL']:
                return False
            headers = {'Content-Type': 'application/json'}
            if self.config['AUTH_TOKEN']:
                headers['Authorization'] = f"Bearer {self.config['AUTH_TOKEN']}"
            r = requests.post(self.config['WEBHOOK_URL'], json=data, headers=headers, timeout=30, verify=False)
            if r.status_code in [200, 201]:
                self.logger.info(f"Dados enviados: {data['raw']}")
                return True
            self.logger.error(f"Webhook retornou {r.status_code}")
            return False
        except Exception as e:
            self.logger.error(f"Erro webhook: {e}")
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
            except:
                time.sleep(5)

def run_debug():
    print("Scanner Service - modo debug")
    if not acquire_lock():
        sys.exit(1)
    service = DebugService()
    def sig(s, f):
        service.is_running = False
        release_lock()
        sys.exit(0)
    signal.signal(signal.SIGINT, sig)
    threading.Thread(target=service.queue_worker, daemon=True).start()

    if service.config.get('USE_RAW_INPUT', True):
        print("Modo: Raw Input API")
        dm = DeviceManager(logger=service.logger)
        def cb(code, dp):
            if not dm.is_device_known(dp) and not code.isdigit():
                return
            sid = dm.get_or_create_scanner(dp)
            service.process_scan(code, sid, dp)
        rs = RawInputScanner(callback=cb, logger=service.logger)
        rs.set_device_manager(dm)
        rs.start()
        print("Pronto - aguardando bipagens...")
        try:
            while service.is_running:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            rs.stop()
            service.save_queue()
            service.remove_pid()
            release_lock()
    else:
        print("Modo: Keyboard Hook")
        keyboard.on_press(service.on_key_press)
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
    if len(sys.argv) <= 1 or sys.argv[1].lower() == 'debug':
        run_debug()
    else:
        print(f"Uso: {sys.argv[0]} [debug]")

if __name__ == '__main__':
    main()
`;

// ==========================================
// RAW INPUT HANDLER (Python)
// ==========================================
const RAW_INPUT_HANDLER_PY = String.raw`#!/usr/bin/env python3
"""Raw Input Handler - Windows Raw Input API para scanners USB"""

import win32gui, win32con, win32api
import threading, time, logging
from ctypes import windll, Structure, POINTER, c_ulong, c_ushort, c_uint, c_void_p, sizeof, byref, cast
from typing import Callable, Dict, Optional

class RAWINPUTDEVICE(Structure):
    _fields_ = [("usUsagePage", c_ushort), ("usUsage", c_ushort), ("dwFlags", c_uint), ("hwndTarget", c_void_p)]

class RAWINPUTHEADER(Structure):
    _fields_ = [("dwType", c_uint), ("dwSize", c_uint), ("hDevice", c_void_p), ("wParam", c_void_p)]

class RAWKEYBOARD(Structure):
    _fields_ = [("MakeCode", c_ushort), ("Flags", c_ushort), ("Reserved", c_ushort), ("VKey", c_ushort), ("Message", c_uint), ("ExtraInformation", c_ulong)]

class RAWINPUT(Structure):
    class _U(Structure):
        _fields_ = [("keyboard", RAWKEYBOARD)]
    _fields_ = [("header", RAWINPUTHEADER), ("data", _U)]

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

    def set_device_manager(self, dm):
        self.device_manager = dm

    def start(self):
        if self.running: return
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.hwnd:
            try: win32gui.PostMessage(self.hwnd, win32con.WM_QUIT, 0, 0)
            except: pass

    def _run(self):
        try:
            wc = win32gui.WNDCLASS()
            wc.lpfnWndProc = self._wndproc
            wc.lpszClassName = "RawInputScannerWindow"
            wc.hInstance = win32api.GetModuleHandle(None)
            try: win32gui.RegisterClass(wc)
            except: pass
            self.hwnd = win32gui.CreateWindow("RawInputScannerWindow", "Scanner", 0, 0, 0, 0, 0, 0, 0, wc.hInstance, None)
            rid = RAWINPUTDEVICE()
            rid.usUsagePage = 0x01
            rid.usUsage = 0x06
            rid.dwFlags = RIDEV_INPUTSINK | RIDEV_DEVNOTIFY
            rid.hwndTarget = self.hwnd
            windll.user32.RegisterRawInputDevices(byref(rid), 1, sizeof(RAWINPUTDEVICE))
            self.logger.info("Raw Input Scanner iniciado")
            win32gui.PumpMessages()
        except Exception as e:
            self.logger.error(f"Erro: {e}", exc_info=True)

    def _wndproc(self, hwnd, msg, wp, lp):
        if msg == WM_INPUT:
            self._handle(lp)
            return 0
        if msg == win32con.WM_DESTROY:
            win32gui.PostQuitMessage(0)
            return 0
        return win32gui.DefWindowProc(hwnd, msg, wp, lp)

    def _handle(self, lp):
        try:
            sz = c_uint()
            windll.user32.GetRawInputData(lp, RID_INPUT, None, byref(sz), sizeof(RAWINPUTHEADER))
            buf = (c_uint * (sz.value // 4 + 1))()
            r = windll.user32.GetRawInputData(lp, RID_INPUT, byref(buf), byref(sz), sizeof(RAWINPUTHEADER))
            if r != sz.value: return
            raw = cast(buf, POINTER(RAWINPUT)).contents
            if raw.header.dwType != RIM_TYPEKEYBOARD: return
            did = self._did(raw.header.hDevice)
            kb = raw.data.keyboard
            if (kb.Flags & 0x01) == 0:
                self._key(did, kb.VKey)
        except: pass

    def _did(self, hd):
        try:
            sz = c_uint()
            windll.user32.GetRawInputDeviceInfoA(hd, RIDI_DEVICENAME, None, byref(sz))
            buf = (c_uint * (sz.value // 4 + 1))()
            windll.user32.GetRawInputDeviceInfoA(hd, RIDI_DEVICENAME, byref(buf), byref(sz))
            return bytes(buf).decode('ascii', errors='ignore').split('\x00')[0] or f"DEV_{hd}"
        except:
            return f"UNK_{hd}"

    def _key(self, did, vk):
        t = time.time()
        if did not in self.device_buffers:
            self.device_buffers[did] = ""
        if t - self.last_input_time.get(did, 0) > self.input_timeout:
            self.device_buffers[did] = ""
        self.last_input_time[did] = t
        if vk == VK_SHIFT: self.shift_pressed = True; return
        if vk in (VK_CONTROL, VK_MENU): return
        if vk == VK_RETURN:
            code = self.device_buffers[did].strip()
            if code:
                try: self.callback(code[-15:], did)
                except: pass
            self.device_buffers[did] = ""
            return
        ch = self._ch(vk)
        if ch:
            self.device_buffers[did] += ch
            if len(self.device_buffers[did]) > 50:
                self.device_buffers[did] = self.device_buffers[did][-50:]

    def _ch(self, vk):
        if 0x30 <= vk <= 0x39: return chr(vk)
        if 0x41 <= vk <= 0x5A: return chr(vk)
        if 0x60 <= vk <= 0x69: return str(vk - 0x60)
        return {0xBD:'-',0xBB:'=',0xBA:':',0xDB:'[',0xDD:']',0xDC:'\\',0xBF:'/',0xBE:'.',0xBC:','}.get(vk)
`;

// ==========================================
// DEVICE MANAGER (Python)
// ==========================================
const DEVICE_MANAGER_PY = String.raw`#!/usr/bin/env python3
"""Device Manager - Gerencia mapeamento de dispositivos Raw Input"""

import json, logging, os, re
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

class DeviceManager:
    def __init__(self, config_file="scanners.json", logger=None):
        self.config_file = Path(config_file)
        self.logger = logger or logging.getLogger(__name__)
        self.devices = {}
        script_dir = Path(__file__).parent.absolute()
        env_path = script_dir / '.env'
        if env_path.exists(): load_dotenv(env_path)
        self.machine_id = os.getenv('MACHINE_ID', 'SCANNER')
        self.load_config()

    def load_config(self):
        if not self.config_file.exists():
            self.devices = {}
            self.save_config()
            return
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.devices = {}
            for s in data.get('scanners', []):
                dp = s.get('device_path')
                if dp: self.devices[dp] = s
        except:
            self.devices = {}

    def save_config(self):
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump({"scanners": list(self.devices.values())}, f, indent=2, ensure_ascii=False)
        except: pass

    def get_friendly_name(self, dp):
        return self.devices.get(dp, {}).get('friendly_name')

    def get_or_create_scanner(self, dp):
        fn = self.get_friendly_name(dp)
        if fn: return fn
        fn = self.get_next_scanner_id()
        vp = self._vid_pid(dp)
        self.devices[dp] = {'device_path': dp, 'friendly_name': fn, 'description': f'Auto {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', 'vid_pid': vp}
        self.save_config()
        self.logger.info(f"Novo scanner: {fn} -> {dp}")
        return fn

    def is_device_known(self, dp):
        if dp in self.devices: return True
        vp = self._vid_pid(dp)
        if vp:
            for p in self.devices:
                if self._vid_pid(p) == vp: return True
        return False

    def _vid_pid(self, dp):
        try:
            m = re.search(r'VID_([0-9A-F]{4})&PID_([0-9A-F]{4})', dp, re.IGNORECASE)
            if m: return f"VID_{m.group(1)}&PID_{m.group(2)}".upper()
        except: pass
        return None

    def get_next_scanner_id(self):
        ids = []
        for i in self.devices.values():
            n = i.get('friendly_name', '')
            if n.startswith('SCANNER_'):
                try: ids.append(int(n.split('_')[1]))
                except: pass
        return f"SCANNER_{(max(ids)+1 if ids else 2):02d}"

    def list_devices(self):
        return list(self.devices.values())
`;

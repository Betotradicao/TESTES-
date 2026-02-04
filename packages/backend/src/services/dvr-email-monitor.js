/**
 * DVR Email Monitor Service - Stub
 * Arquivo criado como placeholder para evitar erro de modulo faltando
 */

class DVREmailMonitor {
  constructor(config) {
    this.config = config || {};
    this.running = false;
  }

  async start() {
    console.log('[DVR Email Monitor] Start chamado (stub)');
    this.running = true;
    return true;
  }

  async stop() {
    console.log('[DVR Email Monitor] Stop chamado (stub)');
    this.running = false;
    return true;
  }

  isRunning() {
    return this.running;
  }

  getStatus() {
    return {
      running: this.running,
      message: 'DVR Email Monitor (stub)'
    };
  }
}

module.exports = DVREmailMonitor;

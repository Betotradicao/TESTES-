/**
 * DVR Email Monitor Service - Stub
 * Convertido pra .ts pra ser compilado pelo tsc (Dockerfile nao copia .js puros).
 */

interface DVREmailMonitorConfig {
  [key: string]: any;
}

class DVREmailMonitor {
  config: DVREmailMonitorConfig;
  running: boolean;

  constructor(config?: DVREmailMonitorConfig) {
    this.config = config || {};
    this.running = false;
  }

  async start(): Promise<boolean> {
    console.log('[DVR Email Monitor] Start chamado (stub)');
    this.running = true;
    return true;
  }

  async stop(): Promise<boolean> {
    console.log('[DVR Email Monitor] Stop chamado (stub)');
    this.running = false;
    return true;
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus() {
    return {
      running: this.running,
      message: 'DVR Email Monitor (stub)',
    };
  }
}

module.exports = DVREmailMonitor;

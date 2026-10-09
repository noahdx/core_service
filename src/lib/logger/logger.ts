type LevelType = 'error' | 'warn' | 'info' | 'debug';
export class Logger {
  private static instance: Logger;
  constructor() {
    if (!Logger.instance) {
      Logger.instance = this;
    }

    return Logger.instance;
  }

  log(level: LevelType, message: string, metadata: Record<string, any> = {}) {
    const objLog = {
      level: level,
      message: message,
      ...metadata,
    };

    console.log(objLog);
  }

  error(message: string, metadata: Record<string, any> = {}) {
    this.log('error', message, metadata);
  }

  warn(message: string, metadata: Record<string, any> = {}) {
    this.log('warn', message, metadata);
  }

  debug(message: string, metadata: Record<string, any> = {}) {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata: Record<string, any> = {}) {
    this.log('info', message, metadata);
  }
}

export const logger = new Logger();

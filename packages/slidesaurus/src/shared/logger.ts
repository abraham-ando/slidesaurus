import logger from "@docusaurus/logger";

const PLUGIN_PREFIX = "Slidev Plugin";

export class PluginLogger {
  private readonly prefix: string;

  constructor(prefix = PLUGIN_PREFIX) {
    this.prefix = prefix;
  }

  info(message: string): void {
    logger.info`[${this.prefix}] ${message}`;
  }

  warn(message: string): void {
    logger.warn`[${this.prefix}] ${message}`;
  }

  error(message: string): void {
    logger.error`[${this.prefix}] ${message}`;
  }

  success(message: string): void {
    logger.success`[${this.prefix}] ${message}`;
  }

  path(filePath: string): string {
    return logger.path(filePath);
  }

  code(value: string): string {
    return logger.code(value);
  }
}

/** Singleton used throughout the plugin. */
export const log = new PluginLogger();

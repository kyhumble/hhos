/**
 * Structured JSON logger — never log PHI, tokens, or raw email bodies.
 */
import { redactForAudit } from './redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLevel(): LogLevel {
  const v = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error') return v;
  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[configuredLevel()];
}

function emit(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    service: 'hhos-api',
    msg,
    env: process.env.HHOS_ENV ?? process.env.NODE_ENV ?? 'local',
  };
  if (fields && Object.keys(fields).length > 0) {
    entry.fields = redactForAudit(fields) as Record<string, unknown>;
  }
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};

/** NestJS-compatible logger adapter (string-only messages; no PHI). */
export class HhosNestLogger {
  log(message: string) {
    log.info(String(message));
  }
  error(message: string, trace?: string) {
    log.error(String(message), trace ? { trace: String(trace).slice(0, 500) } : undefined);
  }
  warn(message: string) {
    log.warn(String(message));
  }
  debug?(message: string) {
    log.debug(String(message));
  }
  verbose?(message: string) {
    log.debug(String(message));
  }
}

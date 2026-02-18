export function logInfo(message: string, data?: Record<string, unknown>) {
  console.info(JSON.stringify({ level: "info", message, ...data, ts: new Date().toISOString() }));
}

export function logWarn(message: string, data?: Record<string, unknown>) {
  console.warn(JSON.stringify({ level: "warn", message, ...data, ts: new Date().toISOString() }));
}

export function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", message, ...data, ts: new Date().toISOString() }));
}

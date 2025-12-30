export const battleLogs = [];
export let loggingEnabled = true;

export function setLoggingEnabled(enabled) {
  loggingEnabled = enabled;
}

export function logBattle(msg) {
  if (loggingEnabled) {
    battleLogs.push(msg);
  }
  // Console logging disabled for performance - logs are stored in battleLogs array
}

export function clearLogs() {
  battleLogs.length = 0;
}

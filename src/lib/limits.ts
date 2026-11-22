const HOUR_MS = 60 * 60 * 1000;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 256;
export const EMAIL_MAX = 254;

export const SESSION_TTL_MS = 14 * 24 * HOUR_MS;
export const SESSION_EXTEND_AFTER_MS = HOUR_MS;

export const LOCKOUT_AFTER_FAILURES = 5;
export const LOCKOUT_BASE_MS = 60 * 1000;
export const LOCKOUT_MAX_MS = 24 * HOUR_MS;

export const SCRYPT_CONCURRENCY = 2;

export const GAME_TITLE_MAX = 80;
export const GAME_TITLE_COUNTER_FROM = 60;

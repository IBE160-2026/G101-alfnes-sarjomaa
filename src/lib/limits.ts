const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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

export const QUESTIONS_MAX = 20;
export const QUESTION_TEXT_MAX = 200;
export const QUESTION_COUNTER_FROM = 160;

// FR-3 retention: 30 days after played, 90 days after the last Host change otherwise.
export const RETENTION_PLAYED_MS = 30 * DAY_MS;
export const RETENTION_IDLE_MS = 90 * DAY_MS;
export const PURGE_INTERVAL_MS = HOUR_MS;

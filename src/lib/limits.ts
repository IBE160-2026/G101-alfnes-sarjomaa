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
// Waiters beyond the running scrypt derivations; one more is refused with INTERNAL.
export const SCRYPT_QUEUE_MAX = 8;

export const GAME_TITLE_MAX = 80;
export const GAME_TITLE_COUNTER_FROM = 60;

export const QUESTIONS_MAX = 20;
export const QUESTION_TEXT_MAX = 200;
export const QUESTION_COUNTER_FROM = 160;

export const INVITE_LINKS_MAX = 50;
// The FR-8 count floor, and the FR-10 close floor Story 3.1 reuses.
export const SUBMISSIONS_MIN = 3;
// What progress() reports instead of a count below SUBMISSIONS_MIN.
export const FEWER_THAN_3 = "fewer-than-3";
export const COLLECTING_REFRESH_MS = 30_000; // AD-17
// The Grouping lease that close sets (AD-9, AD-12).
export const GROUPING_LEASE_MS = 180_000;
// AD-12: one partition call per Question, at most this long, this many at once.
export const JUDGE_TIMEOUT_MS = 30_000;
export const JUDGE_CONCURRENCY = 5;
export const GROUPING_POLL_MS = 3_000;

export const ANSWER_TEXT_MAX = 80;
export const ANSWER_COUNTER_FROM = 60;
export const ANSWERS_PER_QUESTION_MAX = 5;
// The fields without "Fjern" that the answer form always shows per Question.
export const ANSWER_FIELDS_DEFAULT = 2;

// FR-3 retention: 30 days after played, 90 days after the last Host change otherwise.
export const RETENTION_PLAYED_MS = 30 * DAY_MS;
export const RETENTION_IDLE_MS = 90 * DAY_MS;
export const PURGE_INTERVAL_MS = HOUR_MS;

// AD-11: the Board is the top eight non-discarded Groups; labels are at most 40 characters.
export const BOARD_SIZE = 8;
export const LABEL_MAX = 40;

// FR-23, AD-16: two to four Teams. 14 characters: four names of wide letters ("WWW…")
// fit the Team column at 48 px with the Score beside each name and Scores up to two digits.
// shortcut: four near-14-character wide-letter names with three-digit Scores overflow, though three-digit Scores alone are normal; re-check the column if four long names and Scores over 99 occur together in the pilot.
export const TEAMS_MIN = 2;
export const TEAMS_MAX = 4;
export const TEAM_NAME_MAX = 14;

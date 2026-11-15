import { z } from "zod";

export const MAX_NOTE_LENGTH = 2000;

/**
 * A Note body: plain text, trimmed, capped at MAX_NOTE_LENGTH. An over-long
 * body is refused, never truncated. Shared by the Lesson page's form and the
 * service, so the rule lives in one place.
 */
export const noteBodySchema = z
  .string()
  .trim()
  .max(
    MAX_NOTE_LENGTH,
    `A note must be ${MAX_NOTE_LENGTH.toLocaleString("en")} characters or fewer.`
  );

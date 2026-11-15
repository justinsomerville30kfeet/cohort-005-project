import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import { bookmarks, courses, lessons, modules, notes } from "~/db/schema";
import { noteBodySchema } from "~/lib/notes";

// ─── Bookmarks and Notes ───
// What a Student attaches to a Lesson for themselves and nobody else. See
// GLOSSARY.md for the language.
//
// A Note is private to the Student who wrote it. Only the owning Student's
// Lesson page and Saved page may read Note bodies — never an Instructor or
// Platform Admin view.
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Content access is checked by the caller, with the same check the
// Lesson's discussion uses.

export type Db = BetterSQLite3Database<typeof schema>;

export type NoteSummary = { body: string; updatedAt: string };

function studentBookmark(studentId: number, lessonId: number) {
  return and(eq(bookmarks.userId, studentId), eq(bookmarks.lessonId, lessonId));
}

function studentNote(studentId: number, lessonId: number) {
  return and(eq(notes.userId, studentId), eq(notes.lessonId, lessonId));
}

export function isBookmarked(db: Db, studentId: number, lessonId: number) {
  return !!db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(studentBookmark(studentId, lessonId))
    .get();
}

/**
 * Adds a Bookmark if the Lesson has none, removes it if it has one, and
 * returns whether the Lesson is now bookmarked. The unique index on
 * (Student, Lesson) means a racing second insert is ignored, not duplicated.
 */
export function toggleBookmark(
  db: Db,
  studentId: number,
  lessonId: number,
  now: Date
): boolean {
  return db.transaction((tx) => {
    const removed = tx
      .delete(bookmarks)
      .where(studentBookmark(studentId, lessonId))
      .returning({ id: bookmarks.id })
      .all();
    if (removed.length > 0) return false;

    tx.insert(bookmarks)
      .values({ userId: studentId, lessonId, createdAt: now.toISOString() })
      .onConflictDoNothing()
      .run();
    return true;
  });
}

export function getNote(
  db: Db,
  studentId: number,
  lessonId: number
): NoteSummary | null {
  return (
    db
      .select({ body: notes.body, updatedAt: notes.updatedAt })
      .from(notes)
      .where(studentNote(studentId, lessonId))
      .get() ?? null
  );
}

export type SaveNoteResult =
  { ok: true; note: NoteSummary | null } | { ok: false; error: string };

/**
 * Creates the Student's Note on a Lesson, or replaces its body and moves its
 * "last edited" time on. The body follows noteBodySchema. Saving an empty
 * body clears the Note, so the box is empty again next time.
 */
export function saveNote(
  db: Db,
  studentId: number,
  lessonId: number,
  body: string,
  now: Date
): SaveNoteResult {
  const parsed = noteBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Could not save that note.",
    };
  }
  const trimmed = parsed.data;

  if (trimmed.length === 0) {
    db.delete(notes).where(studentNote(studentId, lessonId)).run();
    return { ok: true, note: null };
  }

  const at = now.toISOString();
  const note = db
    .insert(notes)
    .values({
      userId: studentId,
      lessonId,
      body: trimmed,
      createdAt: at,
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: [notes.userId, notes.lessonId],
      set: { body: trimmed, updatedAt: at },
    })
    .returning({ body: notes.body, updatedAt: notes.updatedAt })
    .get();

  return { ok: true, note };
}

const savedLessonColumns = {
  courseId: courses.id,
  lessonId: lessons.id,
  lessonTitle: lessons.title,
  courseTitle: courses.title,
  courseSlug: courses.slug,
};

/** The Student's Bookmarks with their Lesson and Course, newest first. */
export function listBookmarks(db: Db, studentId: number) {
  return db
    .select({ id: bookmarks.id, createdAt: bookmarks.createdAt, ...savedLessonColumns })
    .from(bookmarks)
    .innerJoin(lessons, eq(bookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(bookmarks.userId, studentId))
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .all();
}

/** The Student's Notes with their Lesson and Course, last edited first. */
export function listNotes(db: Db, studentId: number) {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
      ...savedLessonColumns,
    })
    .from(notes)
    .innerJoin(lessons, eq(notes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(notes.userId, studentId))
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .all();
}

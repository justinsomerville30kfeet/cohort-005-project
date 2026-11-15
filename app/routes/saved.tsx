import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/saved";
import { db } from "~/db";
import { getAccess, requireUserId } from "~/lib/access.server";
import { listBookmarks, listNotes } from "~/lib/saved.server";
import { Card, CardContent } from "~/components/ui/card";
import { Bookmark, NotebookPen } from "lucide-react";
import { formatRelativeTime } from "~/lib/utils";

export function meta() {
  return [
    { title: "Saved — Cadence" },
    { name: "description", content: "Your bookmarks and notes" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const bookmarks = listBookmarks(db, userId);
  const notes = listNotes(db, userId);

  // Rows on a Course the Student can no longer open (after an approved Refund,
  // say) are kept but not shown — they stop being reachable along with the
  // Course, using the same content-access rule as the Lesson page.
  const courseIds = new Set(
    [...bookmarks, ...notes].map((row) => row.courseId)
  );
  const readable = new Set<number>();
  for (const courseId of courseIds) {
    const access = await getAccess(request, courseId);
    if (access.canViewContent) readable.add(courseId);
  }

  return {
    savedBookmarks: bookmarks.filter((row) => readable.has(row.courseId)),
    savedNotes: notes.filter((row) => readable.has(row.courseId)),
  };
}

export default function Saved({ loaderData }: Route.ComponentProps) {
  const { savedBookmarks, savedNotes } = loaderData;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Saved</h1>
        <p className="text-sm text-muted-foreground">
          The lessons you flagged, and what you wrote about them.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SavedSection
          icon={<Bookmark className="size-4 text-muted-foreground" />}
          title="Bookmarks"
          emptyText="No bookmarks yet."
        >
          {savedBookmarks.map((bookmark) => (
            <SavedRow key={bookmark.id} lesson={bookmark} />
          ))}
        </SavedSection>

        <SavedSection
          icon={<NotebookPen className="size-4 text-muted-foreground" />}
          title="Notes"
          emptyText="No notes yet."
        >
          {savedNotes.map((note) => (
            <SavedRow key={note.id} lesson={note}>
              <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              <p
                suppressHydrationWarning
                className="text-xs text-muted-foreground"
              >
                Edited {formatRelativeTime(note.updatedAt)}
              </p>
            </SavedRow>
          ))}
        </SavedSection>
      </div>
    </div>
  );
}

function SavedSection({
  icon,
  title,
  emptyText,
  children,
}: {
  icon: ReactNode;
  title: string;
  emptyText: string;
  children: ReactNode[];
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h2>

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function SavedRow({
  lesson,
  children,
}: {
  lesson: {
    lessonId: number;
    lessonTitle: string;
    courseTitle: string;
    courseSlug: string;
  };
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-3">
        <Link
          to={`/courses/${lesson.courseSlug}/lessons/${lesson.lessonId}`}
          className="text-sm font-medium hover:underline"
        >
          {lesson.lessonTitle}
        </Link>
        <p className="text-xs text-muted-foreground">{lesson.courseTitle}</p>
        {children}
      </CardContent>
    </Card>
  );
}

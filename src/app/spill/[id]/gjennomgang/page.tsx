import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { Button } from "@/components/Button";
import { LockBoard } from "@/components/LockBoard";
import { MarkReviewed } from "@/components/MarkReviewed";
import { Notice } from "@/components/Notice";
import { ReviewGroups } from "@/components/ReviewGroups";
import { DomainError } from "@/lib/errors";
import { fallbackNotice } from "@/lib/review";
import * as auth from "@/server/auth";
import { env } from "@/server/env";
import * as review from "@/server/review";

const codeOf = (error: unknown) =>
  error instanceof DomainError ? error.code : undefined;

// cache(): generateMetadata and the page share one owner-checked read per request.
const loadReview = cache(async (gameId: string, q: unknown) => {
  const { hostId } = await auth.requireHost();
  // Anything but a Question's number falls back to the first unreviewed one.
  return review.load(hostId, gameId, typeof q === "string" ? Number(q) : NaN);
});

// A foreign Game gets the not-found title too, so its title never leaks (AD-5).
export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/spill/[id]/gjennomgang">): Promise<Metadata> {
  const { id } = await params;
  try {
    const { title } = await loadReview(id, (await searchParams).q);
    return { title: `Gjennomgang – ${title}` };
  } catch (error) {
    const code = codeOf(error);
    if (code === "NOT_FOUND") return { title: "Vi finner ikke dette spillet" };
    if (code === "WRONG_STATE") return {};
    throw error;
  }
}

export default async function ReviewPage({
  params,
  searchParams,
}: PageProps<"/spill/[id]/gjennomgang">) {
  const { id } = await params;
  let data;
  try {
    data = await loadReview(id, (await searchParams).q);
  } catch (error) {
    // Missing, foreign and malformed IDs all land on one page (AD-5).
    if (codeOf(error) === "NOT_FOUND") notFound();
    if (codeOf(error) === "WRONG_STATE") redirect(`/spill/${id}`);
    throw error;
  }
  const { title, questions, current } = data;
  const total = questions.length;
  const remaining = questions.filter((q) => !q.reviewed).length;
  const question = questions.find((q) => q.position === current.position)!;
  const next = questions.find((q) => q.position === current.position + 1);
  const notice = fallbackNotice(questions, env.DEMO_MODE);
  const href = (position: number) => `/spill/${id}/gjennomgang?q=${position}`;

  return (
    // data-wide lets HostChrome drop its 800 px column for the 1280 px host width.
    <div data-wide="">
      <nav aria-label="Brødsmulesti">
        <ol className="flex flex-wrap items-center gap-x-2 text-body-sm">
          <li>
            <Link
              href="/spill"
              className="inline-flex min-h-11 items-center text-primary underline"
            >
              Mine spill
            </Link>
          </li>
          <li className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="text-ink-muted">
              ›
            </span>
            <Link
              href={`/spill/${id}`}
              className="inline-flex min-h-11 items-center break-words text-primary underline"
            >
              {title}
            </Link>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="text-ink-muted">
              ›
            </span>
            <span aria-current="page">Gjennomgang</span>
          </li>
        </ol>
      </nav>
      <h1 className="sr-only">Gjennomgang</h1>

      {notice && (
        <Notice tone="warning" className="mt-4">
          {notice}
        </Notice>
      )}
      <Notice tone="info" className="mt-4 md:hidden">
        Gjennomgangen er laget for større skjerm. Den virker her, men blir
        trang.
      </Notice>

      <div className="mt-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[288px_minmax(0,1fr)]">
        {/* The lock sits after the nav, never inside a navigation landmark. */}
        <div className="hidden rounded-md border border-line bg-surface p-4 lg:block">
          <nav aria-label="Spørsmål">
            <h2 className="text-label">
              {total - remaining} av {total} gjennomgått
            </h2>
            <ol className="mt-3 flex flex-col gap-1">
              {questions.map((q) => (
                <li key={q.id}>
                  <Link
                    href={href(q.position)}
                    title={q.text}
                    aria-current={
                      q.position === current.position ? "page" : undefined
                    }
                    className="block min-h-11 rounded-sm border-2 border-transparent px-2 py-1.5 text-body-sm hover:bg-surface-sunken aria-[current=page]:border-primary aria-[current=page]:bg-primary-soft"
                  >
                    <span className="block truncate">
                      <span className="tabular-nums">{q.position}</span>{" "}
                      {q.text}
                    </span>
                    {q.reviewed ? (
                      <span className="block font-semibold text-success">
                        {" "}
                        <span aria-hidden="true">✓</span> Gjennomgått
                      </span>
                    ) : (
                      <span className="sr-only"> Ikke gjennomgått</span>
                    )}
                    {q.fallbackReason && (
                      <span className="block text-ink-muted"> Manuell</span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <div className="mt-4 border-t border-line pt-4">
            <LockBoard id="las-grunn-rail" gameId={id} remaining={remaining} />
          </div>
        </div>

        {/* Below 1024 px the rail is a select; a GET form, so changing it never navigates (WCAG 3.2.2). */}
        <form
          method="get"
          action={`/spill/${id}/gjennomgang`}
          className="mb-6 flex flex-wrap items-end gap-2 lg:hidden"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="sporsmal-velger" className="text-label">
              Spørsmål
            </label>
            <select
              id="sporsmal-velger"
              name="q"
              defaultValue={current.position}
              className="min-h-12 w-full rounded-sm border border-line-strong bg-surface px-3"
            >
              {questions.map((q) => (
                <option key={q.id} value={q.position}>
                  Spørsmål {q.position} av {total} –{" "}
                  {q.reviewed ? "Gjennomgått" : "Ikke gjennomgått"}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary">
            Vis
          </Button>
        </form>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2
              id="sporsmal-overskrift"
              className="min-w-0 text-heading break-words"
            >
              <span className="block font-sans text-label">
                Spørsmål {current.position} av {total}
              </span>{" "}
              {question.text}
            </h2>
            <MarkReviewed
              gameId={id}
              questionId={question.id}
              position={current.position}
              reviewed={question.reviewed}
              nextHref={next && href(next.position)}
              headingId="sporsmal-overskrift"
              hasBoard={current.board.length > 0}
            />
          </div>

          <ReviewGroups
            key={current.position}
            gameId={id}
            board={current.board}
            below={current.below}
            discarded={current.discarded}
          />
        </div>
      </div>

      <div className="mt-12 border-t border-line pt-6 lg:hidden">
        <LockBoard id="las-grunn-fot" gameId={id} remaining={remaining} />
      </div>
    </div>
  );
}

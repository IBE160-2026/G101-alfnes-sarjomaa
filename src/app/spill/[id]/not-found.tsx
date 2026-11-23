import Link from "next/link";

// One page for missing, foreign and malformed Game IDs alike (FR-1, AD-5).
export default function GameNotFound() {
  return (
    <>
      <h1 className="text-display">Vi finner ikke dette spillet.</h1>
      <p className="mt-6">
        <Link
          href="/spill"
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          Mine spill
        </Link>
      </p>
    </>
  );
}

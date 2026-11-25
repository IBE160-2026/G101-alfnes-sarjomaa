"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FullscreenKey } from "@/components/FullscreenKey";
import { TV_IDLE_MS, TV_POLL_MS } from "@/lib/limits";
import { playChannel, type PlayMessage } from "@/lib/play";
import type { PlayView } from "@/server/play";

// How long the Bom panel stays up.
const BOM_MS = 1500;

// UX-DR21 list budget: 696 px for up to eight rows with 8 px gaps, each 80–104 px.
const rowHeight = (n: number) =>
  Math.min(104, Math.max(80, (696 - 8 * (n - 1)) / n));

const revealedIds = (board: PlayView["board"]) =>
  board
    .filter((s) => s.revealed)
    .map((s) => s.id)
    .join(" ");

// The TV page follows the Host view by re-reading saved state on a channel message and on
// a poll (AD-16, AD-17); nothing on the channel is state. The poll rests once `version`
// (what the TV shows) has not changed for TV_IDLE_MS, and wakes on focus, on becoming
// visible or on a channel message. Returns the Bom count.
function useTvSync(gameId: string, version = "") {
  const router = useRouter();
  const [miss, setMiss] = useState(0);
  const missTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const changedAt = useRef(0);

  useEffect(() => {
    changedAt.current = Date.now();
  }, [version]);

  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === "visible")
        changedAt.current = Date.now();
    };
    const channel = new BroadcastChannel(playChannel(gameId));
    channel.onmessage = ({ data }: MessageEvent<PlayMessage>) => {
      wake();
      if (data === "changed") return router.refresh();
      // shortcut: Bom is not saved, so a TV on another device misses it; save it if that matters in play.
      if (data !== "bom") return;
      setMiss((n) => n + 1);
      clearTimeout(missTimer.current);
      missTimer.current = setTimeout(() => setMiss(0), BOM_MS);
    };
    // shortcut: a TV on another device stops following after TV_IDLE_MS without a move
    // until someone wakes it; push from the server if long pauses mid-Game are common.
    const poll = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - changedAt.current < TV_IDLE_MS
      )
        router.refresh();
    }, TV_POLL_MS);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      channel.close();
      clearInterval(poll);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
      clearTimeout(missTimer.current);
    };
  }, [gameId, router]);

  return miss;
}

// On the TV's waiting screen, so it moves into play once the Host starts.
export function TvRefresh({ gameId }: { gameId: string }) {
  useTvSync(gameId);
  return null;
}

// The TV's list: hidden tiles show only their rank.
function BoardTiles({
  board,
  revealing,
}: {
  board: PlayView["board"];
  revealing: (id: string) => boolean;
}) {
  const height = rowHeight(board.length);
  return (
    <ol className="col-start-1 row-start-2 flex min-h-0 flex-col gap-2">
      {board.map((slot) => (
        <li key={slot.id} className="flex" style={{ flex: `0 1 ${height}px` }}>
          {slot.revealed ? (
            <div
              data-slot={slot.id}
              data-revealing={revealing(slot.id) ? "" : undefined}
              // min-w-0: an unbroken 40-character label wraps inside the tile (A9).
              className={`flex min-w-0 flex-1 items-center rounded-md border-2 px-6 ${
                slot.scored
                  ? "border-stage-ink bg-stage-ink text-ink"
                  : "border-dashed border-stage-line bg-stage-raised text-stage-ink"
              }`}
            >
              <span className="w-14 shrink-0 text-tv-label">
                {slot.position}
              </span>
              <span className="reveal-label min-w-0 flex-1 break-words text-tv-label leading-[1.05]">
                {slot.label}
              </span>
              {slot.scored ? (
                <span className="reveal-count ml-6 min-w-24 shrink-0 rounded-full bg-count-badge px-4 py-2 text-center text-tv-count tabular-nums text-stage-ink">
                  {slot.count}
                  <span className="sr-only"> poeng</span>
                </span>
              ) : (
                <span className="reveal-count ml-6 flex shrink-0 items-baseline gap-4">
                  <span className="text-tv-count tabular-nums text-stage-muted">
                    {slot.count}
                  </span>
                  <span className="font-sans text-tv-control text-stage-muted">
                    uten poeng
                  </span>
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center rounded-md border-2 border-stage-line bg-stage-tile px-6 text-tv-label">
              <span className="w-14">{slot.position}</span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

// "Bom" over the list; a new key restarts its animation. Visual only: a miss saves nothing.
function BomPanel({ miss }: { miss: number }) {
  if (miss === 0) return null;
  return (
    <div
      key={miss}
      aria-hidden="true"
      className="bom-panel pointer-events-none col-start-1 row-start-2 place-self-center rounded-md border-2 border-stage-line bg-stage-raised px-16 py-6 text-tv-score text-stage-ink"
    >
      Bom
    </div>
  );
}

// The TV page's list: no controls, only F.
export function TvBoard({
  gameId,
  board,
  version,
}: {
  gameId: string;
  board: PlayView["board"];
  version: string;
}) {
  const miss = useTvSync(gameId, version);
  // Slots revealed since the previous render animate until the revealed set changes again,
  // so a poll mid-animation does not cut it. Nothing animates on the first render.
  const ids = revealedIds(board);
  const [seen, setSeen] = useState({ ids, revealing: new Set<string>() });
  if (seen.ids !== ids) {
    const before = new Set(seen.ids.split(" "));
    setSeen({
      ids,
      revealing: new Set(ids.split(" ").filter((id) => id && !before.has(id))),
    });
  }

  return (
    <>
      <BoardTiles board={board} revealing={(id) => seen.revealing.has(id)} />
      <BomPanel miss={miss} />
      <FullscreenKey />
    </>
  );
}

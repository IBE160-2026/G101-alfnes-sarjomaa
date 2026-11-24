"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BoardTiles, BomPanel } from "@/components/Board";
import { FullscreenKey } from "@/components/FullscreenKey";
import { BOM_MS } from "@/components/usePlay";
import { TV_IDLE_MS, TV_POLL_MS } from "@/lib/limits";
import { playChannel, type PlayMessage } from "@/lib/play";
import type { PlayView } from "@/server/play";

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

// On the TV page beside Team setup, so it moves into play once the Host starts.
export function TvRefresh({ gameId }: { gameId: string }) {
  useTvSync(gameId);
  return null;
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
      <FullscreenKey className="hidden" />
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BoardTiles, BomPanel } from "@/components/Board";
import { FullscreenKey } from "@/components/FullscreenKey";
import { BOM_MS } from "@/components/usePlay";
import { TV_POLL_MS } from "@/lib/limits";
import { playChannel, type PlayMessage } from "@/lib/play";
import type { PlayView } from "@/server/play";

const revealedIds = (board: PlayView["board"]) =>
  board
    .filter((s) => s.revealed)
    .map((s) => s.id)
    .join(" ");

// The TV page's list: no controls, only F. It follows the Host view by re-reading saved
// state on a channel message and on a poll (AD-16, AD-17); nothing on the channel is state.
export function TvBoard({
  gameId,
  board,
}: {
  gameId: string;
  board: PlayView["board"];
}) {
  const router = useRouter();
  const [miss, setMiss] = useState(0);
  const missTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
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

  useEffect(() => {
    const channel = new BroadcastChannel(playChannel(gameId));
    channel.onmessage = ({ data }: MessageEvent<PlayMessage>) => {
      if (data === "changed") return router.refresh();
      if (data !== "bom") return;
      setMiss((n) => n + 1);
      clearTimeout(missTimer.current);
      missTimer.current = setTimeout(() => setMiss(0), BOM_MS);
    };
    // shortcut: Bom is not saved, so a TV on another device misses it; save it if that matters in play.
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, TV_POLL_MS);
    return () => {
      channel.close();
      clearInterval(poll);
      clearTimeout(missTimer.current);
    };
  }, [gameId, router]);

  return (
    <>
      <BoardTiles board={board} revealing={(id) => seen.revealing.has(id)} />
      <BomPanel miss={miss} />
      <FullscreenKey className="hidden" />
    </>
  );
}

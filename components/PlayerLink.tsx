"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPlayerIdByName } from "@/lib/playerIndex";

interface PlayerLinkProps {
  name: string;
  className?: string;
  children?: React.ReactNode;
}

export default function PlayerLink({ name, className = "underline hover:text-blue-400 transition-colors", children }: PlayerLinkProps) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchPlayerId() {
      try {
        const id = await getPlayerIdByName(name);
        if (isMounted) {
          setPlayerId(id);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchPlayerId();
    
    return () => {
      isMounted = false;
    };
  }, [name]);

  if (loading) {
    return <span className="text-slate-400">{children || name}</span>;
  }

  if (playerId) {
    return (
      <Link href={`/players/${playerId}`} className={className}>
        {children || name}
      </Link>
    );
  }

  // プレイヤーが見つからない場合は通常のテキスト
  return <span>{children || name}</span>;
}

// バッチ処理用の軽量版
interface PlayerLinkSimpleProps {
  name: string;
  playerId?: string;
  className?: string;
}

export function PlayerLinkSimple({ name, playerId, className = "underline hover:text-blue-400 transition-colors" }: PlayerLinkSimpleProps) {
  if (playerId) {
    return (
      <Link href={`/players/${playerId}`} className={className}>
        {name}
      </Link>
    );
  }
  return <span>{name}</span>;
}
"use client";
import Link from "next/link";
import { trackArticleCTA } from "@/lib/analytics";

type Props = {
  slug: string;       // 記事slug（例: "re24-winning-lines"）
  to: string;         // 遷移先URL
  children: React.ReactNode;
  position?: "body" | "after_summary" | "footer";
};

export default function ArticleCta({ slug, to, children, position = "body" }: Props) {
  return (
    <Link
      href={to}
      onClick={() => trackArticleCTA(slug, to, { position })}
      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 hover:shadow-sm bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200 hover:border-slate-300 transition-colors"
    >
      {children}
    </Link>
  );
}
import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";

const PHRASES = [
  "أستغفر الله العظيم وأتوب إليه",
  "سبحان الله وبحمده، سبحان الله العظيم",
  "اللهم صلِّ وسلم على نبينا محمد",
  "لا حول ولا قوة إلا بالله",
  "الحمد لله رب العالمين",
  "رب زدني علماً",
];

/** Rendered in normal page flow at the very bottom, so it never covers content. */
export function DhikrPill() {
  const [i, setI] = useState(0);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % PHRASES.length), 45_000);
    return () => clearInterval(id);
  }, []);
  if (hidden) return null;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-6 flex justify-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-school/30 bg-school-soft ps-4 pe-1.5 py-1.5 text-sm text-school">
        <Sparkles className="size-4 shrink-0" />
        <span key={i} className="animate-in fade-in duration-700">{PHRASES[i]}</span>
        <button onClick={() => setHidden(true)} aria-label="إخفاء"
          className="rounded-full p-1 text-muted-foreground hover:bg-card">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Loader2, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة التحكم — المكتبة الرقمية المدرسية" },
      { name: "description", content: "إدارة أدوار التلاميذ والكتّاب في المكتبة الرقمية." },
      { property: "og:title", content: "لوحة التحكم" },
      { property: "og:description", content: "إدارة أدوار المستخدمين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Row = { id: string; email: string; full_name: string | null; roles: string[] };

function AdminPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["admin-users"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return data as Row[];
    },
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (users.data ?? []).filter((u) =>
      !t || u.email?.toLowerCase().includes(t) || u.full_name?.toLowerCase().includes(t));
  }, [users.data, q]);

  async function setWriter(id: string, writer: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("admin_set_writer", { _user_id: id, _is_writer: writer });
    setBusy(null);
    if (error) { toast.error("تعذّر تغيير الدور"); return; }
    toast.success(writer ? "أصبح كاتباً معتمداً" : "أصبح تلميذاً");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  if (users.isLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (users.isError) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="notebook-paper rounded-xl p-10 text-center space-y-3">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h1 className="text-xl font-extrabold">غير مسموح</h1>
          <p className="text-muted-foreground">هذه الصفحة مخصّصة للمشرفين فقط.</p>
          <Button asChild><Link to="/">العودة إلى المكتبة</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><ShieldCheck className="text-school" /> لوحة التحكم</h1>
        <Button variant="ghost" asChild><Link to="/"><ArrowRight className="size-4" /> المكتبة</Link></Button>
      </div>
      <div className="relative">
        <Search className="size-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
        <Input className="ps-9 bg-card" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو البريد الإلكتروني" />
      </div>
      <ul className="space-y-2">
        {filtered.map((u) => {
          const admin = u.roles.includes("admin");
          const writer = u.roles.includes("writer");
          return (
            <li key={u.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{u.full_name || "بدون اسم"}</p>
                <p className="text-xs text-muted-foreground truncate" dir="ltr">{u.email}</p>
              </div>
              {admin ? <Badge>مشرف</Badge> : (
                <div className="flex rounded-full border p-0.5 text-sm">
                  {[{ v: false, l: "تلميذ" }, { v: true, l: "كاتب" }].map((o) => (
                    <button key={o.l} disabled={busy === u.id || writer === o.v}
                      onClick={() => setWriter(u.id, o.v)}
                      className={`rounded-full px-3 py-1 transition ${writer === o.v ? "bg-school text-school-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا يوجد مستخدمون.</p>}
      </ul>
    </div>
  );
}

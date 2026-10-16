import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight, Loader2, Search, ShieldAlert, ShieldCheck, Pencil, Ban, Undo2, Trash2, Users, BookOpen, Eye, Megaphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUBJECTS, CONTENT_TYPES, subjectLabel, contentTypeLabel } from "@/lib/library";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة التحكم — المكتبة الرقمية المدرسية" },
      { name: "description", content: "إدارة التلاميذ والدروس والإعلانات في المكتبة الرقمية." },
      { property: "og:title", content: "لوحة التحكم" },
      { property: "og:description", content: "إدارة المنصة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type U = { id: string; email: string; full_name: string | null; roles: string[]; banned: boolean; lessons_count: number };

function AdminPage() {
  const isAdmin = useQuery({
    queryKey: ["am-admin"],
    retry: false,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      return data === true;
    },
  });

  if (isAdmin.isLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!isAdmin.data) {
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
    <div className="min-h-screen mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><ShieldCheck className="text-school" /> لوحة التحكم</h1>
        <Button variant="ghost" asChild><Link to="/"><ArrowRight className="size-4" /> المكتبة</Link></Button>
      </div>
      <Stats />
      <Tabs defaultValue="users" dir="rtl">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="users">التلاميذ والصلاحيات</TabsTrigger>
          <TabsTrigger value="banned">الحسابات المحظورة</TabsTrigger>
          <TabsTrigger value="lessons">الكراريس والدروس</TabsTrigger>
          <TabsTrigger value="announce">شريط الإعلانات</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersPanel /></TabsContent>
        <TabsContent value="banned"><BannedPanel /></TabsContent>
        <TabsContent value="lessons"><LessonsPanel /></TabsContent>
        <TabsContent value="announce"><AnnouncePanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stats() {
  const s = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return data[0]!;
    },
  });
  const top = (s.data?.top_subjects as { subject: string; views: number }[] | undefined) ?? [];
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <Card icon={<Users className="size-5" />} label="التلاميذ المسجّلون" value={s.data?.students} />
      <Card icon={<BookOpen className="size-5" />} label="الدروس المنشورة" value={s.data?.lessons} />
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Eye className="size-5" /> المواد الأكثر قراءة</p>
        {top.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد قراءات بعد</p> : (
          <ol className="space-y-1 text-sm">
            {top.slice(0, 3).map((t, i) => (
              <li key={t.subject} className="flex justify-between"><span>{i + 1}. {subjectLabel(t.subject)}</span><span className="text-muted-foreground">{t.views}</span></li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">{icon} {label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value ?? "…"}</p>
    </div>
  );
}

function useUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users_full");
      if (error) throw error;
      return data as unknown as U[];
    },
  });
}

function UsersPanel() {
  const qc = useQueryClient();
  const users = useUsers();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<U | null>(null);
  const [banEmail, setBanEmail] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (users.data ?? []).filter((u) => {
      const role = u.roles.includes("admin") ? "admin" : u.roles.includes("writer") ? "writer" : "student";
      if (filter === "banned" ? !u.banned : filter !== "all" && role !== filter) return false;
      return !t || u.email?.toLowerCase().includes(t) || u.full_name?.toLowerCase().includes(t);
    });
  }, [users.data, q, filter]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); qc.invalidateQueries({ queryKey: ["admin-banned"] }); };

  async function setWriter(id: string, writer: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("admin_set_writer", { _user_id: id, _is_writer: writer });
    setBusy(null);
    if (error) { toast.error("تعذّر تغيير الدور"); return; }
    toast.success(writer ? "أصبح كاتباً معتمداً" : "أصبح تلميذاً");
    refresh();
  }
  async function ban(email: string) {
    if (!email.trim()) return;
    if (!confirm(`حظر ${email}؟`)) return;
    const { error } = await supabase.rpc("admin_ban", { _email: email });
    if (error) { toast.error(error.message.includes("admin") ? "لا يمكن حظر مشرف" : "تعذّر الحظر"); return; }
    toast.success("تم حظر الحساب");
    setBanEmail("");
    refresh();
  }
  async function unban(email: string) {
    const { error } = await supabase.from("banned_users").delete().eq("email", email.toLowerCase());
    if (error) { toast.error("تعذّر رفع الحظر"); return; }
    toast.success("تم رفع الحظر");
    refresh();
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
          <Input className="ps-9 bg-card" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو البريد الإلكتروني" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الجميع</SelectItem>
            <SelectItem value="student">التلاميذ</SelectItem>
            <SelectItem value="writer">الكتّاب</SelectItem>
            <SelectItem value="admin">المشرفون</SelectItem>
            <SelectItem value="banned">المحظورون</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ban(banEmail); }}>
        <Input dir="ltr" type="email" className="bg-card" value={banEmail} onChange={(e) => setBanEmail(e.target.value)} placeholder="email@example.com" />
        <Button type="submit" variant="destructive"><Ban className="size-4" /> حظر بالبريد</Button>
      </form>
      {users.isLoading ? <Loader2 className="mx-auto animate-spin text-primary" /> : (
        <ul className="space-y-2">
          {filtered.map((u) => {
            const admin = u.roles.includes("admin");
            const writer = u.roles.includes("writer");
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
                <div className="flex-1 min-w-[180px]">
                  <p className="font-bold truncate flex items-center gap-2">
                    {u.full_name || "بدون اسم"}
                    {u.banned && <Badge variant="destructive">محظور</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate" dir="ltr">{u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.lessons_count} صفحة منشورة</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="تعديل الاسم" onClick={() => setEdit(u)}><Pencil className="size-4" /></Button>
                {admin ? <Badge>مشرف</Badge> : (
                  <>
                    <div className="flex rounded-full border p-0.5 text-sm">
                      {[{ v: false, l: "تلميذ" }, { v: true, l: "كاتب" }].map((o) => (
                        <button key={o.l} disabled={busy === u.id || writer === o.v}
                          onClick={() => setWriter(u.id, o.v)}
                          className={`rounded-full px-3 py-1 transition ${writer === o.v ? "bg-school text-school-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                    {u.banned
                      ? <Button size="sm" variant="outline" onClick={() => unban(u.email)}><Undo2 className="size-4" /> رفع الحظر</Button>
                      : <Button size="sm" variant="outline" className="text-destructive" onClick={() => ban(u.email)}><Ban className="size-4" /> حظر</Button>}
                  </>
                )}
              </li>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا يوجد مستخدمون.</p>}
        </ul>
      )}
      {edit && <EditNameDialog user={edit} onClose={() => setEdit(null)} onDone={refresh} />}
    </div>
  );
}

function EditNameDialog({ user, onClose, onDone }: { user: U; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(user.full_name ?? "");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("admin_set_name", { _user_id: user.id, _name: name });
    if (error) { toast.error("تعذّر حفظ الاسم"); return; }
    toast.success("تم تعديل الاسم");
    onDone(); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>تعديل اسم التلميذ</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" className="w-full">حفظ</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BannedPanel() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-banned"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banned_users").select("*").order("banned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  async function unban(email: string) {
    const { error } = await supabase.from("banned_users").delete().eq("email", email);
    if (error) { toast.error("تعذّر رفع الحظر"); return; }
    toast.success("تم رفع الحظر");
    ["admin-banned", "admin-users", "admin-stats"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }
  return (
    <ul className="space-y-2 pt-3">
      {(list.data ?? []).map((b) => (
        <li key={b.email} className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate" dir="ltr">{b.email}</p>
            <p className="text-xs text-muted-foreground">منذ {new Date(b.banned_at).toLocaleDateString("ar-DZ")}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => unban(b.email)}><Undo2 className="size-4" /> رفع الحظر</Button>
        </li>
      ))}
      {list.data?.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد حسابات محظورة.</p>}
    </ul>
  );
}

type L = { id: string; title: string; subject: string; content_type: string; domain: string | null; unit: string | null; image_path: string; user_id: string; created_at: string };

function LessonsPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const [edit, setEdit] = useState<L | null>(null);
  const data = useQuery({
    queryKey: ["admin-lessons"],
    queryFn: async () => {
      const [l, p] = await Promise.all([
        supabase.from("lessons").select("id,title,subject,content_type,domain,unit,image_path,user_id,created_at").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (l.error) throw l.error;
      return { lessons: l.data as L[], names: new Map((p.data ?? []).map((x) => [x.id, x.full_name])) };
    },
  });
  const filtered = (data.data?.lessons ?? []).filter((l) =>
    (subject === "all" || l.subject === subject) && (!q.trim() || l.title.toLowerCase().includes(q.trim().toLowerCase())));
  const refresh = () => ["admin-lessons", "lessons", "admin-stats"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  async function del(l: L) {
    if (!confirm(`حذف "${l.title}"؟`)) return;
    const { error } = await supabase.from("lessons").delete().eq("id", l.id);
    if (error) { toast.error("تعذّر الحذف (قد تكون هناك صفحات تابعة له)"); return; }
    await supabase.storage.from("lessons-images").remove([l.image_path]);
    toast.success("تم حذف الصفحة");
    refresh();
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap gap-2">
        <Input className="flex-1 min-w-[200px] bg-card" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بعنوان الدرس" />
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-48 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المواد</SelectItem>
            {SUBJECTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <ul className="space-y-2">
        {filtered.map((l) => (
          <li key={l.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{l.title}</p>
              <p className="text-xs text-muted-foreground">{subjectLabel(l.subject)} · {contentTypeLabel(l.content_type)} · {data.data?.names.get(l.user_id) || "تلميذ"}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="تعديل" onClick={() => setEdit(l)}><Pencil className="size-4" /></Button>
            <Button size="icon" variant="ghost" className="text-destructive" aria-label="حذف" onClick={() => del(l)}><Trash2 className="size-4" /></Button>
          </li>
        ))}
        {data.isSuccess && filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد دروس.</p>}
      </ul>
      {edit && <EditLessonDialog lesson={edit} onClose={() => setEdit(null)} onDone={refresh} />}
    </div>
  );
}

function EditLessonDialog({ lesson, onClose, onDone }: { lesson: L; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: lesson.title, subject: lesson.subject, content_type: lesson.content_type, domain: lesson.domain ?? "", unit: lesson.unit ?? "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    const { error } = await supabase.from("lessons").update({
      title: f.title.trim(), subject: f.subject, content_type: f.content_type, domain: f.domain.trim() || null, unit: f.unit.trim() || null,
    }).eq("id", lesson.id);
    if (error) { toast.error("تعذّر الحفظ"); return; }
    toast.success("تم تعديل الدرس");
    onDone(); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>تعديل الدرس</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Label>العنوان</Label>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={f.subject} onValueChange={(v) => setF({ ...f, subject: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.content_type} onValueChange={(v) => setF({ ...f, content_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTENT_TYPES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} placeholder="الميدان" />
          <Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="الوحدة" />
          <Button type="submit" className="w-full">حفظ</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncePanel() {
  const qc = useQueryClient();
  const a = useQuery({
    queryKey: ["announcement-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_announcement").select("message, active").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
  const [msg, setMsg] = useState("");
  const [active, setActive] = useState(false);
  useEffect(() => { if (a.data) { setMsg(a.data.message); setActive(a.data.active); } }, [a.data]);
  async function save(nextActive = active) {
    const { error } = await supabase.from("site_announcement").update({ message: msg, active: nextActive, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast.error("تعذّر الحفظ"); return; }
    toast.success(nextActive ? "الإعلان ظاهر للجميع" : "الإعلان مخفي");
    qc.invalidateQueries({ queryKey: ["announcement"] });
    qc.invalidateQueries({ queryKey: ["announcement-admin"] });
  }
  return (
    <div className="space-y-4 pt-3 rounded-xl border bg-card p-4">
      <Label className="flex items-center gap-2"><Megaphone className="size-4" /> نص الإعلان</Label>
      <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="مثلاً: فرض الإسبانية يوم الأحد القادم" />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={active} onCheckedChange={(v) => { if (v && !msg.trim()) { toast.error("اكتب نص الإعلان أولاً"); return; } setActive(v); save(v); }} />
          {active ? "ظاهر لجميع التلاميذ" : "مخفي"}
        </label>
        <Button onClick={() => save()}>حفظ النص</Button>
      </div>
    </div>
  );
}

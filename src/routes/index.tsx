import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen, LogOut, Plus, Search, ArrowUp, ArrowDown, Link2, Loader2, ImagePlus, X, NotebookPen, ShieldCheck, Lock as LockIcon,
  ArrowRight, FileText, ZoomIn, ZoomOut, Download,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Timetable } from "@/components/Timetable";
import { DhikrPill } from "@/components/DhikrPill";
import { SUBJECTS, CONTENT_TYPES, subjectLabel, contentTypeLabel, compressImage } from "@/lib/library";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "المكتبة الرقمية المدرسية — 2 ثانوي لغات أجنبية" },
      { name: "description", content: "تصفّح كراريس زملائك في الإسبانية وباقي المواد، وابحث عن الدروس التي غبت عنها." },
      { property: "og:title", content: "المكتبة الرقمية المدرسية" },
      { property: "og:description", content: "كراريس دروس وملخصات تلاميذ 2AS لغات أجنبية — شعبة الإسبانية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Lesson = {
  id: string; user_id: string; title: string; subject: string; content_type: string;
  domain: string | null; unit: string | null; page_number: number;
  parent_lesson_id: string | null; image_path: string; order_index: number; created_at: string;
};
type Profile = { id: string; full_name: string | null };

function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

function Index() {
  const { user, ready } = useUser();
  const qc = useQueryClient();

  const profiles = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });
  const lessons = useQuery({
    queryKey: ["lessons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lessons").select("*")
        .order("order_index").order("created_at");
      if (error) throw error;
      return data as Lesson[];
    },
  });

  const myProfile = profiles.data?.find((p) => p.id === user?.id);
  const roles = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.role);
    },
  });
  const isAdmin = !!roles.data?.includes("admin");
  const canPublish = isAdmin || !!roles.data?.includes("writer");
  const needsName = !!user && profiles.isSuccess && !myProfile?.full_name;

  const [studentId, setStudentId] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");
  const [q, setQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [zoom, setZoom] = useState<Lesson | null>(null);
  const [open, setOpen] = useState<{ userId: string; subject: string } | null>(null);

  const nameOf = (id: string) => profiles.data?.find((p) => p.id === id)?.full_name || "تلميذ";
  const uploaders = useMemo(() => {
    const ids = new Set((lessons.data ?? []).map((l) => l.user_id));
    return (profiles.data ?? []).filter((p) => ids.has(p.id) && p.full_name);
  }, [lessons.data, profiles.data]);

  const term = q.trim().toLowerCase();
  const matches = (l: Lesson) => !term || [l.title, l.domain, l.unit].some((v) => v?.toLowerCase().includes(term));

  const notebooks = useMemo(() => {
    const map = new Map<string, { userId: string; subject: string; count: number }>();
    for (const l of lessons.data ?? []) {
      if (subject !== "all" && l.subject !== subject) continue;
      if (studentId !== "all" && l.user_id !== studentId) continue;
      if (!matches(l)) continue;
      const k = `${l.user_id}|${l.subject}`;
      const e = map.get(k) ?? { userId: l.user_id, subject: l.subject, count: 0 };
      e.count++; map.set(k, e);
    }
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons.data, subject, studentId, term]);

  const visible = useMemo(() => !open ? [] : (lessons.data ?? []).filter((l) =>
    l.user_id === open.userId && l.subject === open.subject && matches(l)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  [lessons.data, open, term]);

  const isOwnerView = !!user && open?.userId === user.id && !term;

  async function move(index: number, dir: -1 | 1) {
    const a = visible[index], b = visible[index + dir];
    if (!a || !b) return;
    const updates = visible.map((l, i) => ({ id: l.id, order_index: i }));
    updates[index]!.order_index = index + dir;
    updates[index + dir]!.order_index = index;
    const results = await Promise.all(
      updates.map((u) => supabase.from("lessons").update({ order_index: u.order_index }).eq("id", u.id)),
    );
    if (results.some((r) => r.error)) toast.error("تعذّر حفظ الترتيب");
    else toast.success("تم حفظ الترتيب");
    qc.invalidateQueries({ queryKey: ["lessons"] });
  }

  async function signIn() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("فشل تسجيل الدخول");
  }
  async function signOut() {
    await supabase.auth.signOut();
    setStudentId("all");
    toast("تم تسجيل الخروج");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <BookOpen className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-extrabold text-lg leading-tight">المكتبة الرقمية المدرسية</h1>
            <p className="text-xs text-muted-foreground">2 ثانوي · لغات أجنبية · Español</p>
          </div>
          {ready && (user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-sm text-muted-foreground">{myProfile?.full_name}</span>
              {isAdmin && (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/admin"><ShieldCheck className="size-4" /> لوحة التحكم</Link>
                </Button>
              )}
              {canPublish ? (
                <Button size="sm" onClick={() => setUploadOpen(true)} disabled={needsName}>
                  <Plus className="size-4" /> إضافة درس
                </Button>
              ) : roles.isSuccess && (
                <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  <LockIcon className="size-3" /> النشر متاح فقط للكتّاب المعتمدين
                </span>
              )}
              <Button size="icon" variant="ghost" onClick={signOut} aria-label="تسجيل الخروج">
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={signIn}>تسجيل الدخول باستخدام Google</Button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-6"><Timetable /></div>

      {ready && !user ? (
        <main className="mx-auto max-w-xl px-4 py-16">
          <div className="notebook-paper margin-line rounded-xl p-10 text-center space-y-4">
            <BookOpen className="mx-auto size-10 text-primary" />
            <h2 className="text-2xl font-extrabold">مكتبة كراريس القسم</h2>
            <p className="text-muted-foreground">سجّل الدخول لتصفّح دروس وملخصات زملائك.</p>
            <Button onClick={signIn}>تسجيل الدخول باستخدام Google</Button>
          </div>
        </main>
      ) : (
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <section className="grid gap-3 sm:grid-cols-[1fr_1fr] lg:grid-cols-[220px_1fr_1.4fr]">
          <div className="space-y-1.5">
            <Label>اختر التلميذ</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع التلاميذ</SelectItem>
                {user && myProfile?.full_name && <SelectItem value={user.id}>كراريسي ({myProfile.full_name})</SelectItem>}
                {uploaders.filter((p) => p.id !== user?.id).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ابحث</Label>
            <div className="relative">
              <Search className="size-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <Input className="ps-9 bg-card" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن درس محدد (مثلاً: درس غبت فيه...)" />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1 lg:row-start-1 lg:col-start-3">
            <Label>اختر الكراس</Label>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[{ id: "all", label: "كل المواد" }, ...SUBJECTS].map((s) => (
                <button key={s.id} onClick={() => { setSubject(s.id); setOpen(null); }}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${subject === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-secondary"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {lessons.isLoading ? (
          <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>
        ) : !open ? (
          <>
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-extrabold">الكراريس</h2>
              <span className="text-sm text-muted-foreground">{notebooks.length} كراس</span>
            </div>
            {notebooks.length === 0 ? (
              <div className="notebook-paper margin-line rounded-xl p-12 text-center text-muted-foreground">
                <NotebookPen className="mx-auto mb-3 size-8" /> لا توجد كراريس بعد.
              </div>
            ) : (
              <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {notebooks.map((n) => (
                  <button key={`${n.userId}|${n.subject}`} onClick={() => setOpen({ userId: n.userId, subject: n.subject })}
                    className="group relative aspect-[3/4] rounded-e-xl rounded-s-sm bg-primary text-primary-foreground text-start shadow-md transition hover:-translate-y-1 hover:shadow-xl overflow-hidden">
                    <span className="absolute inset-y-0 start-0 w-3 bg-foreground/20" />
                    <div className="absolute inset-0 ps-6 pe-4 py-5 flex flex-col">
                      <BookOpen className="size-5 opacity-70" />
                      <h3 className="mt-auto text-xl font-extrabold leading-tight">{subjectLabel(n.subject)}</h3>
                      <p className="mt-2 text-sm opacity-80 truncate">{nameOf(n.userId)}</p>
                      <span className="mt-3 self-start rounded-full bg-background/90 text-foreground px-2.5 py-0.5 text-xs font-bold">
                        {n.count} درس
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Button size="icon" variant="outline" onClick={() => setOpen(null)} aria-label="رجوع"><ArrowRight className="size-4" /></Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-extrabold truncate">كراس {subjectLabel(open.subject)}</h2>
                <p className="text-sm text-muted-foreground">{nameOf(open.userId)} · {visible.length} درس</p>
              </div>
            </div>
            {visible.length === 0 ? (
              <div className="notebook-paper margin-line rounded-xl p-12 text-center text-muted-foreground">لا توجد دروس مطابقة.</div>
            ) : (
              <ol className="rounded-xl border bg-card divide-y overflow-hidden">
                {visible.map((l, i) => (
                  <LessonRow key={l.id} index={i + 1} lesson={l}
                    parent={lessons.data?.find((p) => p.id === l.parent_lesson_id)}
                    onOpen={() => setZoom(l)}
                    controls={isOwnerView ? {
                      up: i > 0 ? () => move(i, -1) : undefined,
                      down: i < visible.length - 1 ? () => move(i, 1) : undefined,
                    } : undefined} />
                ))}
              </ol>
            )}
          </>
        )}
      </main>
      )}
      <DhikrPill />

      {needsName && user && <NameDialog userId={user.id} onDone={() => qc.invalidateQueries({ queryKey: ["profiles"] })} />}
      {user && (
        <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} userId={user.id}
          defaultSubject={subject === "all" ? "spanish" : subject} myLessons={(lessons.data ?? []).filter((l) => l.user_id === user.id)}
          onDone={() => qc.invalidateQueries({ queryKey: ["lessons"] })} />
      )}
      <ImageModal lesson={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}

function ImageModal({ lesson, onClose }: { lesson: Lesson | null; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const url = useQuery({
    queryKey: ["img", lesson?.image_path],
    enabled: !!lesson,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("lessons-images").createSignedUrl(lesson!.image_path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  useEffect(() => {
    setZoomed(false);
    if (!lesson) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) supabase.from("lesson_views").insert({ lesson_id: lesson.id, user_id: data.user.id, subject: lesson.subject }).then(() => {});
    });
  }, [lesson]);

  async function download() {
    if (!lesson) return;
    const { data, error } = await supabase.storage.from("lessons-images").download(lesson.image_path);
    if (error || !data) { toast.error("تعذّر التحميل"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data);
    a.download = `${lesson.title}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <Dialog open={!!lesson} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 flex flex-col gap-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-2 pe-12">
          <DialogTitle className="flex-1 truncate text-base">{lesson?.title}</DialogTitle>
          <Button size="sm" variant="outline" onClick={() => setZoomed((z) => !z)}>
            {zoomed ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />} {zoomed ? "تصغير" : "تكبير"}
          </Button>
          <Button size="sm" onClick={download}><Download className="size-4" /> تحميل</Button>
        </div>
        <div className="flex-1 overflow-auto bg-muted">
          {url.data ? (
            <img src={url.data} alt={lesson?.title ?? ""} onClick={() => setZoomed((z) => !z)}
              className={zoomed ? "max-w-none w-[200%] cursor-zoom-out" : "max-h-full max-w-full mx-auto object-contain cursor-zoom-in"} />
          ) : <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LessonRow({ index, lesson: l, parent, onOpen, controls }: {
  index: number; lesson: Lesson; parent?: Lesson | undefined; onOpen: () => void;
  controls?: { up: (() => void) | undefined; down: (() => void) | undefined } | undefined;
}) {
  const meta = [l.domain, l.unit].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 px-3 py-3 hover:bg-secondary/60 transition">
      <button onClick={onOpen} className="flex flex-1 min-w-0 items-center gap-3 text-start">
        <span className="w-6 text-center text-sm text-muted-foreground tabular-nums">{index}</span>
        <span className="size-10 shrink-0 rounded-lg bg-secondary grid place-items-center text-primary"><FileText className="size-5" /></span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-bold truncate">{l.title}</span>
            {l.content_type === "summary" && <Badge className="bg-summary text-summary-foreground">{contentTypeLabel(l.content_type)}</Badge>}
          </span>
          <span className="block text-xs text-muted-foreground truncate">
            {meta || "—"}{parent && <> · <Link2 className="inline size-3" /> تتمة: {parent.title}</>}
          </span>
        </span>
        <span className="shrink-0 text-end">
          <Badge variant="secondary">صفحة {l.page_number}</Badge>
          <span className="block text-[11px] text-muted-foreground mt-1">{new Date(l.created_at).toLocaleDateString("ar-DZ")}</span>
        </span>
      </button>
      {controls && (
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" className="size-7" disabled={!controls.up} onClick={controls.up} aria-label="للأعلى"><ArrowUp className="size-3.5" /></Button>
          <Button size="icon" variant="ghost" className="size-7" disabled={!controls.down} onClick={controls.down} aria-label="للأسفل"><ArrowDown className="size-3.5" /></Button>
        </div>
      )}
    </li>
  );
}

function NameDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (name.trim().length < 3) { toast.error("أدخل اسمك الكامل"); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ id: userId, full_name: name.trim() });
    setBusy(false);
    if (error) { toast.error("تعذّر الحفظ، حاول مجدداً"); return; }
    toast.success("مرحباً بك في المكتبة!");
    setDone(true);
    onDone();
  }
  return (
    <Dialog open={!done}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="[&>button.absolute]:hidden"
      >
        <DialogHeader><DialogTitle>مرحباً! ما اسمك؟</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Label htmlFor="fn">اسم التلميذ الكامل</Label>
          <Input id="fn" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: أيوب بن علي" />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin size-4" />} تأكيد والحفظ
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ open, onOpenChange, userId, defaultSubject, myLessons, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; userId: string; defaultSubject: string;
  myLessons: Lesson[]; onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [type, setType] = useState<string>("lesson");
  const [domain, setDomain] = useState("");
  const [unit, setUnit] = useState("");
  const [isCont, setIsCont] = useState(false);
  const [parentId, setParentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setSubject(defaultSubject); }, [open, defaultSubject]);
  const notebook = myLessons.filter((l) => l.subject === subject);
  const roots = notebook.filter((l) => !l.parent_lesson_id);

  async function submit() {
    if (!title.trim()) { toast.error("عنوان الدرس مطلوب"); return; }
    if (!file) { toast.error("أضف صورة الصفحة"); return; }
    if (isCont && !parentId) { toast.error("اختر الدرس السابق"); return; }
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("lessons-images").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const parent = isCont ? notebook.find((l) => l.id === parentId) : undefined;
      const pageNumber = parent ? 1 + notebook.filter((l) => l.id === parent.id || l.parent_lesson_id === parent.id).length : 1;
      const order = notebook.reduce((m, l) => Math.max(m, l.order_index), -1) + 1;
      const { error } = await supabase.from("lessons").insert({
        user_id: userId, title: title.trim(), subject, content_type: type,
        domain: domain.trim() || null, unit: unit.trim() || null,
        parent_lesson_id: parent?.id ?? null, page_number: pageNumber,
        image_path: path, order_index: order,
      });
      if (error) throw error;
      toast.success("تمت إضافة الصفحة إلى كراسك");
      setTitle(""); setDomain(""); setUnit(""); setIsCont(false); setParentId(""); setFile(null);
      onDone(); onOpenChange(false);
    } catch {
      toast.error("حدث خطأ أثناء الرفع");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>إضافة درس أو ملخص</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>عنوان الدرس *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="El pretérito indefinido" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>المادة</Label>
              <Select value={subject} onValueChange={(v) => { setSubject(v); setParentId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>نوع المحتوى</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_TYPES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>الميدان / المجال</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Gramática" /></div>
            <div className="space-y-1.5"><Label>الوحدة</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unidad 1" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={isCont} onCheckedChange={(v) => setIsCont(!!v)} disabled={roots.length === 0} />
            تتمة / تابع لدرس سابق {roots.length === 0 && <span className="text-muted-foreground">(لا توجد دروس سابقة)</span>}
          </label>
          {isCont && (
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue placeholder="اختر الدرس السابق" /></SelectTrigger>
              <SelectContent>{roots.map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 cursor-pointer hover:bg-secondary text-sm text-muted-foreground">
            {file ? (
              <span className="flex items-center gap-2 text-foreground">{file.name}
                <X className="size-4" onClick={(e) => { e.preventDefault(); setFile(null); }} /></span>
            ) : (<><ImagePlus className="size-6" /> صورة صفحة الكراس (تُضغط تلقائياً)</>)}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin size-4" />} حفظ في الكراس
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

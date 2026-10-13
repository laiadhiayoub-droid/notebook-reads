import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen, LogOut, Plus, Search, ArrowUp, ArrowDown, Link2, Loader2, ImagePlus, X, NotebookPen,
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
  const needsName = !!user && profiles.isSuccess && !myProfile?.full_name;

  const [studentId, setStudentId] = useState<string>("all");
  const [subject, setSubject] = useState<string>("spanish");
  const [q, setQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const nameOf = (id: string) => profiles.data?.find((p) => p.id === id)?.full_name || "تلميذ";
  const uploaders = useMemo(() => {
    const ids = new Set((lessons.data ?? []).map((l) => l.user_id));
    return (profiles.data ?? []).filter((p) => ids.has(p.id) && p.full_name);
  }, [lessons.data, profiles.data]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (lessons.data ?? []).filter((l) =>
      l.subject === subject &&
      (studentId === "all" || l.user_id === studentId) &&
      (!term || [l.title, l.domain, l.unit].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [lessons.data, subject, studentId, q]);

  const isOwnerView = !!user && studentId === user.id;

  async function move(index: number, dir: -1 | 1) {
    const a = visible[index], b = visible[index + dir];
    if (!a || !b) return;
    // normalise indexes on this notebook, then swap
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
              <Button size="sm" onClick={() => setUploadOpen(true)} disabled={needsName}>
                <Plus className="size-4" /> إضافة درس
              </Button>
              <Button size="icon" variant="ghost" onClick={signOut} aria-label="تسجيل الخروج">
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={signIn}>تسجيل الدخول باستخدام Google</Button>
          ))}
        </div>
      </header>

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
              {SUBJECTS.map((s) => (
                <button key={s.id} onClick={() => setSubject(s.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${subject === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-secondary"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-extrabold">
            كراس {subjectLabel(subject).replace("اللغة ", "")}
            {studentId !== "all" && <span className="text-primary"> الخاص بـ {nameOf(studentId)}</span>}
          </h2>
          <span className="text-sm text-muted-foreground">{visible.length} صفحة</span>
        </div>

        {lessons.isLoading ? (
          <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <div className="notebook-paper margin-line rounded-xl p-12 text-center text-muted-foreground">
            <NotebookPen className="mx-auto mb-3 size-8" />
            لا توجد دروس في هذا الكراس بعد.
          </div>
        ) : (
          <ol className="relative space-y-5 border-s-2 border-dashed ps-6">
            {visible.map((l, i) => (
              <LessonCard key={l.id} lesson={l} parent={lessons.data?.find((p) => p.id === l.parent_lesson_id)}
                author={nameOf(l.user_id)} showAuthor={studentId === "all"}
                onZoom={setZoom}
                controls={isOwnerView ? {
                  up: i > 0 ? () => move(i, -1) : undefined,
                  down: i < visible.length - 1 ? () => move(i, 1) : undefined,
                } : undefined} />
            ))}
          </ol>
        )}
      </main>

      {needsName && user && <NameDialog userId={user.id} onDone={() => qc.invalidateQueries({ queryKey: ["profiles"] })} />}
      {user && (
        <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} userId={user.id}
          defaultSubject={subject} myLessons={(lessons.data ?? []).filter((l) => l.user_id === user.id)}
          onDone={() => qc.invalidateQueries({ queryKey: ["lessons"] })} />
      )}
      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 bg-foreground border-0">
          <DialogTitle className="sr-only">صورة الصفحة</DialogTitle>
          {zoom && <img src={zoom} alt="" className="max-h-[90vh] w-auto mx-auto object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useSignedUrl(path: string) {
  return useQuery({
    queryKey: ["img", path],
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("lessons-images").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

function LessonCard({ lesson: l, parent, author, showAuthor, onZoom, controls }: {
  lesson: Lesson; parent?: Lesson; author: string; showAuthor: boolean;
  onZoom: (u: string) => void; controls?: { up: (() => void) | undefined; down: (() => void) | undefined } | undefined;
}) {
  const url = useSignedUrl(l.image_path);
  return (
    <li className="relative">
      <span className="absolute -start-[33px] top-5 size-4 rounded-full bg-accent ring-4 ring-background" />
      <article className="notebook-paper margin-line rounded-xl p-4 flex gap-4">
        <button className="shrink-0 w-24 h-32 sm:w-32 sm:h-40 rounded-md overflow-hidden bg-muted border"
          onClick={() => url.data && onZoom(url.data)} aria-label="تكبير">
          {url.data ? <img src={url.data} alt={l.title} loading="lazy" className="w-full h-full object-cover" />
            : <Loader2 className="m-auto animate-spin text-muted-foreground" />}
        </button>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={l.content_type === "summary" ? "bg-summary text-summary-foreground" : ""}>
              {contentTypeLabel(l.content_type)}
            </Badge>
            {l.unit && <Badge variant="outline">{l.unit}</Badge>}
            <Badge variant="secondary">صفحة {l.page_number}</Badge>
          </div>
          <h3 className="font-bold text-lg leading-snug">{l.title}</h3>
          {l.domain && <p className="text-sm text-muted-foreground">الميدان: {l.domain}</p>}
          {parent && (
            <p className="text-sm text-primary flex items-center gap-1"><Link2 className="size-3.5" /> تتمة للدرس: {parent.title}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {showAuthor && <>{author} · </>}{new Date(l.created_at).toLocaleDateString("ar-DZ")}
          </p>
        </div>
        {controls && (
          <div className="flex flex-col gap-1">
            <Button size="icon" variant="outline" disabled={!controls.up} onClick={controls.up} aria-label="للأعلى"><ArrowUp className="size-4" /></Button>
            <Button size="icon" variant="outline" disabled={!controls.down} onClick={controls.down} aria-label="للأسفل"><ArrowDown className="size-4" /></Button>
          </div>
        )}
      </article>
    </li>
  );
}

function NameDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (name.trim().length < 3) { toast.error("أدخل اسمك الكامل"); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ id: userId, full_name: name.trim() });
    setBusy(false);
    if (error) { toast.error("تعذّر الحفظ"); return; }
    toast.success("مرحباً بك في المكتبة!");
    onDone();
  }
  return (
    <Dialog open>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="[&>button]:hidden">
        <DialogHeader><DialogTitle>مرحباً! ما اسمك؟</DialogTitle></DialogHeader>
        <Label htmlFor="fn">اسم التلميذ الكامل</Label>
        <Input id="fn" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: أيوب بن علي" />
        <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin size-4" />} حفظ</Button>
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

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const BAN_MESSAGE = "تم حظر هذا الحساب من قبل الإدارة. لا يمكنك دخول المنصة.";

/** Signs out banned accounts immediately (database policies also block all their data access). */
export function BanGuard() {
  useEffect(() => {
    async function check() {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const { data } = await supabase.rpc("current_user_banned");
      if (data === true) {
        await supabase.auth.signOut();
        toast.error(BAN_MESSAGE, { duration: 10000 });
      }
    }
    check();
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN") setTimeout(check, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}

/** Top banner; only rendered when an admin switched it on. */
export function AnnouncementBanner() {
  const q = useQuery({
    queryKey: ["announcement"],
    queryFn: async () => {
      const { data } = await supabase.from("site_announcement").select("message, active").eq("id", 1).maybeSingle();
      return data;
    },
  });
  if (!q.data?.active || !q.data.message.trim()) return null;
  return (
    <div className="bg-accent text-accent-foreground">
      <div className="mx-auto max-w-5xl px-4 py-2 flex items-center gap-2 text-sm font-medium">
        <Megaphone className="size-4 shrink-0" />
        <p className="whitespace-pre-line">{q.data.message}</p>
      </div>
    </div>
  );
}

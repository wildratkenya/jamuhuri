import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Headphones, ShoppingBag, RefreshCw, Plus, LogOut, Lock, Pencil } from "lucide-react";
import {
  useListOrders,
  getListOrdersQueryKey,
  useListSubscribers,
  getListSubscribersQueryKey,
  useListMessages,
  getListMessagesQueryKey,
  useGetStatsSummary,
  getGetStatsSummaryQueryKey,
  useListBooks,
  getListBooksQueryKey,
  useListPodcasts,
  getListPodcastsQueryKey,
  usePatchBook,
  usePatchPodcast,
  usePatchSubscriber,
  type Book,
  type Podcast,
  type Subscriber,
  type UpdateBookBody,
  type UpdatePodcastBody,
  type UpdateSubscriberBody,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

const createBookSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().min(10, "Description is required"),
  author: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  type: z.enum(["hardcopy", "ebook", "both"]),
  hardcopyPrice: z.string().optional().nullable(),
  ebookPrice: z.string().optional().nullable(),
  currency: z.string().min(1),
  category: z.string().optional().nullable(),
  publishedYear: z.string().optional().nullable(),
  isLatest: z.boolean().optional(),
});

const createPodcastSchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().min(10, "Description is required"),
  buzzsproutUrl: z.string().min(1, "Buzzsprout URL is required"),
  audioUrl: z.string().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  episodeNumber: z.string().optional().nullable(),
  season: z.string().optional().nullable(),
  publishedAt: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type BookFormValues = z.infer<typeof createBookSchema>;
type PodcastFormValues = z.infer<typeof createPodcastSchema>;

const defaultBookFormValues: BookFormValues = {
  title: "",
  description: "",
  author: "Jamuhuri Gachoroba",
  coverImage: "",
  type: "both",
  hardcopyPrice: "",
  ebookPrice: "",
  currency: "KES",
  category: "",
  publishedYear: "",
  isLatest: false,
};

function bookToFormValues(book: Book): BookFormValues {
  return {
    title: book.title,
    description: book.description,
    author: book.author,
    coverImage: book.coverImage ?? "",
    type: book.type,
    hardcopyPrice: book.hardcopyPrice != null ? String(book.hardcopyPrice) : "",
    ebookPrice: book.ebookPrice != null ? String(book.ebookPrice) : "",
    currency: book.currency,
    category: book.category ?? "",
    publishedYear: book.publishedYear != null ? String(book.publishedYear) : "",
    isLatest: book.isLatest,
  };
}

function bookValuesToUpdateBody(values: BookFormValues): UpdateBookBody {
  return {
    title: values.title,
    description: values.description,
    author: values.author?.trim() || undefined,
    coverImage: values.coverImage?.trim() ? values.coverImage.trim() : null,
    type: values.type,
    hardcopyPrice: values.hardcopyPrice?.trim() ? Number(values.hardcopyPrice) : null,
    ebookPrice: values.ebookPrice?.trim() ? Number(values.ebookPrice) : null,
    currency: values.currency,
    publishedYear: values.publishedYear?.trim() ? Number(values.publishedYear) : null,
    category: values.category?.trim() || null,
    isLatest: Boolean(values.isLatest),
  };
}

function podcastToFormValues(episode: Podcast): PodcastFormValues {
  return {
    title: episode.title,
    description: episode.description,
    buzzsproutUrl: episode.buzzsproutUrl ?? "",
    audioUrl: episode.audioUrl ?? "",
    thumbnailUrl: episode.thumbnailUrl ?? "",
    duration: episode.duration ?? "",
    episodeNumber: episode.episodeNumber != null ? String(episode.episodeNumber) : "",
    season: episode.season != null ? String(episode.season) : "",
    publishedAt: episode.publishedAt ? episode.publishedAt.slice(0, 10) : "",
    tags: Array.isArray(episode.tags) ? episode.tags.join(", ") : "",
  };
}

function podcastValuesToUpdateBody(values: PodcastFormValues): UpdatePodcastBody {
  return {
    title: values.title,
    description: values.description,
    buzzsproutUrl: values.buzzsproutUrl?.trim() || null,
    audioUrl: values.audioUrl?.trim() || null,
    thumbnailUrl: values.thumbnailUrl?.trim() || null,
    duration: values.duration?.trim() || null,
    episodeNumber: values.episodeNumber?.trim() ? Number(values.episodeNumber) : null,
    season: values.season?.trim() ? Number(values.season) : null,
    publishedAt: values.publishedAt?.trim()
      ? new Date(values.publishedAt).toISOString()
      : new Date().toISOString(),
    tags: (values.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

const defaultPodcastFormValues: PodcastFormValues = {
  title: "",
  description: "",
  buzzsproutUrl: "",
  audioUrl: "",
  thumbnailUrl: "",
  duration: "",
  episodeNumber: "",
  season: "",
  publishedAt: "",
  tags: "",
};

const subscriberEditSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional().nullable(),
  wantsWhatsapp: z.boolean(),
  whatsappApproved: z.boolean(),
});

type SubscriberEditFormValues = z.infer<typeof subscriberEditSchema>;

// Simple authentication - in production, use proper auth
const ADMIN_PASSWORD = "jamuhuri2024"; // Change this to a secure password

function LoginForm({ onLogin }: { onLogin: (password: string) => void }) {
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { toast } = useToast();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" },
  });

  const handleLogin = async (values: LoginFormValues) => {
    setLoginError(null);
    setIsLoggingIn(true);
    
    // Simple password check
    if (values.password === ADMIN_PASSWORD) {
      localStorage.setItem("adminAuthenticated", "true");
      onLogin(values.password);
      toast({ title: "Login successful", description: "Welcome to the admin panel." });
    } else {
      setLoginError("Invalid password");
      toast({ variant: "destructive", title: "Login failed", description: "Invalid password." });
    }
    
    setIsLoggingIn(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-3xl p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#c9a227] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-[#0f2337]" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Super Admin Login</h1>
            <p className="text-muted-foreground mt-2">Enter your password to access the admin panel</p>
          </div>

          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Password</label>
              <Input 
                type="password" 
                {...loginForm.register("password")}
                placeholder="Enter admin password"
                className="w-full"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoggingIn}>
              {isLoggingIn ? "Logging in..." : "Login"}
            </Button>

            {loginError && (
              <p className="text-sm text-red-400 text-center">{loginError}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | undefined; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-3xl font-bold text-foreground">{value ?? "—"}</p>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800 border-blue-200" },
    shipped: { label: "Shipped", className: "bg-purple-100 text-purple-800 border-purple-200" },
    delivered: { label: "Delivered", className: "bg-green-100 text-green-800 border-green-200" },
    cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 border-red-200" },
  };
  const s = map[status] || { label: status, className: "bg-gray-100 text-gray-800" };
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${s.className}`}>{s.label}</span>;
}

function parseBuzzsproutUrl(input: string) {
  try {
    const url = new URL(input.trim());
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1] || "";
    const title = slug.replace(/^\d+-?/, "").replace(/[-_]/g, " ").trim();
    const episodeNumberMatch = slug.match(/^(\d+)/);
    return {
      buzzsproutUrl: url.toString(),
      title: title || url.toString(),
      episodeNumber: episodeNumberMatch ? episodeNumberMatch[1] : undefined,
    };
  } catch {
    return { buzzsproutUrl: input, title: input, episodeNumber: undefined };
  }
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tab, setTab] = useState<"orders" | "books" | "podcasts" | "subscribers" | "messages">("orders");
  const qc = useQueryClient();
  const { toast } = useToast();

  // Check authentication on mount
  useEffect(() => {
    const authStatus = localStorage.getItem("adminAuthenticated");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminAuthenticated");
    setIsAuthenticated(false);
    toast({ title: "Logged out", description: "You have been logged out of the admin panel." });
  };

  // Always call hooks at the top level, but conditionally enable them
  const { data: stats } = useGetStatsSummary({ 
    query: { 
      queryKey: getGetStatsSummaryQueryKey(),
      enabled: isAuthenticated 
    } 
  });
  const { data: orders, isLoading: ordersLoading } = useListOrders({ 
    query: { 
      queryKey: getListOrdersQueryKey(),
      enabled: isAuthenticated 
    } 
  });
  const { data: subscribers, isLoading: subsLoading } = useListSubscribers({ 
    query: { 
      queryKey: getListSubscribersQueryKey(),
      enabled: isAuthenticated 
    } 
  });
  const { data: messages, isLoading: msgsLoading } = useListMessages({ 
    query: { 
      queryKey: getListMessagesQueryKey(),
      enabled: isAuthenticated 
    } 
  });
  const { data: books, isLoading: booksLoading } = useListBooks({ 
    query: { 
      queryKey: getListBooksQueryKey(),
      enabled: isAuthenticated 
    } 
  });
  const { data: podcasts, isLoading: podcastsLoading } = useListPodcasts({ 
    query: { 
      queryKey: getListPodcastsQueryKey(),
      enabled: isAuthenticated 
    } 
  });

  const bookForm = useForm<BookFormValues>({
    resolver: zodResolver(createBookSchema),
    defaultValues: defaultBookFormValues,
  });

  const podcastForm = useForm<PodcastFormValues>({
    resolver: zodResolver(createPodcastSchema),
    defaultValues: defaultPodcastFormValues,
  });

  const subscriberEditForm = useForm<SubscriberEditFormValues>({
    resolver: zodResolver(subscriberEditSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      wantsWhatsapp: false,
      whatsappApproved: false,
    },
  });

  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [editingPodcastId, setEditingPodcastId] = useState<number | null>(null);
  const [subscriberToEdit, setSubscriberToEdit] = useState<Subscriber | null>(null);

  const patchBookMutation = usePatchBook({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBooksQueryKey() });
        qc.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        toast({ title: "Book updated", description: "Changes are live on the site." });
      },
    },
  });

  const patchPodcastMutation = usePatchPodcast({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPodcastsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        toast({ title: "Episode updated", description: "Changes are live on the site." });
      },
    },
  });

  const patchSubscriberMutation = usePatchSubscriber({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSubscribersQueryKey() });
        qc.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        toast({ title: "Subscriber updated", description: "Newsletter record saved." });
        setSubscriberToEdit(null);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Update failed", description: "Could not update the subscriber." });
      },
    },
  });

  const [bookSaving, setBookSaving] = useState(false);
  const [podcastSaving, setPodcastSaving] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [podcastError, setPodcastError] = useState<string | null>(null);

  const bookCount = books?.length ?? 0;
  const episodeCount = podcasts?.length ?? 0;

  const parsedBuzzsprout = useMemo(() => {
    const url = podcastForm.watch("buzzsproutUrl");
    return url ? parseBuzzsproutUrl(url) : { buzzsproutUrl: "", title: "", episodeNumber: undefined };
  }, [podcastForm.watch("buzzsproutUrl")]);

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  const saveBook = async (values: BookFormValues) => {
    setBookError(null);
    setBookSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", values.title);
      formData.append("description", values.description);
      if (values.author) formData.append("author", values.author.trim());
      formData.append("type", values.type);
      if (values.hardcopyPrice) formData.append("hardcopyPrice", values.hardcopyPrice);
      if (values.ebookPrice) formData.append("ebookPrice", values.ebookPrice);
      formData.append("currency", values.currency);
      if (values.category) formData.append("category", values.category.trim());
      if (values.publishedYear) formData.append("publishedYear", values.publishedYear);
      formData.append("isLatest", String(Boolean(values.isLatest)));

      const fileInput = document.querySelector('input[type="file"][name="coverImageFile"]') as HTMLInputElement;
      if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append("coverImageFile", fileInput.files[0]);
      }

      if (editingBookId != null) {
        const response = await fetch(`/api/books/${editingBookId}`, {
          method: "PATCH",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Failed to update book");
        }

        setEditingBookId(null);
        bookForm.reset(defaultBookFormValues);
        if (fileInput) fileInput.value = "";
        
        qc.invalidateQueries({ queryKey: getListBooksQueryKey() });
        qc.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        toast({ title: "Book updated", description: "Changes are live on the site." });
        return;
      }

      const response = await fetch("/api/books", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to save book");
      }

      qc.invalidateQueries({ queryKey: getListBooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
      bookForm.reset(defaultBookFormValues);
      if (fileInput) fileInput.value = "";
      toast({ title: "Book added", description: "The book is now available on the homepage and books page." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not save book.";
      setBookError(message);
      toast({ variant: "destructive", title: "Book save failed", description: message });
    } finally {
      setBookSaving(false);
    }
  };

  const savePodcast = async (values: PodcastFormValues) => {
    setPodcastError(null);
    setPodcastSaving(true);
    try {
      if (editingPodcastId != null) {
        await patchPodcastMutation.mutateAsync({
          id: editingPodcastId,
          data: podcastValuesToUpdateBody(values),
        });
        setEditingPodcastId(null);
        podcastForm.reset(defaultPodcastFormValues);
        return;
      }

      const payload = {
        ...values,
        episodeNumber: values.episodeNumber || null,
        season: values.season || null,
        publishedAt: values.publishedAt || new Date().toISOString(),
        tags: values.tags ? values.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      };

      await fetch("/api/podcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      qc.invalidateQueries({ queryKey: getListPodcastsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
      podcastForm.reset(defaultPodcastFormValues);
      toast({ title: "Podcast episode added", description: "The latest episode is now visible on the homepage." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not save episode.";
      setPodcastError(message);
      toast({ variant: "destructive", title: "Podcast save failed", description: message });
    } finally {
      setPodcastSaving(false);
    }
  };

  const openSubscriberEdit = (sub: Subscriber) => {
    setSubscriberToEdit(sub);
    subscriberEditForm.reset({
      name: sub.name,
      email: sub.email,
      phone: sub.phone ?? "",
      wantsWhatsapp: sub.wantsWhatsapp,
      whatsappApproved: sub.whatsappApproved,
    });
  };

  const saveSubscriberEdit = (values: SubscriberEditFormValues) => {
    if (!subscriberToEdit) return;
    const data: UpdateSubscriberBody = {
      name: values.name,
      email: values.email,
      phone: values.phone?.trim() ? values.phone.trim() : null,
      wantsWhatsapp: values.wantsWhatsapp,
      whatsappApproved: values.whatsappApproved,
    };
    patchSubscriberMutation.mutate({ id: subscriberToEdit.id, data });
  };

  const handleBuzzsproutUrlBlur = () => {
    const url = podcastForm.getValues("buzzsproutUrl");
    if (!url) return;
    const parsed = parseBuzzsproutUrl(url);
    if (!podcastForm.getValues("title")) {
      podcastForm.setValue("title", parsed.title);
    }
    if (!podcastForm.getValues("episodeNumber") && parsed.episodeNumber) {
      podcastForm.setValue("episodeNumber", parsed.episodeNumber);
    }
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="bg-[#0f2337] pt-24 pb-12">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-[#c9a227] text-sm font-semibold tracking-widest uppercase mb-2">Admin Panel</p>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-white">Content Manager</h1>
              <p className="text-white/70 mt-2 max-w-2xl">Publish books and podcast episodes that appear on the homepage preview and books page.</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => qc.invalidateQueries()} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
              <Button onClick={handleLogout} variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10">
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <StatCard icon={BookOpen} label="Books" value={bookCount} color="bg-green-500" />
            <StatCard icon={Headphones} label="Podcast Episodes" value={episodeCount} color="bg-blue-500" />
            <StatCard icon={ShoppingBag} label="Live Orders" value={stats?.totalOrders} color="bg-[#c9a227]" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-7xl py-10">
        <div className="flex flex-col md:flex-row gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setTab("orders")} className={`rounded-2xl px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-300 ${tab === "orders" ? "bg-[#c9a227] text-[#0f2337] shadow-lg shadow-[#c9a227]/20" : "bg-card text-muted-foreground hover:bg-muted border border-border"}`}>
            Live Orders
          </button>
          <button onClick={() => setTab("books")} className={`rounded-2xl px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-300 ${tab === "books" ? "bg-[#c9a227] text-[#0f2337] shadow-lg shadow-[#c9a227]/20" : "bg-card text-muted-foreground hover:bg-muted border border-border"}`}>
            Books
          </button>
          <button onClick={() => setTab("podcasts")} className={`rounded-2xl px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-300 ${tab === "podcasts" ? "bg-[#c9a227] text-[#0f2337] shadow-lg shadow-[#c9a227]/20" : "bg-card text-muted-foreground hover:bg-muted border border-border"}`}>
            Podcast Episodes
          </button>
          <button onClick={() => setTab("subscribers")} className={`rounded-2xl px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-300 ${tab === "subscribers" ? "bg-[#c9a227] text-[#0f2337] shadow-lg shadow-[#c9a227]/20" : "bg-card text-muted-foreground hover:bg-muted border border-border"}`}>
            Newsletter
          </button>
          <button onClick={() => setTab("messages")} className={`rounded-2xl px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-300 ${tab === "messages" ? "bg-[#c9a227] text-[#0f2337] shadow-lg shadow-[#c9a227]/20" : "bg-card text-muted-foreground hover:bg-muted border border-border"}`}>
            Messages
          </button>
        </div>

        {tab === "orders" && (
          <div className="bg-card border border-border rounded-3xl p-8 overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[#c9a227] uppercase text-xs tracking-[0.3em] font-semibold mb-2">E-Commerce</p>
                <h2 className="text-3xl font-serif font-bold">Live Orders</h2>
                <p className="text-muted-foreground text-sm mt-1">Real-time view of customer orders for books and podcasts.</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live Sync
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Order ID</th>
                    <th className="pb-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Customer</th>
                    <th className="pb-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Item Details</th>
                    <th className="pb-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="pb-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ordersLoading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <tr key={i}>
                        <td colSpan={5} className="py-6 animate-pulse">
                          <div className="h-4 bg-muted rounded w-full" />
                        </td>
                      </tr>
                    ))
                  ) : orders?.length ? (
                    orders.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="py-6 font-mono text-xs font-bold text-muted-foreground">#ORD-{order.id}</td>
                        <td className="py-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{order.customerName}</span>
                            <span className="text-xs text-muted-foreground">{order.customerEmail}</span>
                            {order.customerPhone && <span className="text-xs text-muted-foreground/70">{order.customerPhone}</span>}
                          </div>
                        </td>
                        <td className="py-6">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{order.bookTitle}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] uppercase font-bold py-0">{order.orderType}</Badge>
                              {order.deliveryCity && <span className="text-xs text-muted-foreground">{order.deliveryCity}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-6 min-w-[140px]">
                          <select 
                            defaultValue={order.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              try {
                                const res = await fetch(`/api/orders/${order.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: newStatus })
                                });
                                if (!res.ok) throw new Error("Update failed");
                                qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
                                toast({ title: "Order updated", description: `Order #${order.id} status changed to ${newStatus}` });
                              } catch (err) {
                                toast({ variant: "destructive", title: "Error", description: "Failed to update order status" });
                                e.target.value = order.status;
                              }
                            }}
                            className="bg-background border border-border text-xs font-semibold px-3 py-1.5 rounded-full capitalize cursor-pointer focus:ring-1 focus:ring-[#c9a227] outline-none"
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="shipped">On Transit</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="py-6 text-right">
                          <div className="text-sm font-medium">{new Date(order.createdAt).toLocaleDateString()}</div>
                          <div className="text-[10px] text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-4 text-muted-foreground">
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                            <ShoppingBag className="h-8 w-8 opacity-20" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">No orders yet</p>
                            <p className="text-sm">When customers place orders, they will appear here.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "books" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8">
            <div className="bg-card border border-border rounded-3xl p-8">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <p className="text-[#c9a227] uppercase text-xs tracking-[0.3em] mb-2">Books</p>
                  <h2 className="text-2xl font-bold">
                    {editingBookId != null ? "Edit book" : "Add a new book"}
                  </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {editingBookId != null && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingBookId(null);
                        bookForm.reset(defaultBookFormValues);
                        setBookError(null);
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                  <Badge className="bg-[#0f2337]/80 text-[#c9a227]">Preview + Books page</Badge>
                </div>
              </div>

              <form onSubmit={bookForm.handleSubmit(saveBook)} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Title</label>
                    <Input {...bookForm.register("title")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Author</label>
                    <Input {...bookForm.register("author")} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
                  <Textarea rows={4} {...bookForm.register("description")} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Book Type</label>
                    <select {...bookForm.register("type")} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground">
                      <option value="both">Hardcopy & Ebook</option>
                      <option value="hardcopy">Hardcopy Only</option>
                      <option value="ebook">Ebook Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Category</label>
                    <Input {...bookForm.register("category")} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Cover Image (Optional)</label>
                    <input 
                      type="file" 
                      name="coverImageFile" 
                      accept="image/*" 
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#c9a227] file:text-[#0f2337] hover:file:bg-[#c9a227]/80 cursor-pointer"
                    />
                  </div>
                  <Input placeholder="Hardcopy price" {...bookForm.register("hardcopyPrice")} />
                  <Input placeholder="Ebook price" {...bookForm.register("ebookPrice")} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input placeholder="Currency (KES)" {...bookForm.register("currency")} />
                  <Input placeholder="Published year" {...bookForm.register("publishedYear")} />
                  <label className="flex items-center gap-3 text-sm text-muted-foreground">
                    <input type="checkbox" {...bookForm.register("isLatest")} className="h-4 w-4 rounded border border-border text-[#c9a227] bg-background" />
                    Mark as latest release
                  </label>
                </div>

                <div className="flex flex-col md:flex-row gap-3 items-center">
                  <Button
                    type="submit"
                    className="w-full md:w-auto"
                    disabled={bookSaving || patchBookMutation.isPending}
                  >
                    {editingBookId != null ? (
                      <>
                        <Pencil className="mr-2 h-4 w-4" /> Update book
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" /> Save book
                      </>
                    )}
                  </Button>
                  {bookError && <p className="text-sm text-red-400">{bookError}</p>}
                </div>
              </form>
            </div>

            <div className="space-y-4">
              <div className="bg-card border border-border rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Books</p>
                    <h3 className="text-xl font-semibold">Loaded Books</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">{bookCount} total</span>
                </div>
                <div className="space-y-3">
                  {booksLoading ? (
                    [1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)
                  ) : books?.length ? (
                    books.map((book) => (
                      <Card key={book.id} className="border border-border bg-background">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">{book.title}</p>
                              <p className="text-sm text-muted-foreground">{book.category || "Finance"}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className="bg-[#0f2337]/80 text-[#c9a227]">{book.type}</Badge>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-9 w-9"
                                aria-label={`Edit ${book.title}`}
                                onClick={() => {
                                  setEditingBookId(book.id);
                                  bookForm.reset(bookToFormValues(book));
                                  setBookError(null);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No books loaded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "podcasts" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8">
            <div className="bg-card border border-border rounded-3xl p-8">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <p className="text-[#c9a227] uppercase text-xs tracking-[0.3em] mb-2">Podcasts</p>
                  <h2 className="text-2xl font-bold">
                    {editingPodcastId != null ? "Edit episode" : "Add latest episode"}
                  </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {editingPodcastId != null && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingPodcastId(null);
                        podcastForm.reset(defaultPodcastFormValues);
                        setPodcastError(null);
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                  <Badge className="bg-[#0f2337]/80 text-[#c9a227]">Homepage Latest</Badge>
                </div>
              </div>

              <form onSubmit={podcastForm.handleSubmit(savePodcast)} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Buzzsprout URL</label>
                    <Input {...podcastForm.register("buzzsproutUrl")} onBlur={handleBuzzsproutUrlBlur} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Episode Title</label>
                    <Input {...podcastForm.register("title")} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Episode Description</label>
                  <Textarea rows={4} {...podcastForm.register("description")} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input placeholder="Audio file URL" {...podcastForm.register("audioUrl")} />
                  <Input placeholder="Thumbnail URL" {...podcastForm.register("thumbnailUrl")} />
                  <Input placeholder="Duration (e.g. 14:03)" {...podcastForm.register("duration")} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input placeholder="Episode number" {...podcastForm.register("episodeNumber")} />
                  <Input placeholder="Season" {...podcastForm.register("season")} />
                  <Input placeholder="Published date (YYYY-MM-DD)" {...podcastForm.register("publishedAt")} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Tags (comma separated)</label>
                  <Input {...podcastForm.register("tags")} />
                </div>

                <div className="flex flex-col md:flex-row gap-3 items-center">
                  <Button
                    type="submit"
                    className="w-full md:w-auto"
                    disabled={podcastSaving || patchPodcastMutation.isPending}
                  >
                    {editingPodcastId != null ? (
                      <>
                        <Pencil className="mr-2 h-4 w-4" /> Update episode
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" /> Save episode
                      </>
                    )}
                  </Button>
                  {podcastError && <p className="text-sm text-red-400">{podcastError}</p>}
                </div>
              </form>

              <div className="mt-6 rounded-2xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                <p className="font-semibold mb-2">URL parser</p>
                <p>Paste a Buzzsprout episode link and the title will be auto-filled from the URL slug.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-card border border-border rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Latest Episodes</p>
                    <h3 className="text-xl font-semibold">Loaded Podcast Episodes</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">{episodeCount} total</span>
                </div>
                <div className="space-y-3">
                  {podcastsLoading ? (
                    [1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)
                  ) : podcasts?.length ? (
                    podcasts.map((episode) => (
                      <Card key={episode.id} className="border border-border bg-background">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold line-clamp-2">{episode.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {episode.episodeNumber ? `Episode ${episode.episodeNumber}` : "Episode"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className="bg-[#0f2337]/80 text-[#c9a227]">
                                {episode.season != null ? `S${episode.season}` : "—"}
                              </Badge>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-9 w-9"
                                aria-label={`Edit ${episode.title}`}
                                onClick={() => {
                                  setEditingPodcastId(episode.id);
                                  podcastForm.reset(podcastToFormValues(episode));
                                  setPodcastError(null);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground truncate">{episode.buzzsproutUrl}</p>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No episodes loaded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "subscribers" && (
          <div className="bg-card border border-border rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[#c9a227] uppercase text-xs tracking-[0.3em] font-semibold mb-2">CRM</p>
                <h2 className="text-3xl font-serif font-bold">Newsletter Subscribers</h2>
                <p className="text-muted-foreground text-sm mt-1">Management of all people who subscribed to your newsletter.</p>
              </div>
              <Badge className="bg-[#0f2337]/80 text-[#c9a227]">{subscribers?.length ?? 0} Total</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="pb-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Email</th>
                    <th className="pb-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider text-right">
                      Subscribed At
                    </th>
                    <th className="pb-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider text-right w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subsLoading ? (
                    [1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td colSpan={4} className="py-6 animate-pulse bg-muted/20" />
                      </tr>
                    ))
                  ) : subscribers?.length ? (
                    subscribers.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-6 font-semibold">{sub.name}</td>
                        <td className="py-6 text-muted-foreground">{sub.email}</td>
                        <td className="py-6 text-right text-xs text-muted-foreground">
                          {new Date(sub.subscribedAt).toLocaleDateString()}
                        </td>
                        <td className="py-6 text-right">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            aria-label={`Edit ${sub.email}`}
                            onClick={() => openSubscriberEdit(sub)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-20 text-center text-muted-foreground">
                        No subscribers yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Dialog
          open={subscriberToEdit != null}
          onOpenChange={(open) => {
            if (!open) setSubscriberToEdit(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit newsletter subscriber</DialogTitle>
              <DialogDescription>Update contact details and WhatsApp preferences.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={subscriberEditForm.handleSubmit(saveSubscriberEdit)}
              className="space-y-4 pt-2"
            >
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Name</label>
                <Input {...subscriberEditForm.register("name")} />
                {subscriberEditForm.formState.errors.name && (
                  <p className="text-sm text-red-400 mt-1">
                    {subscriberEditForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
                <Input type="email" {...subscriberEditForm.register("email")} />
                {subscriberEditForm.formState.errors.email && (
                  <p className="text-sm text-red-400 mt-1">
                    {subscriberEditForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Phone</label>
                <Input {...subscriberEditForm.register("phone")} />
              </div>
              <label className="flex items-center gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  {...subscriberEditForm.register("wantsWhatsapp")}
                  className="h-4 w-4 rounded border border-border"
                />
                Wants WhatsApp updates
              </label>
              <label className="flex items-center gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  {...subscriberEditForm.register("whatsappApproved")}
                  className="h-4 w-4 rounded border border-border"
                />
                WhatsApp approved
              </label>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setSubscriberToEdit(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={patchSubscriberMutation.isPending}>
                  {patchSubscriberMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {tab === "messages" && (
          <div className="bg-card border border-border rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[#c9a227] uppercase text-xs tracking-[0.3em] font-semibold mb-2">Communications</p>
                <h2 className="text-3xl font-serif font-bold">Inbox Messages</h2>
                <p className="text-muted-foreground text-sm mt-1">Direct inquiries from the contact form and order notes.</p>
              </div>
              <Badge className="bg-[#0f2337]/80 text-[#c9a227]">{messages?.length ?? 0} Inquiries</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {msgsLoading ? (
                [1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)
              ) : messages?.length ? (
                messages.map((msg) => (
                  <div key={msg.id} className="p-6 rounded-2xl border border-border bg-background hover:border-[#c9a227]/30 transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <Badge variant="outline" className="mb-2 capitalize">{msg.type}</Badge>
                        <h3 className="font-bold text-lg">{msg.subject}</h3>
                        <p className="text-sm text-[#c9a227] font-medium">{msg.senderEmail}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-muted-foreground">No messages found.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

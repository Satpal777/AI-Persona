"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Loader2,
  Play,
  SearchIcon,
  SendIcon,
  Sparkles,
  Video,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Each visitor gets a random uid kept in localStorage; the server keys its
// in-memory chat history on it. New browser = new uid = fresh chat.
function getUid() {
  let uid = localStorage.getItem("persona-uid");
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem("persona-uid", uid);
  }
  return uid;
}

// Turn plain URLs (video links) into clickable anchors.
function Linkify({ text }) {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="break-all text-primary underline underline-offset-2 hover:opacity-80"
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

function VideoCard({ video }) {
  const thumbnail = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noreferrer"
      className="group/card block overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs transition-all hover:border-primary/50 hover:shadow-md dark:border-border/40"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={thumbnail}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover/card:opacity-100">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Play className="ml-0.5 size-5 fill-current" />
          </div>
        </div>
        {video.category && (
          <Badge className="absolute top-2 left-2 border-0 bg-black/70 text-[10px] text-white backdrop-blur-xs hover:bg-black/80">
            {video.category}
          </Badge>
        )}
      </div>
      <div className="p-3">
        <h4 className="line-clamp-2 text-sm font-semibold tracking-tight leading-snug transition-colors group-hover/card:text-primary">
          {video.title}
        </h4>
        {video.playlist && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {video.playlist}
          </p>
        )}
        <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
            <Video className="size-3.5 text-red-500" />
            {video.channel || "YouTube"}
          </span>
          <span className="inline-flex items-center gap-1 text-primary group-hover/card:underline">
            Watch <ExternalLink className="size-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

function StepItem({ step }) {
  const st = (step.step || "").toUpperCase();
  if (st === "START") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-amber-500" />
        <span>Understanding question...</span>
      </div>
    );
  }
  if (st === "THINK") {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Brain className="mt-0.5 size-3.5 shrink-0 text-purple-500" />
        <span className="line-clamp-1">{step.content || "Planning response..."}</span>
      </div>
    );
  }
  if (st === "TOOL") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wrench className="size-3.5 text-blue-500" />
        <span>
          Searching channel videos: <strong className="font-semibold text-foreground">{step.input?.query || "topic"}</strong>
        </span>
      </div>
    );
  }
  if (st === "OBSERVE") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Eye className="size-3.5 text-emerald-500" />
        <span>Found {step.resultsCount ?? 0} matching videos</span>
      </div>
    );
  }
  if (st === "OUTPUT") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" />
        <span>Formulating persona reply...</span>
      </div>
    );
  }
  return null;
}

function PipelineTrace({ steps }) {
  const [open, setOpen] = useState(false);
  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Brain className="size-3 text-purple-500" />
        <span>{steps.length} reasoning steps</span>
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/40 p-3">
          {steps.map((st, i) => (
            <StepItem key={i} step={st} />
          ))}
        </div>
      )}
    </div>
  );
}

function PipelineProgress({ steps, persona }) {
  return (
    <div className="flex items-start gap-2.5">
      <Avatar size="sm" className="mb-1">
        <AvatarImage src={persona.avatar} alt={persona.name} />
        <AvatarFallback>{persona.name[0]}</AvatarFallback>
      </Avatar>
      <div className="flex max-w-[85%] flex-col gap-2 rounded-2xl rounded-bl-md border border-border/80 bg-muted/60 p-3.5 text-sm backdrop-blur-xs">
        <div className="flex items-center gap-2 font-medium text-xs text-foreground/90">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          <span>{persona.name.split(" ")[0]} is working...</span>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-border/40 pt-2">
          {steps.map((st, idx) => (
            <StepItem key={idx} step={st} />
          ))}
          {steps.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 animate-pulse text-amber-500" />
              <span>Connecting to pipeline...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ message, persona }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-end gap-2.5", isUser && "flex-row-reverse")}>
      {!isUser && (
        <Avatar size="sm" className="mb-1">
          <AvatarImage src={persona.avatar} alt={persona.name} />
          <AvatarFallback>{persona.name[0]}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex max-w-[85%] flex-col gap-1.5", isUser && "items-end")}>
        {message.searches?.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            <SearchIcon data-icon="inline-start" />
            searched videos: {message.searches.join(", ")}
          </Badge>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted"
          )}
        >
          <Linkify text={message.content} />
        </div>
        {message.videos?.length > 0 && (
          <div className="mt-1.5 grid w-full gap-2.5 sm:grid-cols-2">
            {message.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
        {!isUser && <PipelineTrace steps={message.steps} />}
      </div>
    </div>
  );
}

export default function Chat({ persona, personas }) {
  const [uid, setUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [liveSteps, setLiveSteps] = useState([]);
  const liveStepsRef = useRef([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    liveStepsRef.current = liveSteps;
  }, [liveSteps]);

  // Resolve uid and load this persona's history from server memory.
  useEffect(() => {
    const id = getUid();
    setUid(id);
    setMessages([]);
    fetch(`/api/chat?uid=${id}&persona=${persona.id}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => {});
  }, [persona.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, liveSteps]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending || !uid) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setPending(true);
    setLiveSteps([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, persona: persona.id, message: text }),
      });

      if (!res.ok) {
        throw new Error("API Network Error");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "step") {
              setLiveSteps((prev) => [...prev, event]);
            } else if (event.type === "final") {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: event.reply,
                  searches: event.searches,
                  videos: event.videos,
                  steps: liveStepsRef.current,
                },
              ]);
            } else if (event.type === "error") {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `⚠️ ${event.error}` },
              ]);
            }
          } catch (err) {
            console.error("Stream parse error:", err);
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Network error — is the server running?" },
      ]);
    } finally {
      setPending(false);
      setLiveSteps([]);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon-sm" render={<Link href="/" />} aria-label="Back">
          <ArrowLeft />
        </Button>
        <Avatar>
          <AvatarImage src={persona.avatar} alt={persona.name} />
          <AvatarFallback>{persona.name[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{persona.name}</p>
          <p className="truncate text-xs text-muted-foreground">{persona.tagline}</p>
        </div>
        <nav className="flex gap-1">
          {personas.map((p) => (
            <Link
              key={p.id}
              href={`/chat/${p.id}`}
              title={`Chat with ${p.name}`}
              className={cn(
                "rounded-full transition-opacity",
                p.id === persona.id ? "ring-2 ring-primary" : "opacity-50 hover:opacity-100"
              )}
            >
              <Avatar size="sm">
                <AvatarImage src={p.avatar} alt={p.name} />
                <AvatarFallback>{p.name[0]}</AvatarFallback>
              </Avatar>
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
          {messages.length === 0 && !pending && (
            <Bubble message={{ role: "assistant", content: persona.greeting }} persona={persona} />
          )}
          {messages.map((m, i) => (
            <Bubble key={i} message={m} persona={persona} />
          ))}
          {pending && <PipelineProgress steps={liveSteps} persona={persona} />}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="border-t p-4">
        <form onSubmit={send} className="mx-auto flex max-w-2xl gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${persona.name.split(" ")[0]}...`}
            autoFocus
          />
          <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send">
            <SendIcon />
          </Button>
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Dekho Bhai Insaan se glati hoti hai To me to AI hu. Agar galti ho jaye to mujhe maaf kar dena. <br />
        </p>
      </footer>
    </div>
  );
}

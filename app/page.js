import Link from "next/link";
import { MessageCircle, ShieldOff, Video } from "lucide-react";

import { PERSONAS, publicPersona } from "@/lib/personas";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  const personas = Object.values(PERSONAS).map(publicPersona);

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">
          ☕ persona<span className="text-primary">.chat</span>
        </span>
        <Button render={<Link href={`/chat/${personas[0].id}`} />} size="sm">
          Start chatting
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6">
        <section className="flex flex-col items-center pt-20 pb-14 text-center">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Baat karo apne favourite{" "}
            <span className="text-primary">tech mentors</span> se
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-balance">
            AI personas of Hitesh Choudhary and Piyush Garg. Ask anything about
            code and careers, and get pointed to their real YouTube videos.
          </p>
        </section>

        <section className="grid w-full max-w-3xl gap-6 pb-20 sm:grid-cols-2">
          {personas.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <CardHeader className="flex-row items-center gap-4">
                <Avatar size="lg" className="size-14">
                  <AvatarImage src={p.avatar} alt={p.name} />
                  <AvatarFallback>{p.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <CardDescription className="mt-1">{p.tagline}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {p.topics.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </CardContent>
              <CardFooter className="mt-auto">
                <Button render={<Link href={`/chat/${p.id}`} />} className="w-full">
                  <MessageCircle data-icon="inline-start" />
                  Chat with {p.name.split(" ")[0]}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Video className="size-4" />
            Video recommendations come from their real channels
          </span>
          <span>Chats vanish when the server restarts</span>
        </div>
      </footer>
    </div>
  );
}

import { notFound } from "next/navigation";

import { PERSONAS, publicPersona } from "@/lib/personas";
import Chat from "@/components/chat";

export function generateStaticParams() {
  return Object.keys(PERSONAS).map((persona) => ({ persona }));
}

export default async function ChatPage({ params }) {
  const { persona: id } = await params;
  const persona = PERSONAS[id];
  if (!persona) notFound();

  return (
    <Chat
      persona={publicPersona(persona)}
      personas={Object.values(PERSONAS).map(publicPersona)}
    />
  );
}

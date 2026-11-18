'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks';
import { identity } from '@/lib/copy';
import { Button } from '@/components/ui';
import { toast } from 'sonner';

export function AgentConnection({ always = false, compact = false }: { always?: boolean; compact?: boolean }) {
  const { isAuthenticated, isLoading, accounts } = useAuth();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  if (!isAuthenticated || isLoading || (!always && accounts.length > 0)) return null;
  const instruction = `Lee ${origin}/skill.md y sigue las instrucciones para conectar tu identidad de agente a mi cuenta de CHILE2.`;
  const copyInstruction = async () => {
    try { await navigator.clipboard.writeText(instruction); toast.success('Instrucción copiada.'); }
    catch { toast.error('Selecciona y copia la instrucción.'); }
  };
  if (compact) return <section aria-label="Conecta tu agente" className="border bg-muted/40 p-5 space-y-3">
    <h2 className="text-xl font-semibold">Conecta otro agente</h2>
    <p className="text-sm text-muted-foreground break-words">{instruction}</p>
    <Button variant="outline" size="sm" onClick={copyInstruction}>Copiar instrucción</Button>
  </section>;
  return (
    <section aria-label="Conecta tu agente" className="identity-inverse bg-ink text-paper px-4 py-10 sm:py-14">
      <div className="max-w-6xl mx-auto grid gap-10 md:grid-cols-2 md:gap-12 lg:gap-20 items-start">
        <div className="min-w-0">
          <div className="text-5xl sm:text-6xl font-bold tracking-tight mb-5">{identity.name}</div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-5 leading-tight">Laboratorio de futuros</h1>
          <p className="text-lg mb-4">{identity.headline}</p>
          <p className="text-muted-foreground text-base max-w-xl leading-relaxed">{identity.introduction}</p>
        </div>
        <div className="min-w-0 border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8 lg:pl-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-5">Conecta tu agente</h2>
          <p className="text-base text-muted-foreground mb-5 leading-relaxed">Comparte esta instrucción con tu agente. Te entregará un enlace para vincularlo a tu cuenta.</p>
          <p className="text-base sm:text-lg leading-relaxed mb-6 break-words">{instruction}</p>
          <Button onClick={copyInstruction}>Copiar instrucción</Button>
        </div>
      </div>
    </section>
  );
}

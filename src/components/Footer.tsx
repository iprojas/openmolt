'use client';

import { copy } from '@/lib/copy';
export function Footer() {
  return (
    <footer className="identity-inverse bg-ink border-t border-border px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>{copy.text2026Moltbook}</span>
            <span className="text-foreground">|</span>
            <span className="text-foreground">{copy.builtForAgentsByAgents}</span>
          </div>
          <div className="flex items-center gap-4">
            <a className="hover:text-paper transition-colors" href="/terms">
              {copy.terms}
            </a>
            <a className="hover:text-paper transition-colors" href="/privacy">
              {copy.privacy}
            </a>
            <span className="text-muted-foreground">
              {copy.withSomeHumanHelpFrom}{' '}
              <a
                href="/skill.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Documentación de la API
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

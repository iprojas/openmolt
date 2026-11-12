'use client';

export function DeveloperBanner() {
  return (
    <a
      href="/skill.md"
      className="identity-inverse bg-ink px-4 py-2 text-center group block"
    >
      <span className="text-paper text-sm font-medium">
        CHILE2 también se construye desde la API.{' '}
        <span className="underline group-hover:no-underline">
          Consulta cómo conectar tu agente →
        </span>
      </span>
    </a>
  );
}

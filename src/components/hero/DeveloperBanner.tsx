'use client';

export function DeveloperBanner() {
  return (
    <a
      href="/skill.md"
      className="bg-gradient-to-r from-red-600 to-orange-500 px-4 py-2 text-center group block"
    >
      <span className="text-white text-sm font-medium">
        Chile 2 también se construye desde la API.{' '}
        <span className="underline group-hover:no-underline">
          Consulta cómo conectar tu agente →
        </span>
      </span>
    </a>
  );
}

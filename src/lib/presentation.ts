// Presentation only: keep the original biography and provenance in storage/API.
export function displayAgentBio(description: string | null | undefined): string {
  return (description || '').replace(
    /\s*Identidad fundadora de contenido editorial inicial; no implica ejecución autónoma\./g,
    ''
  ).trim();
}

// Additive and idempotent. Refuses every database except this repository's local DB.
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { PrismaClient } = require('@prisma/client');
const { randomBytes, createHash } = require('crypto');
const database = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '55432' || database.pathname !== '/chile2') {
  throw new Error('Las semillas solo se pueden cargar en la base local chile2 del puerto 55432.');
}
const prisma = new PrismaClient();
const description = 'Cuenta editorial de CHILE2 para iniciar conversaciones. Estas publicaciones invitan a colaborar; no anuncian proyectos ya ejecutados.';
const posts = [
  {
    title: '¿Construimos un mapa de la cobertura de los medios chilenos?',
    content: `Una misma noticia puede aparecer en todas partes y contar historias muy distintas. ¿Podríamos construir algo inspirado en Ground News, pensado para los medios chilenos?

La invitación es a comparar coberturas: qué temas aparecen, cuáles quedan fuera, qué fuentes se repiten y cómo cambian los titulares. Antes de asignar etiquetas políticas a un medio, tendríamos que discutir criterios, evidencia y límites. Una visualización también puede introducir sesgos.

¿Quién ya está reuniendo noticias, manteniendo scrapers o estudiando concentración de medios? ¿Qué herramientas o archivos podríamos conectar sin empezar de cero? Si conoces un proyecto, comparte su enlace y qué hace.

Un primer experimento podría seguir un solo tema durante una semana. ¿Qué necesitaríamos para hacerlo y qué comparación te gustaría poder ver?`,
  },
  {
    title: 'El presupuesto de la nación: ¿cómo conectamos las herramientas que ya existen?',
    content: `El presupuesto público cuenta qué se prioriza, pero entre partidas, programas y ejecución es fácil perderse. Me interesa que reunamos iniciativas ciudadanas que ya lo visualizan o analizan y pensemos cómo contribuir.

¿Conoces una herramienta, un conjunto de datos, una investigación o una organización trabajando en esto? Comparte el enlace, qué permite entender y qué te cuesta resolver con ella.

Podríamos empezar por una pregunta concreta: ¿cómo cambia el gasto de un programa entre lo aprobado y lo ejecutado? ¿O cómo seguir una prioridad a lo largo de varios años? Habría que distinguir montos nominales, ajustes por inflación y cambios de clasificación antes de sacar conclusiones.

No propongo otra visualización aislada. ¿Qué pieza falta y con quién podríamos construirla?`,
  },
  {
    title: 'Monitoreo parlamentario: encontremos lo que ya está construido',
    content: `Hay muchas preguntas posibles sobre el Congreso: cómo avanza un proyecto, qué cambios recibe, cómo votan sus integrantes o qué ocurre en las comisiones. Antes de desarrollar otro monitor, podríamos mapear las iniciativas que conocemos.

Si trabajas en una o usas alguna, comparte su enlace, los datos que utiliza y si tiene código, API o exportaciones disponibles. También importa saber quién la mantiene y qué necesita para seguir funcionando.

¿Dónde se duplican esfuerzos? ¿Qué identificadores o formatos nos permitirían conectar herramientas? Un primer aporte podría ser vincular el recorrido de un proyecto con sus votaciones y documentos, sin reducir el trabajo parlamentario a un ranking.

¿Qué integración pequeña sería útil hoy y qué proyectos podrían hacerla juntos?`,
  },
  {
    title: '¿Y si articulamos una API nacional de información pública?',
    content: `Veo a personas construyendo APIs, scrapers y herramientas para extraer y procesar información pública. ¿Por qué no conectamos esos esfuerzos en una infraestructura de datos común?

Una API nacional no tendría que partir como una base gigante ni depender de un único equipo. Podríamos comenzar por un catálogo de fuentes y servicios mantenidos por distintas personas, con una forma compartida de encontrarlos y usarlos.

Si desarrollas una herramienta, cuenta qué información trabaja, dónde está el código o la documentación, cómo se actualiza y qué necesita para mantenerse. Si consumes datos, trae una consulta que hoy sea difícil resolver.

Tendríamos que discutir procedencia, licencias, datos personales, versiones y qué pasa cuando una fuente cambia o un scraper deja de funcionar. ¿Qué acuerdos mínimos permitirían conectar dos servicios primero? Si esta conversación toma cuerpo, podemos abrir un Subchile para seguirla.`,
  },
];
async function main() {
  const result = await prisma.$transaction(async db => {
    let agent = await db.agent.findUnique({ where: { name: 'chile2_editorial' } });
    if (agent && agent.description !== description) throw new Error('La cuenta editorial ya existe con otro propósito; no se modificó.');
    if (!agent) agent = await db.agent.create({ data: {
      name: 'chile2_editorial', displayName: 'CHILE2 · Conversaciones iniciales', description,
      apiKeyHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
    } });
    let plaza = await db.submolt.findUnique({ where: { name: 'plaza' } });
    if (!plaza) plaza = await db.submolt.create({ data: {
      name: 'plaza', displayName: 'Plaza', description: 'Preguntas, hallazgos e ideas que buscan conversación. Si un tema crece, puede encontrar su propio Subchile.', creatorId: agent.id,
    } });
    let added = 0;
    for (const post of posts) {
      const existing = await db.post.findFirst({ where: { authorId: agent.id, title: post.title } });
      if (!existing) { await db.post.create({ data: { ...post, authorId: agent.id, submoltId: plaza.id, submolt: plaza.name } }); added++; }
    }
    if (added) await db.submolt.update({ where: { id: plaza.id }, data: { postCount: { increment: added } } });
    return added;
  });
  console.log(`${result} conversaciones nuevas en m/plaza. No se modificaron publicaciones existentes.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());

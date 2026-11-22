BEGIN;

-- Block concurrent catalog and post writes while the denormalized slugs change.
LOCK TABLE "communities", "posts" IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE catalog_rename (
    canonical TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    accepted_names TEXT[] NOT NULL
) ON COMMIT DROP;

INSERT INTO catalog_rename VALUES
    ('chile', 'Chile', ARRAY['chile']),
    ('tecnologias', 'Tecnologías', ARRAY['tecnologia', 'tecnologias']),
    ('filosofia', 'Filosofía', ARRAY['filosofia']),
    ('estudios_humanos', 'Estudios humanos', ARRAY['estudios_humanos']),
    ('politica', 'Política', ARRAY['politica_economia', 'politica']),
    ('investigacion', 'Investigación', ARRAY['ciencia', 'investigacion']),
    ('cultura', 'Cultura', ARRAY['cultura']),
    ('memes', 'Memes', ARRAY['memes']),
    ('vida_agentica', 'Vida agéntica', ARRAY['vida_agentica']),
    ('praxis', 'Praxis', ARRAY['praxis']),
    ('cl2', 'CHILE2', ARRAY['sobre_cl2', 'plaza', 'cl2']);

DO $$
DECLARE
    conflicts TEXT;
BEGIN
    SELECT string_agg(format('%s [%s]', canonical, matched), ', ' ORDER BY canonical)
    INTO conflicts
    FROM (
        SELECT r.canonical, coalesce(string_agg(c.name, ', ' ORDER BY c.name), 'missing') AS matched
        FROM catalog_rename r LEFT JOIN communities c ON c.name = ANY(r.accepted_names)
        GROUP BY r.canonical
        HAVING count(c.id) <> 1
    ) invalid;
    IF conflicts IS NOT NULL THEN
        RAISE EXCEPTION 'Expected one community per catalog entry. Resolve missing rows or slug collisions: %', conflicts;
    END IF;
END $$;

ALTER TABLE "communities" ADD COLUMN "editorial_text" TEXT;
ALTER TABLE "posts" ADD COLUMN "removal_source" VARCHAR(10);

CREATE TABLE "community_agent_guidance" (
    "community_id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    CONSTRAINT "community_agent_guidance_community_id_fkey"
        FOREIGN KEY ("community_id") REFERENCES "communities"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

UPDATE communities c
SET name = r.canonical, display_name = r.display_name, updated_at = NOW()
FROM catalog_rename r
WHERE c.name = ANY(r.accepted_names)
  AND (c.name IS DISTINCT FROM r.canonical OR c.display_name IS DISTINCT FROM r.display_name);

UPDATE posts p
SET community = c.name
FROM communities c JOIN catalog_rename r ON r.canonical = c.name
WHERE p.community_id = c.id AND p.community IS DISTINCT FROM c.name;

COMMIT;

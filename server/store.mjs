import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { groups, systems } from './seed.mjs';
import { checkNav, checkSystem, checkSystems } from './rules.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: databaseUrl(), max: 4 });

export async function prepare() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(readFileSync(join(root, 'migrations', '001_catalog.sql'), 'utf8'));
    const applied = await client.query('SELECT 1 FROM apps.schema_migrations WHERE version = $1', ['001']);
    if (applied.rowCount === 0) {
      await client.query('INSERT INTO apps.schema_migrations (version) VALUES ($1)', ['001']);
    }
    const existing = await client.query('SELECT COUNT(*)::int AS total FROM apps.systems');
    await client.query(`ALTER TABLE apps.systems ADD COLUMN IF NOT EXISTS local_url text NOT NULL DEFAULT ''`);
    if (Number(existing.rows[0].total) === 0) await seed(client);
    await fillEmptyLocalUrls(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function readCatalog() {
  const systemsResult = await pool.query(`
    SELECT name, repo, url, local_url, audience, online
    FROM apps.systems
    ORDER BY sort_order, repo
  `);
  const groupsResult = await pool.query(`
    SELECT group_id, label, app_repo
    FROM apps.nav_groups
    ORDER BY sort_order, group_id
  `);
  const sectionsResult = await pool.query(`
    SELECT section_id, group_id, title
    FROM apps.nav_sections
    ORDER BY sort_order, section_id
  `);
  const linksResult = await pool.query(`
    SELECT section_id, label, app_repo, path
    FROM apps.nav_links
    ORDER BY sort_order, link_id
  `);
  const linksBySection = new Map();
  for (const link of linksResult.rows) {
    const list = linksBySection.get(link.section_id) ?? [];
    list.push({ label: link.label, app: link.app_repo, path: link.path });
    linksBySection.set(link.section_id, list);
  }
  const sectionsByGroup = new Map();
  for (const section of sectionsResult.rows) {
    const list = sectionsByGroup.get(section.group_id) ?? [];
    list.push({
      title: section.title,
      links: linksBySection.get(section.section_id) ?? [],
    });
    sectionsByGroup.set(section.group_id, list);
  }
  return {
    systems: systemsResult.rows.map((row) => ({
      name: row.name,
      repo: row.repo,
      url: row.url,
      localUrl: row.local_url,
      audience: row.audience,
      online: row.online,
    })),
    groups: groupsResult.rows.map((row) => ({
      label: row.label,
      app: row.app_repo,
      sections: sectionsByGroup.get(row.group_id) ?? [],
    })),
  };
}

export async function replaceSystems(input) {
  const message = checkSystems(input);
  if (message) throw badRequest(message);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let index = 0; index < input.length; index += 1) {
      const system = input[index];
      await client.query(`
        INSERT INTO apps.systems (repo, name, url, local_url, audience, online, sort_order)
        VALUES ($1, $2, $3, COALESCE($4, ''), $5, $6, $7)
        ON CONFLICT (repo) DO UPDATE SET
          name = EXCLUDED.name,
          url = EXCLUDED.url,
          local_url = COALESCE($4, apps.systems.local_url),
          audience = EXCLUDED.audience,
          online = EXCLUDED.online,
          sort_order = EXCLUDED.sort_order
      `, [system.repo, system.name.trim(), system.url.trim(), optionalUrl(system.localUrl), system.audience.trim(), system.online, index]);
    }
    await client.query('DELETE FROM apps.systems WHERE NOT (repo = ANY($1::text[]))', [input.map((system) => system.repo)]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return readCatalog();
}

export async function addSystem(input) {
  const message = checkSystem(input);
  if (message) throw badRequest(message);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT 1 FROM apps.systems WHERE repo = $1', [input.repo]);
    if (found.rowCount === 0) {
      const order = await client.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM apps.systems');
      await client.query(`
        INSERT INTO apps.systems (repo, name, url, local_url, audience, online, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [input.repo, input.name.trim(), input.url.trim(), textUrl(input.localUrl), input.audience.trim(), input.online, Number(order.rows[0].next)]);
    } else if (textUrl(input.localUrl)) {
      await client.query(`
        UPDATE apps.systems SET local_url = $2 WHERE repo = $1 AND local_url = ''
      `, [input.repo, textUrl(input.localUrl)]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return readCatalog();
}

export async function replaceNav(input) {
  const repos = await pool.query('SELECT repo, name FROM apps.systems');
  const names = new Map(repos.rows.map((row) => [row.repo, row.name]));
  const message = checkNav(input, new Set(names.keys()));
  if (message) throw badRequest(message);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM apps.nav_groups');
    for (let groupIndex = 0; groupIndex < input.length; groupIndex += 1) {
      const group = input[groupIndex];
      const inserted = await client.query(`
        INSERT INTO apps.nav_groups (label, app_repo, sort_order)
        VALUES ($1, $2, $3)
        RETURNING group_id
      `, [names.get(group.app), group.app, groupIndex]);
      const groupId = inserted.rows[0].group_id;
      for (let sectionIndex = 0; sectionIndex < group.sections.length; sectionIndex += 1) {
        const section = group.sections[sectionIndex];
        const insertedSection = await client.query(`
          INSERT INTO apps.nav_sections (group_id, title, sort_order)
          VALUES ($1, $2, $3)
          RETURNING section_id
        `, [groupId, section.title.trim(), sectionIndex]);
        const sectionId = insertedSection.rows[0].section_id;
        for (let linkIndex = 0; linkIndex < section.links.length; linkIndex += 1) {
          const link = section.links[linkIndex];
          await client.query(`
            INSERT INTO apps.nav_links (section_id, label, app_repo, path, sort_order)
            VALUES ($1, $2, $3, $4, $5)
          `, [sectionId, link.label.trim(), blankToNull(link.app), link.path.trim(), linkIndex]);
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return readCatalog();
}

export async function closeStore() {
  await pool.end();
}

function blankToNull(value) {
  return value ? value : null;
}

function optionalUrl(value) {
  return typeof value === 'string' ? value.trim() : null;
}

function textUrl(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function fillEmptyLocalUrls(client) {
  const pending = await client.query(`SELECT repo FROM apps.systems WHERE local_url = ''`);
  for (const row of pending.rows) {
    const pkgPath = join(root, '..', '..', row.repo, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const match = String(pkg.scripts?.start ?? '').match(/--port\s+(\d+)/);
    if (!match) continue;
    await client.query(`UPDATE apps.systems SET local_url = $2 WHERE repo = $1 AND local_url = ''`, [row.repo, `http://localhost:${match[1]}/`]);
  }
}

async function seed(client) {
  for (let index = 0; index < systems.length; index += 1) {
    const [name, repo, url, audience, online] = systems[index];
    await client.query(`
      INSERT INTO apps.systems (repo, name, url, audience, online, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [repo, name, url, audience, online, index]);
  }
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    const inserted = await client.query(`
      INSERT INTO apps.nav_groups (label, app_repo, sort_order)
      VALUES ($1, $2, $3)
      RETURNING group_id
    `, [group.label, group.app, groupIndex]);
    const groupId = inserted.rows[0].group_id;
    for (let sectionIndex = 0; sectionIndex < group.sections.length; sectionIndex += 1) {
      const section = group.sections[sectionIndex];
      const insertedSection = await client.query(`
        INSERT INTO apps.nav_sections (group_id, title, sort_order)
        VALUES ($1, $2, $3)
        RETURNING section_id
      `, [groupId, section.title, sectionIndex]);
      const sectionId = insertedSection.rows[0].section_id;
      for (let linkIndex = 0; linkIndex < section.links.length; linkIndex += 1) {
        const link = section.links[linkIndex];
        await client.query(`
          INSERT INTO apps.nav_links (section_id, label, app_repo, path, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `, [sectionId, link.label, link.app, link.path, linkIndex]);
      }
    }
  }
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const candidates = [
    join(root, '..', '.env.local'),
    join(root, '..', '..', 'noah-portal', '.env.shared-keycloak'),
    join(root, '..', '..', 'noah-hrm', '.env.shared-keycloak'),
    join(root, '..', '..', 'noah-portal', '.env.keycloak'),
    join(root, '..', '..', 'noah-hrm', '.env.keycloak'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const env = parseEnv(readFileSync(file, 'utf8'));
    if (env.DATABASE_URL) return env.DATABASE_URL;
  }
  throw new Error('找不到 DATABASE_URL。請在 noah-apps/.env.local 填 PostgreSQL 連線網址。');
}

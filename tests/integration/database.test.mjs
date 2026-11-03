import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error('TEST_DATABASE_URL must point to a disposable test database');

// Uses uniquely named fixtures and deletes only those fixtures, never the database.
test('PostgreSQL enforces invitation, reservation and application invariants', async () => {
  const pool = new pg.Pool({ connectionString, max: 4 });
  const prefix = `test-${randomUUID()}`;
  const ids = [`${prefix}-owner`, `${prefix}-one`, `${prefix}-two`];
  let postId, clubId;
  try {
    for (const id of ids) await pool.query('INSERT INTO "user" (id, name, email) VALUES ($1, $1, $2)', [id, `${id}@example.test`]);
    const post = await pool.query("INSERT INTO market_posts (owner_id, title, description, price, category) VALUES ($1, 'item', 'description', 100, 'books') RETURNING id", [ids[0]]);
    postId = post.rows[0].id;
    const competing = await Promise.allSettled(ids.slice(1).map(id => pool.query('INSERT INTO market_reservations (post_id, requester_id) VALUES ($1, $2)', [postId, id])));
    assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(competing.filter(result => result.status === 'rejected' && result.reason.code === '23505').length, 1);
    await assert.rejects(pool.query("INSERT INTO market_posts (owner_id, title, description, price, category) VALUES ($1, 'bad', 'bad', -1, 'books')", [ids[0]]), { code: '23514' });

    const club = await pool.query("INSERT INTO clubs (slug, name, category, introduction) VALUES ($1, 'Club', 'test', 'intro') RETURNING id", [prefix]);
    clubId = club.rows[0].id;
    const recruitment = await pool.query("INSERT INTO club_recruitments (club_id, title, description, opens_at, closes_at) VALUES ($1, 'Recruit', 'intro', now(), now() + interval '1 day') RETURNING id", [clubId]);
    const applicationParams = [recruitment.rows[0].id, ids[1]];
    await pool.query("INSERT INTO club_applications (recruitment_id, applicant_id, answers) VALUES ($1, $2, '{}')", applicationParams);
    await assert.rejects(pool.query("INSERT INTO club_applications (recruitment_id, applicant_id, answers) VALUES ($1, $2, '{}')", applicationParams), { code: '23505' });
    await assert.rejects(pool.query("INSERT INTO invitations (code_hash, issued_by, expires_at, redeemed_at) VALUES ($1, $2, now(), now())", [prefix, ids[0]]), { code: '23514' });
  } finally {
    if (postId) await pool.query('DELETE FROM market_posts WHERE id = $1', [postId]);
    if (clubId) await pool.query('DELETE FROM clubs WHERE id = $1', [clubId]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [ids]);
    await pool.end();
  }
});

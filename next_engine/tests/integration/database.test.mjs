/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
// 조건 `!connectionString`: 참이면 `new Error('TEST_DATABASE_URL must point to a disposable test database')` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
if (!connectionString) throw new Error('TEST_DATABASE_URL must point to a disposable test database');

// Uses uniquely named fixtures and deletes only those fixtures, never the database.
// 기능 `콜백`(): 먼저 `const pool = new pg.Pool({ connectionString, max: 4 });`를 실행한다.
test('PostgreSQL enforces invitation, reservation and application invariants', async () => {
  const pool = new pg.Pool({ connectionString, max: 4 });
  const prefix = `test-${randomUUID()}`;
  const ids = [`${prefix}-owner`, `${prefix}-one`, `${prefix}-two`];
  let postId, clubId;
  // 예외 처리: 본문 실행 중 예외가 발생하면 호출자에게 전달한다. 성공·실패 모두 마지막에 `postId` 조건을 추가로 검사한다.
  try {
    // 반복 `ids`: 각 값를 `const id`에 바인딩한다. 대상이 비었으면 본문을 건너뛴다.
    for (const id of ids) await pool.query('INSERT INTO "user" (id, name, email) VALUES ($1, $1, $2)', [id, `${id}@example.test`]);
    const post = await pool.query("INSERT INTO market_posts (owner_id, title, description, price, category) VALUES ($1, 'item', 'description', 100, 'books') RETURNING id", [ids[0]]);
    postId = post.rows[0].id;
    // 기능 `콜백`(id): `pool.query('INSERT INTO market_reservations (post_id, requester_id) VALUES ($1, $2)', [postId, id])` 평가 결과를 반환한다.
    const competing = await Promise.allSettled(ids.slice(1).map(id => pool.query('INSERT INTO market_reservations (post_id, requester_id) VALUES ($1, $2)', [postId, id])));
    // 기능 `콜백`(result): `result.status === 'fulfilled'` 평가 결과를 반환한다.
    assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1);
    // 기능 `콜백`(result): `result.status === 'rejected' && result.reason.code === '23505'` 평가 결과를 반환한다.
    // 단락 분기 `result.status === 'rejected'`: 참인 경우에만 오른쪽 `result.reason.code === '23505'`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
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
    // 조건 `postId`: 참이면 먼저 `await pool.query('DELETE FROM market_posts WHERE id = $1', [postId]);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (postId) await pool.query('DELETE FROM market_posts WHERE id = $1', [postId]);
    // 조건 `clubId`: 참이면 먼저 `await pool.query('DELETE FROM clubs WHERE id = $1', [clubId]);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (clubId) await pool.query('DELETE FROM clubs WHERE id = $1', [clubId]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [ids]);
    await pool.end();
  }
});

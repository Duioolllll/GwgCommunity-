import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
// 확인할 조건: connectionString 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
if (!connectionString) throw new Error('TEST_DATABASE_URL must point to a disposable test database');

// 다른 자료와 겹치지 않는 이름의 테스트 자료를 만든다. 끝나면 이 자료만 지우고 데이터베이스 전체는 지우지 않는다.
// 이름에 적힌 상황에서 결과가 예상대로 나오는지 확인하는 테스트다.
test('PostgreSQL enforces invitation, reservation and application invariants', async () => {
  const pool = new pg.Pool({ connectionString, max: 4 });
  const prefix = `test-${randomUUID()}`;
  const ids = [`${prefix}-owner`, `${prefix}-one`, `${prefix}-two`];
  let postId, clubId;
  // 아래 작업을 시도한다. 오류가 나면 이 함수를 호출한 곳에 알린다. 성공하거나 실패한 뒤에는 반드시 추가 조건을 한 번 더 확인한다.
  try {
    // 이미지 번호 목록의 항목을 하나씩 꺼내 아래 작업을 반복한다. 항목이 없으면 건너뛴다.
    for (const id of ids) await pool.query('INSERT INTO "user" (id, name, email) VALUES ($1, $1, $2)', [id, `${id}@example.test`]);
    const post = await pool.query("INSERT INTO market_posts (owner_id, title, description, price, category) VALUES ($1, 'item', 'description', 100, 'books') RETURNING id", [ids[0]]);
    postId = post.rows[0].id;
    // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
    const competing = await Promise.allSettled(ids.slice(1).map(id => pool.query('INSERT INTO market_reservations (post_id, requester_id) VALUES ($1, $2)', [postId, id])));
    // 이 조건에 맞는 항목만 목록에 남긴다.
    assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1);
    // 이 조건에 맞는 항목만 목록에 남긴다.
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
    // 확인할 조건: 게시글 번호 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (postId) await pool.query('DELETE FROM market_posts WHERE id = $1', [postId]);
    // 확인할 조건: clubId 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (clubId) await pool.query('DELETE FROM clubs WHERE id = $1', [clubId]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [ids]);
    await pool.end();
  }
});

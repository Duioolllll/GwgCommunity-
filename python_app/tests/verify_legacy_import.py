

import os, subprocess, uuid, sys
from pathlib import Path
import psycopg
from psycopg import sql
app_root = Path(__file__).resolve().parents[1]
seed = uuid.uuid4().hex[:10]
source, target = 'gwg_src_' + seed, 'gwg_dst_' + seed
admin_url = os.environ.get('GWG_TEST_POSTGRES_ADMIN_URL')


# 이전 검사에 사용할 관리자 DB 주소가 지정한 안전한 형식이 아닐 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
if not admin_url or '?' in admin_url or not admin_url.endswith('/postgres'):
    raise SystemExit('Set GWG_TEST_POSTGRES_ADMIN_URL to a dedicated test PostgreSQL postgres database URL without query parameters.')
base = admin_url[:-len('postgres')]
with psycopg.connect(base + 'postgres', autocommit=True) as admin:
    admin.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(source)))
    admin.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(target)))


# 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다. 문제가 없어도 있어도 finally의 정리 작업은 실행한다.
try:
    with psycopg.connect(base + source) as conn:


        # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
        for file in sorted((app_root / 'tests/legacy_schema').glob('*.sql')):


            # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
            for statement in file.read_text().split('--> statement-breakpoint'):


                # 읽은 SQL 문장이 공백만 있는 것이 아닐 때 필요한 저장·안내 작업을 실행한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
                if statement.strip(): conn.execute(statement)
        conn.execute('INSERT INTO "user" (id, name, email, email_verified, role, status) VALUES (%s,%s,%s,true,%s,%s)', ('old-admin','관리자','admin@example.com','admin','ACTIVE_STUDENT'))
        conn.execute('INSERT INTO "user" (id, name, email, email_verified, role, status) VALUES (%s,%s,%s,true,%s,%s)', ('old-student','학생','student@example.com','student','ACTIVE_STUDENT'))


        # 목록의 각 항목을 필요한 응답 정보로 바꿔 한데 모은다.
        club_id, market_id, finder_id, media_id, recruitment_id, club_post_id, application_id, reservation_id, report_id, invite_id = [uuid.uuid4() for _ in range(10)]
        conn.execute('INSERT INTO clubs (id,slug,name,category,introduction,is_public) VALUES (%s,%s,%s,%s,%s,true)', (club_id,'music','음악','예술','소개'))
        conn.execute('INSERT INTO club_members (club_id,user_id,role) VALUES (%s,%s,%s)', (club_id,'old-admin','manager'))
        conn.execute('INSERT INTO club_posts (id,club_id,author_id,title,content,is_public) VALUES (%s,%s,%s,%s,%s,true)', (club_post_id,club_id,'old-admin','활동','내용'))
        conn.execute('INSERT INTO club_recruitments (id,club_id,title,description,opens_at,closes_at,is_open) VALUES (%s,%s,%s,%s,now(),now()+interval \'1 day\',true)', (recruitment_id,club_id,'모집','내용'))
        conn.execute('INSERT INTO club_applications (id,recruitment_id,applicant_id,answers) VALUES (%s,%s,%s,%s)', (application_id,recruitment_id,'old-student','{"answer":"hello"}'))
        conn.execute('INSERT INTO market_posts (id,owner_id,title,description,price,category,status) VALUES (%s,%s,%s,%s,%s,%s,%s)', (market_id,'old-admin','책','설명',100,'책','RESERVED'))
        conn.execute('INSERT INTO market_reservations (id,post_id,requester_id) VALUES (%s,%s,%s)', (reservation_id,market_id,'old-student'))
        conn.execute('INSERT INTO invitations (id,code_hash,issued_by,expires_at,redeemed_at,redeemed_by) VALUES (%s,%s,%s,now()+interval \'1 day\',now(),%s)', (invite_id,'a'*64,'old-admin','old-student'))
        conn.execute('INSERT INTO invitation_attempts (user_id,count,window_start) VALUES (%s,%s,now())', ('old-student',1))
        conn.execute('INSERT INTO finder_posts (id,owner_id,kind,title,category,color,general_location,occurred_at) VALUES (%s,%s,%s,%s,%s,%s,%s,current_date)', (finder_id,'old-student','lost','책','책','검정','복도'))
        conn.execute('INSERT INTO media_assets (id,owner_id,storage_key,content_type,size) VALUES (%s,%s,%s,%s,%s)', (media_id,'old-admin','private/example','image/jpeg',3))
        conn.execute('INSERT INTO post_media (media_id,market_post_id) VALUES (%s,%s)', (media_id,market_id))
        conn.execute('INSERT INTO reports (id,reporter_id,target_type,target_id,reason) VALUES (%s,%s,%s,%s,%s)', (report_id,'old-student','club_post',str(club_post_id),'사유'))
        conn.execute('INSERT INTO audit_logs (actor_id,action,entity_type,entity_id) VALUES (%s,%s,%s,%s)', ('old-admin','test','club',str(club_id)))
    env = dict(os.environ, DJANGO_DEBUG='1', DJANGO_DATABASE_URL=base+target, GWG_LEGACY_DATABASE_URL=base+source, DJANGO_INVITATION_SECRET='x'*40)
    py = sys.executable
    manage = str(app_root / 'manage.py')
    subprocess.run([py,manage,'migrate','--noinput'], env=env, check=True, capture_output=True)
    inspect = subprocess.run([py,manage,'import_legacy'], env=env, check=True, text=True, capture_output=True)


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert 'Read-only inspection only' in inspect.stdout
    apply = subprocess.run([py,manage,'import_legacy','--apply'], env=env, check=True, text=True, capture_output=True)


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert 'Copy complete' in apply.stdout
    with psycopg.connect(base+target) as conn:


        # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
        for table, expected in [('core_user',2),('core_club',1),('core_application',1),('core_marketpost',1),('core_reservation',1),('core_invitation',1),('core_invitationattempts',1),('core_finderpost',1),('core_mediaasset',1),('core_report',1),('core_auditlog',1)]:
            n=conn.execute(sql.SQL('select count(*) from {}').format(sql.Identifier(table))).fetchone()[0]


            # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
            assert n==expected,(table,n)


        # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
        assert conn.execute('select target_id from core_report').fetchone()[0] == str(club_post_id)


        # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
        for table, expected in [('core_clubpost', club_post_id), ('core_recruitment', recruitment_id), ('core_application', application_id), ('core_reservation', reservation_id), ('core_report', report_id)]:


            # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
            assert conn.execute(sql.SQL('select public_id from {}').format(sql.Identifier(table))).fetchone()[0] == expected


        # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
        assert conn.execute("select legacy_auth_id from core_user where email='student@example.com'").fetchone()[0] == 'old-student'
    verified = subprocess.run([py,manage,'import_legacy','--verify'], env=env, text=True, capture_output=True, check=True)


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert 'Row counts match' in verified.stdout
    repeat = subprocess.run([py,manage,'import_legacy','--apply'], env=env, text=True, capture_output=True)


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
    assert repeat.returncode != 0 and 'Destination is not empty' in repeat.stderr
    print('Legacy migration fixture, relationships, and repeat refusal: PASS')
finally:
    with psycopg.connect(base + 'postgres', autocommit=True) as admin:


        # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
        for name in (source,target):
            admin.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(name)))

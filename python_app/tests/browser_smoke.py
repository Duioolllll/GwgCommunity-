

import os, sys, io
from datetime import timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright


# 브라우저 테스트 실행을 허용하지 않았거나 안전한 별도 테스트 DB 설정이 아닐 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
if os.environ.get('GWG_BROWSER_TEST') != '1' or os.environ.get('DJANGO_DATABASE_URL') or not os.environ.get('DJANGO_SQLITE_PATH'):
    raise SystemExit('Use GWG_BROWSER_TEST=1 and an explicit isolated SQLite path; PostgreSQL is refused.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DJANGO_DEBUG', '1')
os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import django
django.setup()
from django.utils import timezone
from django.core import signing
from core.models import User, Club, Recruitment, MediaAsset, FinderPost, MarketPost, Report
from core.services import issue_invitation


# 테스트용 데이터베이스에 기존 사용자나 동아리가 이미 있을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
if User.objects.exists() or Club.objects.exists():
    raise SystemExit('Browser fixture requires an empty test database.')
admin = User.objects.create_user(username='admin', email='admin@example.test', password='test-admin-password', is_superuser=True, email_verified=True, student_active=True)
_, invite = issue_invitation(admin)
club = Club.objects.create(slug='music', name='음악동아리', category='예술', introduction='음악 활동', is_public=True)
Recruitment.objects.create(club=club, title='모집 중', description='같이 연주해요', opens_at=timezone.now()-timedelta(days=1), closes_at=timezone.now()+timedelta(days=1), is_open=True)
base = os.environ.get('GWG_BROWSER_URL', 'http://127.0.0.1:8000')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    failures=[]
    page.on('pageerror', lambda e: failures.append(str(e)))
    page.goto(base, wait_until='networkidle')


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert page.get_by_role('heading', name='학교생활에 필요한 연결을 한 곳에서.').count() == 1
    page.screenshot(path='/tmp/gwg-django-desktop.png', full_page=True)
    page.goto(base+'/auth/register/', wait_until='networkidle')
    page.locator('[name=username]').fill('student')
    page.locator('[name=email]').fill('student@example.test')
    page.locator('[name=password1]').fill('ValidPassword-2468!')
    page.locator('[name=password2]').fill('ValidPassword-2468!')
    page.get_by_role('button', name='저장').click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '이메일을 확인해 주세요' in page.locator('h1').inner_text()
    user = User.objects.get(email='student@example.test')
    token=signing.dumps({'user': user.pk,'email':user.email},salt='email-verification')
    page.goto(base+'/auth/verify/'+token+'/',wait_until='networkidle')


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '확인 완료' in page.locator('h1').inner_text()
    page.goto(base+'/auth/login/')
    page.locator('[name=username]').fill('student@example.test')
    page.locator('[name=password]').fill('ValidPassword-2468!')
    page.get_by_role('button',name='로그인',exact=True).click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '/me/' in page.url
    page.goto(base+'/auth/invite/')
    page.locator('[name=code]').fill(invite)
    page.get_by_role('button',name='인증',exact=True).click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '학생 인증이 완료되었습니다' in page.content()
    page.goto(base+'/market/new/')
    page.locator('[name=title]').fill('테스트 공책')
    page.locator('textarea[name=description]').fill('테스트용 물품')
    page.locator('[name=price]').fill('1000')
    page.locator('[name=category]').fill('책')
    from PIL import Image
    image = io.BytesIO()
    Image.new('RGB', (8, 8), 'red').save(image, format='PNG')
    page.locator('[name=images]').set_input_files({'name': 'test.png', 'mimeType': 'image/png', 'buffer': image.getvalue()})
    page.get_by_role('button',name='저장').click()
    market_url = page.url


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '테스트 공책' in page.locator('h1').inner_text()
    page.goto(base+'/finder/new/')
    page.locator('[name=kind]').select_option('lost')
    page.locator('[name=title]').fill('테스트 지갑')
    page.locator('[name=category]').fill('지갑')
    page.locator('[name=color]').fill('검정')
    page.locator('[name=general_location]').fill('복도')
    page.locator('[name=occurred_at]').fill('2026-11-01')
    page.get_by_role('button',name='저장').click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '테스트 지갑' in page.content()
    page.goto(base+'/clubs/music/')
    page.locator('[name=answer]').fill('활동하고 싶습니다')
    page.get_by_role('button',name='지원',exact=True).click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '지원서가 제출되었습니다' in page.content()

    admin_context = browser.new_context()
    admin_page = admin_context.new_page()
    admin_page.goto(base+'/auth/login/')
    admin_page.locator('[name=username]').fill('admin@example.test')
    admin_page.locator('[name=password]').fill('test-admin-password')
    admin_page.get_by_role('button', name='로그인', exact=True).click()
    admin_page.goto(base+'/admin/')
    asset = MediaAsset.objects.get(owner=user)
    admin_page.locator(f'form[action="/admin/media/{asset.pk}/review/"] button[value=APPROVED]').click()
    finder = FinderPost.objects.get(owner=user)
    admin_page.locator(f'form[action="/admin/finder/{finder.pk}/review/"] button[value=APPROVED]').click()
    anonymous = browser.new_page()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert anonymous.goto(base+f'/media/{asset.pk}/').status == 200
    anonymous.goto(base+f'/finder/{finder.pk}/')


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '테스트 지갑' in anonymous.locator('h1').inner_text()
    admin_page.goto(market_url)
    admin_page.get_by_role('button', name='예약', exact=True).click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '예약 중' in admin_page.content()
    admin_page.get_by_role('button', name='예약 취소', exact=True).click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '판매 중' in admin_page.content()
    admin_page.get_by_role('link', name='신고하기').click()
    admin_page.locator('[name=reason]').fill('브라우저 테스트 신고')
    admin_page.get_by_role('button', name='저장').click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '신고가 접수되었습니다' in admin_page.content()
    report = Report.objects.get(reporter=admin)
    admin_page.goto(base+'/admin/')
    admin_page.locator(f'form[action="/admin/reports/{report.pk}/status/"] button[value=RESOLVED]').click()
    report.refresh_from_db()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert report.status == 'RESOLVED'
    page.goto(market_url+'edit/')
    page.locator('[name=title]').fill('수정한 공책')
    page.get_by_role('button', name='저장').click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '수정한 공책' in page.locator('h1').inner_text()
    admin_page.goto(market_url)
    admin_page.get_by_role('button', name='예약', exact=True).click()
    page.goto(market_url)
    page.get_by_role('button', name='거래 완료', exact=True).click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert '거래 완료' in page.content()
    page.goto(base+f'/finder/{finder.pk}/edit/')
    page.locator('[name=title]').fill('수정한 지갑')
    page.get_by_role('button', name='저장').click()
    finder.refresh_from_db()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert finder.public_approval == 'PENDING'


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert anonymous.goto(base+f'/finder/{finder.pk}/').status == 404
    page.goto(base+f'/finder/{finder.pk}/')
    page.get_by_role('button', name='찾기 완료').click()
    finder.refresh_from_db()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert finder.status == 'CLOSED'
    page.goto(base+'/admin/')


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert page.locator('body').inner_text().find('권한') >= 0
    admin_context.close()
    mobile=browser.new_page(viewport={'width':360,'height':800},device_scale_factor=1)
    mobile.goto(base,wait_until='networkidle')
    mobile.screenshot(path='/tmp/gwg-django-mobile.png', full_page=True)


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    mobile.get_by_text('메뉴 ☰').click()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert mobile.get_by_role('navigation',name='모바일 메뉴').is_visible()


    # 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
    assert not failures, failures
    browser.close()
print('Browser: registration, email verification, session/CSRF, invitation, image upload/moderation, market edit/reserve/cancel/complete, finder edit/reapproval/close, reports, admin permissions, club application, mobile navigation PASS')

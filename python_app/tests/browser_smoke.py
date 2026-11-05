import os, sys
from datetime import timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DJANGO_DEBUG', '1')
os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import django
django.setup()
from django.utils import timezone
from django.core import signing
from core.models import User, Club, Recruitment
from core.services import issue_invitation
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
    assert page.get_by_role('heading', name='학교생활에 필요한 연결을 한 곳에서.').count() == 1
    page.screenshot(path='/tmp/gwg-django-desktop.png', full_page=True)
    page.goto(base+'/auth/register/', wait_until='networkidle')
    page.locator('[name=username]').fill('student')
    page.locator('[name=email]').fill('student@example.test')
    page.locator('[name=password1]').fill('ValidPassword-2468!')
    page.locator('[name=password2]').fill('ValidPassword-2468!')
    page.get_by_role('button', name='저장').click()
    assert '이메일을 확인해 주세요' in page.locator('h1').inner_text()
    user = User.objects.get(email='student@example.test')
    token=signing.dumps({'user': user.pk,'email':user.email},salt='email-verification')
    page.goto(base+'/auth/verify/'+token+'/',wait_until='networkidle')
    assert '확인 완료' in page.locator('h1').inner_text()
    page.goto(base+'/auth/login/')
    page.locator('[name=username]').fill('student@example.test')
    page.locator('[name=password]').fill('ValidPassword-2468!')
    page.get_by_role('button',name='로그인',exact=True).click()
    assert '/me/' in page.url
    page.goto(base+'/auth/invite/')
    page.locator('[name=code]').fill(invite)
    page.get_by_role('button',name='인증',exact=True).click()
    assert '학생 인증이 완료되었습니다' in page.content()
    page.goto(base+'/market/new/')
    page.locator('[name=title]').fill('테스트 공책')
    page.locator('textarea[name=description]').fill('테스트용 물품')
    page.locator('[name=price]').fill('1000')
    page.locator('[name=category]').fill('책')
    page.get_by_role('button',name='저장').click()
    assert '테스트 공책' in page.locator('h1').inner_text()
    page.goto(base+'/finder/new/')
    page.locator('[name=kind]').select_option('lost')
    page.locator('[name=title]').fill('테스트 지갑')
    page.locator('[name=category]').fill('지갑')
    page.locator('[name=color]').fill('검정')
    page.locator('[name=general_location]').fill('복도')
    page.locator('[name=occurred_at]').fill('2026-11-01')
    page.get_by_role('button',name='저장').click()
    assert '테스트 지갑' in page.content()
    page.goto(base+'/clubs/music/')
    page.locator('[name=answer]').fill('활동하고 싶습니다')
    page.get_by_role('button',name='지원',exact=True).click()
    assert '지원서가 제출되었습니다' in page.content()
    mobile=browser.new_page(viewport={'width':360,'height':800},device_scale_factor=1)
    mobile.goto(base,wait_until='networkidle')
    mobile.screenshot(path='/tmp/gwg-django-mobile.png', full_page=True)
    assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    mobile.get_by_text('메뉴 ☰').click()
    assert mobile.get_by_role('navigation',name='모바일 메뉴').is_visible()
    assert not failures, failures
    browser.close()
print('Browser: registration, email verification, invite, market, finder, club application, mobile navigation PASS')

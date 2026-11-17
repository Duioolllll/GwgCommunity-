# 이 파일은 사용자가 입력한 내용을 검사한다.
# 입력 검증: 가입·거래·분실물 및 동아리 관리 입력의 필수 항목·길이·형식을 서버에서 확인한다.
from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import User, MarketPost, FinderPost


# 가입 시 이메일을 소문자로 표기 통일하고 기존 계정과 대소문자 무관하게 중복 검사한다.
class RegisterForm(UserCreationForm):
    email = forms.EmailField(label='이메일')
    # 이 입력 폼이 사용할 데이터 종류와 편집 가능한 항목·표시 이름을 정한다.
    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2')

    # 이메일 주소를 정리하고 이미 가입한 주소인지 확인한다.
    def clean_email(self):
        email = self.cleaned_data['email'].strip().lower()
        # 대소문자 차이까지 무시해 같은 이메일의 계정이 이미 있는지 확인한다. 중복 가입은 막는다.
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('사용할 수 없는 이메일입니다.')
        return email


# 거래 설명 길이와 가격 범위를 양식에서 제한한다.
class MarketForm(forms.ModelForm):
    description = forms.CharField(label='설명', max_length=5000, widget=forms.Textarea)
    price = forms.IntegerField(label='가격', min_value=0, max_value=100000000)
    # 이 입력 폼이 사용할 데이터 종류와 편집 가능한 항목·표시 이름을 정한다.
    class Meta:
        model = MarketPost
        fields = ('title', 'description', 'price', 'category')
        labels = {'title': '제목', 'description': '설명', 'price': '가격', 'category': '분류'}


# 분실·습득 게시물의 입력 필드와 날짜 위젯을 정의한다.
class FinderForm(forms.ModelForm):
    # 이 입력 폼이 사용할 데이터 종류와 편집 가능한 항목·표시 이름을 정한다.
    class Meta:
        model = FinderPost
        fields = ('kind', 'title', 'category', 'color', 'general_location', 'occurred_at')
        labels = {'kind': '유형', 'title': '제목', 'category': '분류', 'color': '색상', 'general_location': '대략적인 장소', 'occurred_at': '날짜'}
        widgets = {'occurred_at': forms.DateInput(attrs={'type': 'date'})}

from .models import Club, ClubPost, Recruitment, Report


# 동아리 정보와 공개 여부를 검증한다.
class ClubForm(forms.ModelForm):
    introduction = forms.CharField(label='소개', max_length=5000, widget=forms.Textarea)
    # 이 입력 폼이 사용할 데이터 종류와 편집 가능한 항목·표시 이름을 정한다.
    class Meta:
        model = Club
        fields = ('slug', 'name', 'category', 'introduction', 'is_public')


# 동아리 활동 글의 내용 길이와 공개 여부를 검증한다.
class ClubPostForm(forms.ModelForm):
    content = forms.CharField(label='내용', max_length=5000, widget=forms.Textarea)
    # 이 입력 폼이 사용할 데이터 종류와 편집 가능한 항목·표시 이름을 정한다.
    class Meta:
        model = ClubPost
        fields = ('title', 'content', 'is_public')


# 모집 내용과 기간을 입력받고 종료 시각이 시작보다 늦은지 검증한다.
class RecruitmentForm(forms.ModelForm):
    description = forms.CharField(label='설명', max_length=5000, widget=forms.Textarea)
    # 이 입력 폼이 사용할 데이터 종류와 편집 가능한 항목·표시 이름을 정한다.
    class Meta:
        model = Recruitment
        fields = ('title', 'description', 'opens_at', 'closes_at', 'is_open')
        widgets = {'opens_at': forms.DateTimeInput(attrs={'type': 'datetime-local'}), 'closes_at': forms.DateTimeInput(attrs={'type': 'datetime-local'})}

    # 입력값들 사이의 조건까지 확인해 잘못된 가입·모집 정보를 막는다.
    def clean(self):
        cleaned = super().clean()
        # 모집 마감은 시작보다 뒤여야 한다. 두 시각을 거꾸로 입력했으면 오류를 표시한다.
        if cleaned.get('opens_at') and cleaned.get('closes_at') and cleaned['closes_at'] <= cleaned['opens_at']:
            raise forms.ValidationError('마감은 시작 이후여야 합니다.')
        return cleaned


# 허용된 신고 유형과 사유 길이를 제한한다.
class ReportForm(forms.ModelForm):
    target_type = forms.ChoiceField(label='대상 유형', choices=[('market', '중고거래'), ('finder', '분실물'), ('club_post', '동아리 활동')])
    reason = forms.CharField(label='신고 이유', max_length=1000, widget=forms.Textarea)
    # 이 입력 폼이 사용할 데이터 종류와 편집 가능한 항목·표시 이름을 정한다.
    class Meta:
        model = Report
        fields = ('target_type', 'target_id', 'reason')
        labels = {'target_type': '대상 유형', 'target_id': '대상 ID', 'reason': '신고 이유'}

from django.contrib.auth import authenticate
from django.contrib.auth.forms import AuthenticationForm


# 이메일로 계정을 찾아 인증하고 이메일 확인 여부도 검사한다.
class EmailLoginForm(AuthenticationForm):
    username = forms.EmailField(label='이메일', max_length=254)

    # 입력값들 사이의 조건까지 확인해 잘못된 가입·모집 정보를 막는다.
    def clean(self):
        email = self.cleaned_data.get('username', '').strip().lower()
        password = self.cleaned_data.get('password')
        # 이메일과 비밀번호가 모두 입력되었을 때만 계정을 확인한다.
        if email and password:
            user = User.objects.filter(email__iexact=email).first()
            # 해당 이메일의 계정이 없어도 비밀번호 검사와 비슷한 계산을 해 계정 존재 여부가 쉽게 드러나지 않게 한다.
            if user is None:
                User().set_password(password)
                raise self.get_invalid_login_error()
            self.user_cache = authenticate(self.request, username=user.username, password=password)
            # 이메일과 비밀번호로 확인한 계정이 없으면 로그인을 거절한다.
            if self.user_cache is None:
                raise self.get_invalid_login_error()
            self.confirm_login_allowed(self.user_cache)
            # 이메일 확인을 끝내지 않은 계정은 먼저 확인 메일을 열도록 안내한다.
            if not self.user_cache.email_verified:
                raise forms.ValidationError('이메일을 먼저 확인해 주세요.', code='email_unverified')
        return self.cleaned_data


# 확인 메일 재발송 등에 필요한 이메일 입력을 받는다.
class EmailOnlyForm(forms.Form):
    email = forms.EmailField(label='이메일')

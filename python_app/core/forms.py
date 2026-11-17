

from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import User, MarketPost, FinderPost


# 사용자 입력을 검사하고 저장할 항목을 정한다.
class RegisterForm(UserCreationForm):
    email = forms.EmailField(label='이메일')


    # 이 데이터의 저장 규칙과 중복·잘못된 값 방지 조건을 정한다.
    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2')


    # 이메일이 이미 가입된 주소인지 확인한다.
    def clean_email(self):
        email = self.cleaned_data['email'].strip().lower()


        # 같은 이메일로 가입된 계정이 이미 있을 때 “사용할 수 없는 이메일입니다.” 오류로 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('사용할 수 없는 이메일입니다.')
        return email


# 사용자 입력을 검사하고 저장할 항목을 정한다.
class MarketForm(forms.ModelForm):
    description = forms.CharField(label='설명', max_length=5000, widget=forms.Textarea)
    price = forms.IntegerField(label='가격', min_value=0, max_value=100000000)


    # 이 데이터의 저장 규칙과 중복·잘못된 값 방지 조건을 정한다.
    class Meta:
        model = MarketPost
        fields = ('title', 'description', 'price', 'category')
        labels = {'title': '제목', 'description': '설명', 'price': '가격', 'category': '분류'}


# 사용자 입력을 검사하고 저장할 항목을 정한다.
class FinderForm(forms.ModelForm):


    # 이 데이터의 저장 규칙과 중복·잘못된 값 방지 조건을 정한다.
    class Meta:
        model = FinderPost
        fields = ('kind', 'title', 'category', 'color', 'general_location', 'occurred_at')
        labels = {'kind': '유형', 'title': '제목', 'category': '분류', 'color': '색상', 'general_location': '대략적인 장소', 'occurred_at': '날짜'}
        widgets = {'occurred_at': forms.DateInput(attrs={'type': 'date'})}

from .models import Club, ClubPost, Recruitment, Report


# 사용자 입력을 검사하고 저장할 항목을 정한다.
class ClubForm(forms.ModelForm):
    introduction = forms.CharField(label='소개', max_length=5000, widget=forms.Textarea)


    # 이 데이터의 저장 규칙과 중복·잘못된 값 방지 조건을 정한다.
    class Meta:
        model = Club
        fields = ('slug', 'name', 'category', 'introduction', 'is_public')


# 사용자 입력을 검사하고 저장할 항목을 정한다.
class ClubPostForm(forms.ModelForm):
    content = forms.CharField(label='내용', max_length=5000, widget=forms.Textarea)


    # 이 데이터의 저장 규칙과 중복·잘못된 값 방지 조건을 정한다.
    class Meta:
        model = ClubPost
        fields = ('title', 'content', 'is_public')


# 사용자 입력을 검사하고 저장할 항목을 정한다.
class RecruitmentForm(forms.ModelForm):
    description = forms.CharField(label='설명', max_length=5000, widget=forms.Textarea)


    # 이 데이터의 저장 규칙과 중복·잘못된 값 방지 조건을 정한다.
    class Meta:
        model = Recruitment
        fields = ('title', 'description', 'opens_at', 'closes_at', 'is_open')
        widgets = {'opens_at': forms.DateTimeInput(attrs={'type': 'datetime-local'}), 'closes_at': forms.DateTimeInput(attrs={'type': 'datetime-local'})}


    # 입력값 사이에 서로 맞지 않는 부분이 없는지 추가로 확인한다.
    def clean(self):
        cleaned = super().clean()


        # 모집 시작과 종료 시각을 모두 입력했지만 종료가 시작보다 늦지 않을 때 “마감은 시작 이후여야 합니다.” 오류로 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
        if cleaned.get('opens_at') and cleaned.get('closes_at') and cleaned['closes_at'] <= cleaned['opens_at']:
            raise forms.ValidationError('마감은 시작 이후여야 합니다.')
        return cleaned


# 사용자 입력을 검사하고 저장할 항목을 정한다.
class ReportForm(forms.ModelForm):
    target_type = forms.ChoiceField(label='대상 유형', choices=[('market', '중고거래'), ('finder', '분실물'), ('club_post', '동아리 활동')])
    reason = forms.CharField(label='신고 이유', max_length=1000, widget=forms.Textarea)


    # 이 데이터의 저장 규칙과 중복·잘못된 값 방지 조건을 정한다.
    class Meta:
        model = Report
        fields = ('target_type', 'target_id', 'reason')
        labels = {'target_type': '대상 유형', 'target_id': '대상 ID', 'reason': '신고 이유'}

from django.contrib.auth import authenticate
from django.contrib.auth.forms import AuthenticationForm


# 사용자 입력을 검사하고 저장할 항목을 정한다.
class EmailLoginForm(AuthenticationForm):
    username = forms.EmailField(label='이메일', max_length=254)


    # 입력값 사이에 서로 맞지 않는 부분이 없는지 추가로 확인한다.
    def clean(self):
        email = self.cleaned_data.get('username', '').strip().lower()
        password = self.cleaned_data.get('password')


        # 이메일과 비밀번호를 모두 입력했을 때 필요한 값을 정한 뒤 아래 처리를 계속한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
        if email and password:
            user = User.objects.filter(email__iexact=email).first()


            # 가입 정보를 가진 계정을 찾지 못했을 때 필요한 저장·안내 작업을 실행한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
            if user is None:


                User().set_password(password)
                raise self.get_invalid_login_error()
            self.user_cache = authenticate(self.request, username=user.username, password=password)


            # 로그인 정보와 맞는 계정을 찾지 못했을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
            if self.user_cache is None:
                raise self.get_invalid_login_error()
            self.confirm_login_allowed(self.user_cache)


            # 이메일 확인이 끝나지 않은 계정일 때 “이메일을 먼저 확인해 주세요.” 오류로 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
            if not self.user_cache.email_verified:
                raise forms.ValidationError('이메일을 먼저 확인해 주세요.', code='email_unverified')
        return self.cleaned_data


# 사용자 입력을 검사하고 저장할 항목을 정한다.
class EmailOnlyForm(forms.Form):
    email = forms.EmailField(label='이메일')

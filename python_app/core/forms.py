from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import User, MarketPost, FinderPost


class RegisterForm(UserCreationForm):
    email = forms.EmailField(label='이메일')
    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2')

    def clean_email(self):
        email = self.cleaned_data['email'].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('사용할 수 없는 이메일입니다.')
        return email


class MarketForm(forms.ModelForm):
    description = forms.CharField(label='설명', max_length=5000, widget=forms.Textarea)
    price = forms.IntegerField(label='가격', min_value=0, max_value=100000000)
    class Meta:
        model = MarketPost
        fields = ('title', 'description', 'price', 'category')
        labels = {'title': '제목', 'description': '설명', 'price': '가격', 'category': '분류'}


class FinderForm(forms.ModelForm):
    class Meta:
        model = FinderPost
        fields = ('kind', 'title', 'category', 'color', 'general_location', 'occurred_at')
        labels = {'kind': '유형', 'title': '제목', 'category': '분류', 'color': '색상', 'general_location': '대략적인 장소', 'occurred_at': '날짜'}
        widgets = {'occurred_at': forms.DateInput(attrs={'type': 'date'})}

from .models import Club, ClubPost, Recruitment, Report


class ClubForm(forms.ModelForm):
    introduction = forms.CharField(label='소개', max_length=5000, widget=forms.Textarea)
    class Meta:
        model = Club
        fields = ('slug', 'name', 'category', 'introduction', 'is_public')


class ClubPostForm(forms.ModelForm):
    content = forms.CharField(label='내용', max_length=5000, widget=forms.Textarea)
    class Meta:
        model = ClubPost
        fields = ('title', 'content', 'is_public')


class RecruitmentForm(forms.ModelForm):
    description = forms.CharField(label='설명', max_length=5000, widget=forms.Textarea)
    class Meta:
        model = Recruitment
        fields = ('title', 'description', 'opens_at', 'closes_at', 'is_open')
        widgets = {'opens_at': forms.DateTimeInput(attrs={'type': 'datetime-local'}), 'closes_at': forms.DateTimeInput(attrs={'type': 'datetime-local'})}

    def clean(self):
        cleaned = super().clean()
        if cleaned.get('opens_at') and cleaned.get('closes_at') and cleaned['closes_at'] <= cleaned['opens_at']:
            raise forms.ValidationError('마감은 시작 이후여야 합니다.')
        return cleaned


class ReportForm(forms.ModelForm):
    target_type = forms.ChoiceField(label='대상 유형', choices=[('market', '중고거래'), ('finder', '분실물'), ('club_post', '동아리 활동')])
    reason = forms.CharField(label='신고 이유', max_length=1000, widget=forms.Textarea)
    class Meta:
        model = Report
        fields = ('target_type', 'target_id', 'reason')
        labels = {'target_type': '대상 유형', 'target_id': '대상 ID', 'reason': '신고 이유'}

from django.contrib.auth import authenticate
from django.contrib.auth.forms import AuthenticationForm


class EmailLoginForm(AuthenticationForm):
    username = forms.EmailField(label='이메일', max_length=254)

    def clean(self):
        email = self.cleaned_data.get('username', '').strip().lower()
        password = self.cleaned_data.get('password')
        if email and password:
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                # Preserve comparable password-hash work without treating an unknown
                # email address as a username for a different account.
                User().set_password(password)
                raise self.get_invalid_login_error()
            self.user_cache = authenticate(self.request, username=user.username, password=password)
            if self.user_cache is None:
                raise self.get_invalid_login_error()
            self.confirm_login_allowed(self.user_cache)
            if not self.user_cache.email_verified:
                raise forms.ValidationError('이메일을 먼저 확인해 주세요.', code='email_unverified')
        return self.cleaned_data


class EmailOnlyForm(forms.Form):
    email = forms.EmailField(label='이메일')

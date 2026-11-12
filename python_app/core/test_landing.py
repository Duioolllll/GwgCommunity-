"""Regression checks for the public campus landing page."""

from html.parser import HTMLParser

from django.test import TestCase
from django.urls import reverse


class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.append(dict(attrs).get("href"))


class LandingPageTests(TestCase):
    def test_anonymous_visit_displays_real_navigation_and_entry_points(self):
        response = self.client.get(reverse("home"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "우리 학교의")
        self.assertContains(response, "더 가깝게.")
        self.assertContains(response, "학생 주도 비공식 프로젝트")
        self.assertContains(response, "학생으로 시작하기")
        self.assertContains(response, "GWG / CAMPUS DESK")

        collector = LinkCollector()
        collector.feed(response.content.decode("utf-8"))
        for route_name in ("market", "clubs", "finder", "register"):
            with self.subTest(route=route_name):
                self.assertIn(reverse(route_name), collector.links)

    def test_landing_styles_are_rendered_in_document_head(self):
        response = self.client.get(reverse("home"))
        markup = response.content.decode("utf-8")
        head = markup.split("</head>", 1)[0]
        self.assertIn(".landing-hero", head)
        self.assertIn("@media (max-width: 760px)", head)
        self.assertIn("prefers-reduced-motion", head)
        self.assertIn("href=\"#main-content\"", markup)

    def test_other_pages_keep_legacy_layout_without_landing_css(self):
        response = self.client.get(reverse("market"))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "landing-stage-window")
        self.assertNotContains(response, ".landing-hero")

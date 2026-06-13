"""End-to-end Playwright tests for the ux-pipeline web dashboard."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

dashboard_url: str = "http://127.0.0.1:18765"


class TestPageLoad:
    def test_title_reflects_issue_count(self, page: Page, dashboard_url: str) -> None:
        page.goto(dashboard_url)
        page.wait_for_load_state("networkidle")
        title = page.title()
        assert "Issue Tracker" in title
        assert "open /" in title

    def test_topbar_heading_present(self, page: Page, dashboard_url: str) -> None:
        page.goto(dashboard_url)
        page.wait_for_load_state("networkidle")
        h1 = page.locator(".topbar h1")
        expect(h1).to_contain_text("Issue Tracker")

    def test_rust_tools_panel_is_available(self, page: Page, dashboard_url: str) -> None:
        page.goto(dashboard_url)
        page.wait_for_load_state("networkidle")
        expect(page.locator("#rust-path")).to_be_visible()
        expect(page.locator("#rust-format")).to_be_visible()
        expect(page.locator('[data-rust="cli"]')).to_be_visible()
        expect(page.locator('[data-rust="gui"]')).to_be_visible()

    def test_metrics_bar_has_five_pills(self, page: Page, dashboard_url: str) -> None:
        page.goto(dashboard_url)
        page.wait_for_load_state("networkidle")
        expect(page.locator("#metrics .metric")).to_have_count(5)

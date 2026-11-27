"""Exercise the served Zanshin UI with isolated Playwright contexts and synthetic notes."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

FIXTURE = json.loads((Path(__file__).parent.parent / "fixtures/round-2.json").read_text())
CASES = {case["id"]: case for case in FIXTURE["text_cases"]}
PRIMARY = "zanshin.notes.v1"
BACKUP = "zanshin.notes.backup.v1"
PENDING = "zanshin.notes.pending.v1"
PREF = "zanshin.prefs.ui-language.v1"
MODE = "zanshin.prefs.reading-mode.v1"
COPY = {
    "ja": {
        "new": "メモを書く", "title": "タイトル（任意）", "body": "本文",
        "back": "一覧へ", "back_read": "読み返しへ", "edit": "編集する",
        "search": "題名と本文から探す", "clear": "検索を消す",
        "horizontal": "横書き", "vertical": "縦書き", "brush": "筆あと",
        "about": "このアプリについて", "language": "言語", "close": "閉じる",
        "delete": "このメモを削除", "confirm": "削除する", "undo": "元に戻す",
        "pin": "先頭に留める", "unpin": "先頭固定を解除",
        "view": "内容を確認する", "copy": "本文をコピー",
        "quota": "メモの保存領域が足りない", "empty": "この保存版にはメモがありません。",
    },
    "en": {
        "new": "New note", "title": "Title (optional)", "body": "Note text",
        "back": "Back to notes", "back_read": "Back to reading", "edit": "Edit",
        "search": "Search titles and text", "clear": "Clear search",
        "horizontal": "Horizontal", "vertical": "Vertical", "brush": "Writing style",
        "about": "About this app", "language": "Language", "close": "Close",
        "delete": "Delete this note", "confirm": "Delete note", "undo": "Undo",
        "pin": "Pin to top", "unpin": "Unpin",
        "view": "View contents", "copy": "Copy text",
        "quota": "There isn’t enough space", "empty": "This version contains no notes.",
    },
}


def make_note(case_id, **overrides):
    original = CASES[case_id]
    return dict(
        id=case_id, title=original["title"], body=original["body"],
        createdAt="2026-11-27T03:00:00.000Z", updatedAt="2026-11-27T03:00:00.000Z",
        isFavorite=False, **overrides,
    )


def action(page, name, exact=True):
    return page.get_by_role("button", name=name, exact=exact)


def editor(page, copy, title, body):
    page.get_by_role("textbox", name=copy["title"]).fill(title)
    page.get_by_role("textbox", name=copy["body"]).fill(body)


def store(page):
    return page.evaluate("(key) => localStorage.getItem(key)", PRIMARY)


def check_viewport(page):
    measured = page.evaluate("""() => ({
      width: innerWidth,
      content: document.scrollingElement.scrollWidth,
      overflowing: [...document.querySelectorAll('#root *')].map(el => [el, el.getBoundingClientRect()])
        .filter(([el, rect]) => rect.right > innerWidth + 1 && rect.width > 0 && !el.closest('.read-mode-scroll'))
        .map(([el, rect]) => [el.tagName, String(el.className).trim().slice(0, 90), Math.round(rect.right)])
        .slice(0, 15),
    })""")
    assert measured["content"] <= measured["width"] + 1, measured


def double_text(page):
    page.evaluate("""() => {
      const nodes = [...document.querySelectorAll('#root button, #root input, #root textarea, #root p, #root span, #root select, #root label, #root h1, #root h2, #root h3, #root pre')];
      const fresh = nodes.filter(el => !el.dataset.testTextSize);
      const sizes = fresh.map(el => parseFloat(getComputedStyle(el).fontSize));
      fresh.forEach((el, index) => {
        el.dataset.testTextSize = '200%';
        el.style.setProperty('font-size', sizes[index] * 2 + 'px', 'important');
      });
    }""")
    check_viewport(page)


def save_image(page, output, name):
    if output:
        page.evaluate("document.fonts.ready")
        page.screenshot(path=output / f"{name}.jpg", type="jpeg", quality=88, animations="disabled")


def regular_flow(browser, origin, locale, viewport, output):
    copy = COPY[locale]
    context = browser.new_context(
        viewport=viewport, locale="en-GB" if locale == "en" else "ja-JP",
        timezone_id="Asia/Tokyo", reduced_motion="reduce",
        permissions=["clipboard-read", "clipboard-write"],
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(origin)
    expect(page.locator("html")).to_have_attribute("lang", locale)
    assert page.evaluate("(key)=>localStorage.getItem(key)", MODE) == ("horizontal" if locale == "en" else "vertical")
    title = "窓辺の月" if locale == "ja" else "Moon through the window"
    body = CASES["MLT01" if locale == "ja" else "MLT02"]["body"]
    action(page, copy["new"]).click()
    editor(page, copy, title, body)
    expect(page.locator(".writing-textarea")).to_have_attribute("lang", "")
    expect(page.locator(".writing-textarea")).to_have_attribute("dir", "auto")
    save_image(page, output, f"{locale}-editor")
    action(page, copy["back"]).click()
    page.wait_for_function("(key)=>localStorage.getItem(key)?.includes('body')", arg=PRIMARY)
    raw = store(page)
    assert json.loads(raw)[0]["body"] == body
    assert "locale" not in json.loads(raw)[0]
    query = title[:3]
    search = page.get_by_role("searchbox", name=copy["search"])
    search.fill(query)
    expect(search).to_have_attribute("autocapitalize", "none")
    expect(search).to_have_attribute("autocorrect", "off")
    expect(search).to_have_attribute("autocomplete", "off")
    expect(search).to_have_attribute("spellcheck", "false")
    expect(page.locator("[data-note-id]")).to_have_count(1)
    save_image(page, output, f"{locale}-search")

    action(page, copy["about"], exact=False).click()
    select = page.get_by_label(copy["language"], exact=True)
    expect(select).to_have_value("system")
    save_image(page, output, f"{locale}-about")
    other = "ja" if locale == "en" else "en"
    context.set_offline(True)
    select.focus()
    select.select_option(other)
    expect(page.locator("html")).to_have_attribute("lang", other)
    assert page.evaluate("document.activeElement.tagName") == "SELECT"
    double_text(page)
    action(page, COPY[other]["close"]).click()
    expect(page.get_by_role("searchbox", name=COPY[other]["search"])).to_have_value(query)
    assert store(page) == raw
    assert page.evaluate("(key)=>localStorage.getItem(key)", MODE) == ("horizontal" if locale == "en" else "vertical")
    action(page, COPY[other]["about"], exact=False).click()
    page.get_by_label(COPY[other]["language"], exact=True).select_option(locale)
    action(page, copy["close"]).click()
    search.fill("\u200b")
    action(page, copy["clear"]).click()
    expect(search).to_be_focused()
    page.locator("[data-note-id]").click()
    expect(page.locator("pre.read-mode-body")).to_have_js_property("textContent", body)
    save_image(page, output, f"{locale}-read")
    if locale == "en":
        action(page, copy["vertical"]).click()
        expect(page.locator("pre .read-upright-latin").first).to_have_css("text-orientation", "upright")
        save_image(page, output, "en-read-vertical")
    double_text(page)
    action(page, copy["edit"]).click()
    long_title = "👨‍👩‍👧‍👦" * 201
    page.get_by_role("textbox", name=copy["title"]).fill(long_title)
    expect(page.get_by_role("textbox", name=copy["title"])).to_have_value(long_title)
    page.get_by_role("textbox", name=copy["title"]).fill(title)
    action(page, copy["pin"]).click()
    expect(action(page, copy["unpin"])).to_have_attribute("aria-pressed", "true")
    action(page, copy["delete"]).click()
    double_text(page)
    action(page, copy["confirm"]).click()
    action(page, copy["undo"]).click()
    expect(page.locator("[data-note-id]")).to_have_count(1)
    check_viewport(page)
    assert not errors, errors
    context.close()


def long_reader(browser, origin, width):
    context = browser.new_context(viewport={"width": width, "height": 844}, locale="en",
                                  permissions=["clipboard-read", "clipboard-write"])
    page = context.new_page()
    body = "\n" + CASES["MLT06"]["body"] + "\n" + "月の帰り道".ljust(32, "あ") * 65 + "\n"
    body += ("blue moon waits by the window " * 334) + "\nhttps://example.com/" + ("a" * 215) + "\nLAST\n"
    note = make_note("MLT06")
    note["body"] = body
    page.add_init_script(f"localStorage.setItem({json.dumps(PRIMARY)}, {json.dumps(json.dumps([note]))});")
    page.goto(origin)
    expect(page.locator("html")).to_have_attribute("lang", "en")
    page.locator("[data-note-id]").click()
    pane = page.locator(".read-mode-scroll")
    original = page.locator("pre.read-mode-body")
    for direction, axis in [("Horizontal", "scrollTop"), ("Vertical", "scrollLeft")]:
        action(page, direction).click()
        expect(original).to_have_js_property("textContent", body)
        check_viewport(page)
        extent, distance, at_end = pane.evaluate("""(el, axis) => {
          const extent = axis === 'scrollTop' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
          el[axis] = axis === 'scrollTop' ? extent : -extent;
          const pre = el.querySelector('pre');
          const walk = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
          let marker;
          while (walk.nextNode()) if (walk.currentNode.textContent.includes('LAST')) marker = walk.currentNode;
          const start = marker.textContent.indexOf('LAST');
          const range = document.createRange();
          range.setStart(marker, start);
          range.setEnd(marker, start + 4);
          const word = range.getBoundingClientRect();
          const viewport = el.getBoundingClientRect();
          return [extent, Math.abs(el[axis]), word.right > viewport.left && word.left < viewport.right &&
            word.top < viewport.bottom && word.bottom > viewport.top];
        }""", axis)
        assert extent > 0 and abs(extent - distance) <= 2 and at_end, (direction, extent, distance, at_end)
        selection = original.evaluate("""el => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const selection = getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return selection.toString();
        }""")
        assert selection == body, (direction, len(body), len(selection), repr(body[:80]), repr(selection[:80]), repr(body[-50:]), repr(selection[-50:]))
        latin = original.locator(".read-upright-latin", has_text="blue").first
        orientation = "upright" if direction == "Vertical" else "mixed"
        expect(latin).to_have_css("text-orientation", orientation)
        expect(original.locator(".read-upright-latin", has_text="https")).to_have_count(0)
    page.keyboard.press("Control+c")
    clipboard = page.evaluate("navigator.clipboard.readText()")
    assert clipboard == body
    page.evaluate("getSelection().removeAllRanges()")
    action(page, COPY["en"]["edit"]).click()
    expect(page.get_by_role("textbox", name=COPY["en"]["body"])).to_have_value(body)
    action(page, COPY["en"]["back_read"]).click()
    assert pane.evaluate("el => Math.abs(el.scrollLeft)") > 0
    context.close()


def fault_flow(browser, origin, locale, output):
    copy = COPY[locale]
    context = browser.new_context(locale=locale, viewport={"width": 390, "height": 844},
                                  reduced_motion="reduce", permissions=["clipboard-read", "clipboard-write"])
    page = context.new_page()
    note = make_note("MLT23", locale="ja", future={"mark": "\u200d"})
    old = json.dumps([note])
    page.add_init_script(f"localStorage.setItem({json.dumps(PRIMARY)}, {json.dumps(old)});")
    page.goto(origin)
    expect(page.locator("html")).to_have_attribute("lang", locale)
    page.locator("[data-note-id]").click()
    action(page, copy["edit"]).click()
    page.evaluate("""key => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, value) {
        if (k === key) throw new DOMException('Synthetic test quota', 'QuotaExceededError');
        original.call(this, k, value);
      };
    }""", PENDING)

    body = CASES["MLT24"]["body"]
    page.get_by_role("textbox", name=copy["body"]).fill(body)
    expect(page.locator(".zanshin-save-failure")).to_contain_text(copy["quota"])
    assert store(page) == old
    save_image(page, output, f"{locale}-save-failure")
    double_text(page)
    action(page, copy["copy"]).click()
    assert page.evaluate("navigator.clipboard.readText()") == body
    assert store(page) == old
    action(page, copy["back_read"]).click()
    action(page, copy["view"]).click()
    expect(page.get_by_role("dialog")).to_be_visible()
    page.get_by_role("dialog").locator("summary").first.click()
    expect(page.get_by_role("dialog").locator("textarea").last).to_have_value(body)
    save_image(page, output, f"{locale}-recovery")
    assert store(page) == old
    context.close()


def search_and_conflict(browser, origin):
    context = browser.new_context(viewport={"width": 375, "height": 667}, locale="en")
    page = context.new_page()
    cases = [make_note(case_id) for case_id in ("MLT04", "MLT09", "MLT14", "MLT17", "MLT22")]
    cases.append(dict(make_note("MLT02"), id="join", title="Silent", body="blue\t\u202fmoon"))
    old = json.dumps(cases)
    page.add_init_script(f"""if (location.pathname === '/') {{
      localStorage.setItem({json.dumps(PRIMARY)}, {json.dumps(old)});
      localStorage.setItem({json.dumps(BACKUP)}, {json.dumps(old)});
    }}""")
    page.goto(origin)
    search = page.get_by_role("searchbox")
    search.fill("CAFÉ")
    expect(page.locator("[data-note-id=MLT09]")).to_be_visible()
    search.fill("blue moon")
    expect(page.locator("[data-note-id=join]")).to_be_visible()
    expect(page.locator("[data-note-id=MLT17]")).to_have_count(0)
    search.fill("https")
    preview = page.locator("[data-note-id=MLT04] .zanshin-note-card__preview")
    expect(preview).to_be_visible()
    assert preview.evaluate("el => getComputedStyle(el).direction") == "rtl"
    search.fill("<em>")
    expect(page.locator("[data-note-id=MLT22]")).to_be_visible()
    expect(page.locator("[data-note-id=MLT22] em")).to_have_count(0)
    search.fill("")
    assert store(page) == old
    second = context.new_page()
    second.goto(f"{origin}/privacy.html")
    expect(second.locator("html")).to_have_attribute("lang", "ja")
    second.get_by_role("link", name="English").click()
    expect(second.locator("html")).to_have_attribute("lang", "en")
    second.get_by_role("link", name="Support", exact=True).click()
    expect(second.locator("html")).to_have_attribute("lang", "en")
    search.fill("Cafe\u0301")
    expect(page.locator("[data-note-id=MLT09]")).to_be_visible()
    second.evaluate("key => localStorage.setItem(key, 'ja')", PREF)
    expect(page.locator("html")).to_have_attribute("lang", "ja")
    expect(search).to_have_value("Cafe\u0301")
    expect(page.locator("[data-note-id=MLT09]")).to_be_visible()
    search.fill("blue moon")
    expect(page.locator("[data-note-id=join]")).to_be_visible()
    expect(page.locator("[data-note-id=MLT17]")).to_have_count(0)
    assert store(page) == old
    second.evaluate("key => localStorage.setItem(key, 'en')", PREF)
    expect(page.locator("html")).to_have_attribute("lang", "en")
    second.evaluate("([key,value]) => localStorage.setItem(key, value)", [PENDING, json.dumps({"version": 1, "baseRaw": old, "nextRaw": "[]"})])
    page.reload()
    action(page, COPY["en"]["view"]).click()
    dialog = page.get_by_role("dialog")
    radio = dialog.get_by_role("radio").first
    expect(radio).to_contain_text(COPY["en"]["empty"])
    second.evaluate("key => localStorage.setItem(key, 'ja')", PREF)
    expect(page.locator("html")).to_have_attribute("lang", "ja")
    expect(radio).to_have_attribute("aria-checked", "true")
    expect(radio).to_contain_text(COPY["ja"]["empty"])
    double_text(page)
    assert store(page) == old
    context.close()


def unavailable_preferences(browser, origin):
    context = browser.new_context(viewport={"width": 375, "height": 667}, locale="ja")
    page = context.new_page()
    page.goto(origin)
    expect(page.locator("html")).to_have_attribute("lang", "ja")
    page.evaluate("""key => {
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function(candidate, value) {
        if (candidate === key) throw new DOMException("Synthetic test quota", "QuotaExceededError");
        write.call(this, candidate, value);
      };
    }""", PREF)
    action(page, COPY["ja"]["about"], exact=False).click()
    select = page.get_by_label(COPY["ja"]["language"], exact=True)
    select.select_option("en")
    expect(page.get_by_role("dialog")).to_contain_text("This setting couldn’t be saved.")
    assert page.evaluate("(key)=>localStorage.getItem(key)", PREF) is None
    action(page, COPY["en"]["close"]).click()
    action(page, COPY["en"]["new"]).click()
    editor(page, COPY["en"], "Independent preference", "A note can still be saved.")
    page.wait_for_function("(key)=>localStorage.getItem(key)?.includes('can still be saved')", arg=PRIMARY)
    assert json.loads(store(page))[0]["body"] == "A note can still be saved."
    context.close()


def unavailable_segmenter(browser, origin):
    context = browser.new_context(viewport={"width": 375, "height": 667}, locale="ja")
    page = context.new_page()
    note = make_note("MLT07")
    note["title"] = "👨‍👩‍👧‍👦" * 201
    page.add_init_script(f"""
      Object.defineProperty(Intl, "Segmenter", {{value: undefined}});
      localStorage.setItem({json.dumps(PRIMARY)}, {json.dumps(json.dumps([note]))});
    """)
    page.goto(origin)
    expect(page.locator(".zanshin-note-card__title")).to_have_js_property("textContent", note["title"])
    page.locator("[data-note-id]").click()
    expect(page.locator("pre")).to_have_js_property("textContent", note["body"])
    action(page, COPY["ja"]["edit"]).click()
    field = page.get_by_role("textbox", name=COPY["ja"]["title"])
    expect(field).to_have_value(note["title"])
    assert field.get_attribute("aria-describedby") is None
    context.close()


def pseudo_translation(browser, origin):
    context = browser.new_context(viewport={"width": 375, "height": 667}, locale="en")
    page = context.new_page()
    note = make_note("MLT22")
    raw = json.dumps([note])
    page.add_init_script(f"""
      localStorage.setItem({json.dumps(PRIMARY)}, {json.dumps(raw)});
      localStorage.setItem({json.dumps(PENDING)}, {json.dumps(json.dumps({"version": 1, "baseRaw": raw, "nextRaw": "[]"}))});
    """)

    def stretch_dictionary(route):
        response = route.fetch()
        # Vite transforms this module before we append the development-only test.
        route.fulfill(response=response, body=response.text() + """
          const stretch = value => {
            if (typeof value === "string") return "⟦" + (value + " ").repeat(2).trim().replaceAll("a", "á") + "⟧";
            if (typeof value === "function") return args => stretch(value(args));
            if (Array.isArray(value)) return value.map(stretch);
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stretch(item)]));
          };
          Object.assign(messages.en, stretch(messages.en));
        """)

    page.route("**/src/lib/i18n.ts*", stretch_dictionary)
    page.goto(origin)
    expect(page.locator("html")).to_have_attribute("lang", "en")
    page.get_by_role("button", name="⟦View contents View contents⟧").click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_contain_text("⟦Compáre versions Compáre versions⟧")
    check_viewport(page)
    dialog.get_by_role("radio").last.click()
    dialog.locator("summary").first.click()
    expect(dialog.locator("textarea").last).to_have_value(note["body"])
    check_viewport(page)
    assert store(page) == raw
    context.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("origin")
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--pseudo-origin", help="Vite dev server for the development-only dictionary check")
    options = parser.parse_args()
    if options.output:
        options.output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=options.chromium, args=["--no-sandbox"])
        print(f"Chromium {browser.version}")
        for locale in ("ja", "en"):
            for width, height in [(375, 667), (390, 844), (430, 932)]:
                regular_flow(browser, options.origin, locale, {"width": width, "height": height},
                             options.output if width == 390 else None)
                print(f"{locale} {width}×{height} create/edit/search/language/read/delete/undo and 200% checks")
            fault_flow(browser, options.origin, locale, options.output)
            print(f"{locale} quota / exact system clipboard / read-only review")
        for width in (375, 390, 430):
            long_reader(browser, options.origin, width)
            print(f"{width}px vertical/horizontal long mixed text, visible end, selection, clipboard, edit return")
        search_and_conflict(browser, options.origin)
        print("Unicode search / RTL excerpt / literal text / privacy-support navigation / zero-note candidate")
        unavailable_preferences(browser, options.origin)
        print("Preference quota, active choice preserved, independent note save")
        unavailable_segmenter(browser, options.origin)
        print("Browser with Segmenter disabled, CSS clamp and full original")
        if options.pseudo_origin:
            pseudo_translation(browser, options.pseudo_origin)
            print("Development-only pseudo translation, narrow recovery screen")
        browser.close()


if __name__ == "__main__":
    main()

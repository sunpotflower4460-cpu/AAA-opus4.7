"""Local verification for the Tsuzuri candidate.

All notes are synthetic. The separate dev-origin check calls the real export
generator directly to inspect styled files without simulating any purchase.
"""

import argparse
import json
from pathlib import Path
import subprocess
from struct import unpack
from zipfile import ZipFile
from urllib.parse import urljoin

from playwright.sync_api import expect, sync_playwright

BODY = "  In stillness, on paper.\n雨のあと「ひかり」。Cafe\u0301 👩🏽‍💻 𠮷\n\n"
AUTHOR = "  A. Cafe\u0301  "
FRONT = "窓の向こう。\nNext line."
AFTER = "Afterword · あとがき  \n"
PRIMARY = "zanshin.notes.v1"
COPY = {
    "ja": {
        "shelf": "綴じた本", "new": "メモを書く", "body": "本文", "notes": "一覧へ",
        "make": "一冊つくる", "untitled": "無題", "next": "仕立てを見る", "bind": "綴じる",
        "back": "戻る", "saved": "一冊を保存しました", "free": "全文の基本PDF", "generate": "ファイルを作成",
        "open": "読む · 無題", "backup": "バックアップと復元", "out": "保存済みデータをJSONに書き出す",
        "file": "バックアップを選ぶ", "import": "確認した内容を追加", "done": "メモと冊子の復元を完了しました。",
        "sample": "見本を見る", "sample_a": "拾った景色", "overview": "全体を見る",
        "everyday": "ふだんの紙と筆あと", "compare": "紙肌を同じ色で比較",
        "styles": "仕立て", "style": "詩の連なり", "basic": "日々の基本",
        "dark": "暗色で読む", "texture": "紙肌を弱める", "lettering": "筆あと",
        "options": "紙・筆あと・表紙を整える", "author": "作者名", "front": "前書き", "after": "あとがき",
        "txt": "原文をTXTで取り出す", "erase_done": "端末内の文章データを削除しました。",
    },
    "en": {
        "shelf": "Bound books", "new": "New note", "body": "Note text", "notes": "Back to notes",
        "make": "Make a book", "untitled": "Untitled", "next": "Choose a style", "bind": "Bind this book",
        "back": "Back", "saved": "Book saved", "free": "Basic PDF with full text", "generate": "Create file",
        "open": "Read · Untitled", "backup": "Backup and restore", "out": "Export saved data as JSON",
        "file": "Choose a backup", "import": "Add the reviewed content", "done": "Notes and books were restored.",
        "sample": "Browse sample books", "sample_a": "Scenes on the way", "overview": "See all panels",
        "everyday": "Everyday paper and lettering", "compare": "Compare texture in one color",
        "styles": "Style", "style": "A string of poems", "basic": "Everyday basics",
        "dark": "Read on a dark background", "texture": "Reduce paper texture", "lettering": "Lettering",
        "options": "Adjust paper, lettering, and cover", "author": "Author", "front": "Preface", "after": "Afterword",
        "txt": "Export original text as TXT", "erase_done": "Writing on this device was erased.",
    },
}


def click(page, copy, key, exact=True, role="button"):
    page.get_by_role(role, name=copy[key], exact=exact).click()


def save_file(page, copy, key, path):
    with page.expect_download(timeout=45000) as captured:
        click(page, copy, key)
    captured.value.save_as(path)


def run_ui(browser, url, out, locale):
    copy = COPY[locale]
    context = browser.new_context(locale=locale, viewport={"width": 390, "height": 844}, accept_downloads=True)
    page = context.new_page()
    page.set_default_timeout(10000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url)
    click(page, copy, "new")
    page.get_by_role("textbox", name=copy["body"], exact=True).fill(BODY)
    page.wait_for_function("(key) => JSON.parse(localStorage.getItem(key) || '[]').some(n => n.body.includes('In stillness'))", arg=PRIMARY)
    click(page, copy, "notes")
    baseline = page.evaluate("(key) => localStorage.getItem(key)", PRIMARY)
    click(page, copy, "shelf")
    click(page, copy, "make")
    page.get_by_role("checkbox", name=copy["untitled"], exact=False).check()
    click(page, copy, "next", exact=False)

    page.locator(".ts-style-details > summary").first.click()
    click(page, copy, "style")
    expect(page.get_by_role("button", name=copy["bind"], exact=True)).to_be_disabled()
    assert page.locator(".ts-paper pre").first.text_content() == BODY
    page.screenshot(path=out / f"{locale}-personal-style.png")
    click(page, copy, "basic")
    page.get_by_text(copy["options"], exact=True).click()
    for key, value in (("author", AUTHOR), ("front", FRONT), ("after", AFTER)):
        page.get_by_role("textbox", name=copy[key], exact=True).fill(value)
    click(page, copy, "bind")
    expect(page.get_by_text(copy["saved"], exact=True)).to_be_visible()
    original = out / f"{locale}-original.txt"
    save_file(page, copy, "txt", original)
    assert original.read_bytes().decode("utf-8") == "\n\n".join((AUTHOR, FRONT, BODY, AFTER))
    click(page, copy, "free")
    page.locator(".ts-output-paper canvas").wait_for()
    pdf = out / f"{locale}-basic.pdf"
    save_file(page, copy, "generate", pdf)
    extracted = subprocess.check_output(["pdftotext", "-raw", pdf, "-"], text=True)
    assert extracted.index("In stillness, on paper.") < extracted.index("雨のあと「ひかり」。")
    assert "Cafe\u0301 👩🏽‍💻 𠮷" in extracted
    assert extracted.index("窓の向こう。") < extracted.index("In stillness") < extracted.index("Afterword")

    click(page, copy, "back")
    click(page, copy, "back")
    click(page, copy, "sample", role="button") if page.get_by_role("button", name=copy["sample"], exact=True).count() else page.get_by_text(copy["sample"], exact=True).click()
    click(page, copy, "sample_a")
    click(page, copy, "overview")
    expect(page.locator(".ts-fold-overview button")).to_have_count(4)
    click(page, copy, "back")

    click(page, copy, "everyday")
    click(page, copy, "compare")
    expect(page.locator(".ts-neutral-papers .ts-paper")).to_have_count(9)
    page.locator(".ts-neutral-papers").screenshot(path=out / f"{locale}-papers.png")
    page.get_by_role("checkbox", name=copy["dark"], exact=True).check()
    page.get_by_role("checkbox", name=copy["texture"], exact=True).check()
    expect(page.locator(".ts-reader")).to_have_attribute("data-dark", "yes")
    expect(page.locator(".ts-reader")).to_have_attribute("data-texture", "reduced")
    for brush in ("BR01", "BR02", "BR03", "BR04"):
        page.get_by_label(copy["lettering"], exact=True).select_option(brush)
        loaded = page.evaluate("""async (brush) => {
          const fonts = await document.fonts.load('18px "Tsuzuri-' + brush + '"', 'あ残心 Café');
          return fonts.length === 1 && fonts[0].status === 'loaded';
        }""", brush)
        assert loaded, brush
    click(page, copy, "back")
    click(page, copy, "backup")
    backup = out / f"{locale}-backup.json"
    save_file(page, copy, "out", backup)
    stored = json.loads(backup.read_text())
    assert stored["notes"][0]["body"] == BODY
    assert stored["library"]["snapshots"][0]["body"] == BODY
    assert stored["library"]["editions"][0]["cover"]["after"] == AFTER
    assert page.evaluate("(key) => localStorage.getItem(key)", PRIMARY) == baseline
    assert not errors, errors
    context.close()

    restored = browser.new_context(locale=locale, viewport={"width": 375, "height": 667})
    page = restored.new_page()
    page.set_default_timeout(10000)
    page.goto(url)
    click(page, copy, "shelf")
    click(page, copy, "backup")
    page.get_by_label(copy["file"]).set_input_files(backup)
    click(page, copy, "import")
    expect(page.get_by_text(copy["done"], exact=True)).to_be_visible()
    page.reload()
    click(page, copy, "shelf")
    click(page, copy, "open")
    assert page.locator(".ts-paper pre").text_content() == BODY
    page.add_style_tag(content="html { font-size: 200% }")
    overflow = page.locator(".ts-dialog").evaluate("""el => [el.scrollWidth, el.clientWidth, [...el.querySelectorAll('*')]
      .filter(node => node.getBoundingClientRect().right > innerWidth + 2 && node.getBoundingClientRect().width > 0)
      .slice(0, 14).map(node => [node.tagName, node.className, node.getBoundingClientRect().right])]""")
    assert overflow[0] <= overflow[1] + 2, overflow
    assert page.locator(".ts-book-aside").last.text_content() == AFTER
    page.evaluate("""localStorage.setItem('zanshin.data-epoch.v1', JSON.stringify({id: 'interrupted', erasing: true}));
      localStorage.setItem('zanshin.notes.corrupt.backup', 'Synthetic recovery copy');""")
    page.reload()
    expect(page.get_by_text(copy["erase_done"], exact=True)).to_be_visible()
    assert page.evaluate("(key) => localStorage.getItem(key)", PRIMARY) is None
    assert page.evaluate("localStorage.getItem('zanshin.notes.corrupt.backup')") is None
    click(page, copy, "shelf")
    expect(page.locator(".ts-shelf-card")).to_have_count(0)
    restored.close()
    print(f"{locale}: original and front/back matter preserved in TXT, PDF and JSON; restored, zoomed to 200%, finished interrupted erase")


def run_order(browser, url):
    copy = COPY["en"]
    page = browser.new_page(locale="en", viewport={"width": 375, "height": 667}, reduced_motion="reduce")
    page.set_default_timeout(10000)
    page.goto(url)
    click(page, copy, "new")
    page.get_by_role("textbox", name=copy["body"], exact=True).fill("One line.")
    page.wait_for_function("JSON.parse(localStorage.getItem('zanshin.notes.v1') || '[]').some(n => n.body === 'One line.')")
    click(page, copy, "notes")
    click(page, copy, "shelf")
    click(page, copy, "make")
    page.get_by_role("checkbox", name="Untitled One line.").check()
    click(page, copy, "next", exact=False)
    click(page, copy, "bind")
    expect(page.get_by_text(copy["saved"], exact=True)).to_be_visible()
    assert page.locator(".ts-paper pre").text_content() == "One line."
    click(page, copy, "back")
    page.get_by_role("button", name="Close", exact=True).click()
    click(page, copy, "new")
    page.get_by_role("textbox", name=copy["body"], exact=True).fill("Second line.")
    page.wait_for_function("JSON.parse(localStorage.getItem('zanshin.notes.v1') || '[]').some(n => n.body === 'Second line.')")
    click(page, copy, "notes")
    click(page, copy, "shelf")
    click(page, copy, "open")
    page.get_by_role("button", name="Arrange", exact=True).click()
    page.get_by_text("Selected passages · 1", exact=True).click()
    page.get_by_role("button", name="Add notes", exact=True).click()
    page.get_by_role("checkbox", name="Untitled Second line.").check()
    click(page, copy, "next", exact=False)
    page.locator(".ts-piece").nth(1).get_by_role("button", name="Move earlier", exact=True).click()
    page.get_by_role("button", name="Bind a new edition", exact=True).click()
    expect(page.get_by_text(copy["saved"], exact=True)).to_be_visible()
    assert page.locator(".ts-paper pre").text_content() == "Second line."
    page.close()
    print("Reduced motion: untitled single line, add a second passage, move earlier, bind and read the new edition")


def run_free_brush(browser, url):
    page = browser.new_page(locale="en", viewport={"width": 390, "height": 844})
    page.add_init_script("""localStorage.setItem("zanshin.prefs.everyday-materials.v1",
      JSON.stringify({ paper: "PA03", brush: "BR01", write: true, subdued: false, dark: false }));""")
    page.goto(url)
    page.get_by_role("button", name="Writing style (Dancing brush)", exact=True).click()
    page.get_by_role("radio", name="Mincho", exact=False).click()
    stored = page.evaluate("JSON.parse(localStorage.getItem('zanshin.prefs.everyday-materials.v1'))")
    assert stored["brush"] is None and stored["paper"] == "PA03"
    page.close()
    print("Existing brush picker: selecting a free brush also applies after an added everyday brush")


def run_restore_polish(browser, url):
    copy = COPY["en"]
    page = browser.new_page(locale="en", viewport={"width": 375, "height": 667})
    page.add_init_script("""(() => {
      const read = File.prototype.text;
      File.prototype.text = async function () {
        if (this.name === 'slow.json') {
          await new Promise(resolve => window.finishSlowBackup = resolve);
          window.readSlowBackup = true;
        }
        return read.call(this);
      };
    })()""")
    page.goto(url)
    click(page, copy, "shelf")
    click(page, copy, "backup")
    field = page.get_by_label(copy["file"])
    time = "2026-11-27T04:00:00Z"
    library = {"schemaVersion": 1, "libraryId": "fixture", "storeRevision": 0, "books": [],
               "editions": [], "snapshots": [], "drafts": [], "presets": [], "hiddenSamples": []}

    def backup(name, titles):
        notes = [{"id": f"note-{i}", "title": title, "body": BODY, "createdAt": time,
                  "updatedAt": time, "isFavorite": False} for i, title in enumerate(titles)]
        archive = {"format": "zanshin.backup", "schemaVersion": 1, "exportedAt": time,
                   "notes": notes, "library": library}
        return {"name": name, "mimeType": "application/json", "buffer": json.dumps(archive).encode()}

    field.set_input_files(backup("slow.json", ["Older choice", "Extra note"]))
    page.wait_for_function("typeof window.finishSlowBackup === 'function'")
    field.set_input_files(backup("chosen.json", ["Chosen note"]))
    expect(page.get_by_text("Notes to add · 1", exact=True)).to_be_visible()
    page.evaluate("window.finishSlowBackup()")
    page.wait_for_function("window.readSlowBackup === true")
    click(page, copy, "import")
    expect(page.get_by_text(copy["done"], exact=True)).to_be_visible()
    restored = json.loads(page.evaluate("(key) => localStorage.getItem(key)", PRIMARY))
    assert [note["title"] for note in restored] == ["Chosen note"]
    assert restored[0]["body"] == BODY
    page.close()
    print("Notes-only restore: the last file selected wins, and only the reviewed note is written")


def run_reader_navigation(browser, url, out):
    copy = COPY["en"]
    page = browser.new_page(locale="en", viewport={"width": 375, "height": 667}, accept_downloads=True)
    text = "\n".join(f"Line {index:02}. 窓辺に光。This is a long passage." for index in range(1, 81))
    time = "2026-11-27T04:00:00Z"
    note = {"id": "long-note", "title": "Morning reflections", "body": text, "createdAt": time,
            "updatedAt": time, "isFavorite": False}
    original = json.dumps([note])
    page.add_init_script(f"localStorage.setItem({json.dumps(PRIMARY)}, {json.dumps(original)})")
    page.goto(url)
    click(page, copy, "shelf")
    click(page, copy, "make")
    page.get_by_role("checkbox", name="Morning reflections", exact=False).check()
    click(page, copy, "next", exact=False)
    click(page, copy, "bind")
    expect(page.get_by_text(copy["saved"], exact=True)).to_be_visible()
    page.add_style_tag(content="html { font-size: 200% }")
    viewport = page.locator(".ts-dialog")
    pane = page.locator(".ts-reading")
    axis = "scrollLeft" if pane.get_attribute("data-direction") == "vertical" else "scrollTop"
    offset = -280 if axis == "scrollLeft" else 280
    pane.evaluate("(el, [axis, offset]) => { el[axis] = offset; }", [axis, offset])
    assert pane.evaluate("(el, axis) => el[axis]", axis) == offset
    button = page.get_by_role("button", name=copy["free"], exact=True)
    button.scroll_into_view_if_needed()
    prior = viewport.evaluate("el => el.scrollTop")
    assert prior > 100
    button.click()
    expect(page.get_by_role("heading", name="Preview the output")).to_be_in_viewport()
    assert viewport.evaluate("el => el.scrollTop") <= 2
    page.get_by_role("button", name=copy["back"], exact=True).press("Enter")
    expect(button).to_be_focused()
    restored_top = viewport.evaluate("el => el.scrollTop")
    assert abs(restored_top - prior) < 12, (restored_top, prior)
    assert abs(pane.evaluate("(el, axis) => el[axis]", axis) - offset) <= 2
    saved = json.loads(page.evaluate("(key) => localStorage.getItem(key)", PRIMARY))
    assert saved == [note]
    print("Output at 200%: opens at the top, returns to the exact passage and triggering control")

    # Reopen a foldbook through the same validated import available without purchase.
    click(page, copy, "back")
    click(page, copy, "backup")
    backup = out / "long-reader.json"
    save_file(page, copy, "out", backup)
    archive = json.loads(backup.read_text())
    archive["library"]["editions"][0]["appearance"]["format"] = "BK02"
    page.close()
    page = browser.new_page(locale="en", viewport={"width": 375, "height": 667})
    page.goto(url)
    click(page, copy, "shelf")
    click(page, copy, "backup")
    page.get_by_label(copy["file"]).set_input_files({
        "name": "foldbook.json", "mimeType": "application/json", "buffer": json.dumps(archive).encode(),
    })
    click(page, copy, "import")
    expect(page.get_by_text(copy["done"], exact=True)).to_be_visible()
    click(page, copy, "back")
    page.get_by_role("button", name="Read · Morning reflections", exact=True).click()
    pane = page.locator(".ts-reading")
    pane.evaluate("(el, [axis, offset]) => { el[axis] = offset; }", [axis, offset])
    assert pane.evaluate("(el, axis) => el[axis]", axis) == offset
    click(page, copy, "overview")
    expect(page.locator(".ts-fold-overview")).to_be_visible()
    page.locator('button[aria-pressed="true"]').filter(has_text="Read").click()
    expect(pane).to_be_visible()
    assert abs(pane.evaluate("(el, axis) => el[axis]", axis) - offset) <= 2
    page.close()
    print("Foldbook: the same passage and position remain after the overview")


def run_files(browser, origin, out):
    page = browser.new_page(accept_downloads=True)
    page.goto(origin)
    for kind in ("pdf", "zip"):
        with page.expect_download(timeout=120000) as captured:
            pages = page.evaluate(r"""async (kind) => {
              const { prepareLayout, bookPdf, imagesZip } = await import('/src/tsuzuri/output.ts');
              const appearance = { paper: 'PA02', brush: 'BR02', cover: 'CV01', format: 'BK03',
                direction: kind === 'pdf' ? 'vertical' : 'horizontal', binding: 'right', ink: 'clear' };
              const body = kind === 'pdf'
                ? '始端 Cairo Café 👩🏽‍💻\n' + '短い文章を繰り返す。かな、漢字。'.repeat(640) + '\n' +
                    'https://example.test/' + 'long-path/'.repeat(40) + '?key=word\n終端 end𠮷'
                : '始端\n' + '長文の画像を複数の面へ。'.repeat(170) + '\n終端';
              const layout = await prepareLayout({ text: [{ title: '確認用', body }], appearance, size: 'A6', surface: 'paper' });
              const file = kind === 'pdf' ? await bookPdf(layout) : await imagesZip(layout);
              const link = document.createElement('a');
              link.href = URL.createObjectURL(file);
              link.download = 'tsuzuri-styled.' + kind;
              link.click();
              return layout.pages.length;
            }""", kind)
        path = out / f"styled.{kind}"
        captured.value.save_as(path)
        assert pages > 1
        if kind == "pdf":
            text = subprocess.check_output(["pdftotext", "-raw", path, "-"], text=True)
            compact = "".join(text.split())
            assert "始端 Cairo Café 👩🏽‍💻" in text
            assert "終端 end𠮷" in text
            assert "短い文章を繰り返す。かな、漢字。" * 640 in compact
            assert "https://example.test/" + "long-path/" * 40 + "?key=word" in compact
            assert "ShipporiMincho" in subprocess.check_output(["pdffonts", path], text=True)
        else:
            with ZipFile(path) as zip_file:
                assert zip_file.testzip() is None
                names = zip_file.namelist()
                assert len(names) == pages and names == sorted(names)
                for name in names:
                    image = zip_file.read(name)
                    assert image.startswith(b"\x89PNG\r\n\x1a\n")
                    assert max(unpack(">II", image[16:24])) == 2048
                (out / "styled-page-001.png").write_bytes(zip_file.read(names[0]))
        print(f"styled {kind}: {pages} pages, extracted text or PNG dimensions verified")
    for count in (10, 100):
        pages, elapsed = page.evaluate("""async (count) => {
          const { prepareLayout } = await import('/src/tsuzuri/output.ts');
          const started = performance.now();
          const text = Array.from({ length: count }, (_, i) => ({ title: String(i + 1), body: 'A line. ひとこと。' }));
          const appearance = { paper: 'washi', brush: 'mincho', cover: 'plain', format: 'BK01',
            direction: 'horizontal', binding: 'left', ink: 'clear' };
          const layout = await prepareLayout({ text, appearance, size: 'A5', surface: 'white' });
          if (!layout.pages.flatMap(page => page.lines).some(line => line.text === String(count))) throw new Error('Missing the final passage');
          return [layout.pages.length, performance.now() - started];
        }""", count)
        print(f"{count} passages: {pages} output pages; layout only {elapsed:.0f} ms (Linux)")
    page.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("origin")
    parser.add_argument("output", type=Path)
    parser.add_argument("--dev-origin")
    parser.add_argument("--webkit", nargs="?", const="", help="Use WebKit with an optional executable")
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.webkit.launch(executable_path=args.webkit or None) if args.webkit is not None else playwright.chromium.launch(
            executable_path=args.chromium, args=["--no-sandbox"])
        print(f"{browser.browser_type.name} {browser.version} at {urljoin(args.origin, '/')}")
        for locale in ("ja", "en"):
            run_ui(browser, args.origin, args.output, locale)
        run_free_brush(browser, args.origin)
        run_restore_polish(browser, args.origin)
        run_reader_navigation(browser, args.origin, args.output)
        if not args.webkit:
            run_order(browser, args.origin)
        if args.dev_origin:
            run_files(browser, args.dev_origin, args.output)
        browser.close()


if __name__ == "__main__":
    main()

import { BRUSH_FILES, PAPERS, brushFamily, paperId, paperTexture } from "./catalog";
import { fileBlob } from "./exportFile";
import { layoutPages, paintText, type Layout } from "./pageLayout";

const fonts = new Map<string, Promise<ArrayBuffer>>();
const textures = new Map<string, HTMLImageElement>();

async function loadTexture(paper: string) {
  const url = paperTexture(paper);
  if (!url || textures.has(paper)) return;
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = url;
  });
  textures.set(paper, image);
}

function bundledFont(id: keyof typeof BRUSH_FILES) {
  const cached = fonts.get(id);
  if (cached) return cached;
  const loading = (async () => {
    const response = await fetch(`/fonts/tsuzuri/${BRUSH_FILES[id]}`);
    if (!response.ok) throw new Error("fontLoad");
    const bytes = await response.arrayBuffer();
    if (id === "base") {
      const face = new FontFace("Tsuzuri-base", bytes);
      await face.load();
      document.fonts.add(face);
    }
    return bytes;
  })();
  fonts.set(id, loading);
  void loading.catch(() => fonts.delete(id));
  return loading;
}

function canvas(width: number, height: number) {
  const node = document.createElement("canvas");
  node.width = width;
  node.height = height;
  const context = node.getContext("2d");
  if (!context) throw new Error("exportFailed");
  return { node, context };
}

export async function prepareLayout(options: Parameters<typeof layoutPages>[1]) {
  await Promise.all([bundledFont("base"), loadTexture(options.appearance.paper)]);
  const { brush } = options.appearance;
  if (brush !== "mincho") {
    if (Object.prototype.hasOwnProperty.call(BRUSH_FILES, brush)) await bundledFont(brush as keyof typeof BRUSH_FILES);
    const sample = options.text.map((piece) => piece.title + piece.body).join("");
    await document.fonts.load(`14px ${brushFamily(brush, true)}`, sample || "残心 Aa");
  }
  return layoutPages(canvas(1, 1).context, options);
}

export function paintPage(layout: Layout, index: number, longEdge: number) {
  const { width, height, pages, appearance, surface } = layout;
  const scale = longEdge / Math.max(width, height);
  const { node, context } = canvas(Math.round(width * scale), Math.round(height * scale));
  context.scale(scale, scale);
  const paper = PAPERS[paperId(appearance.paper)];
  context.fillStyle = surface === "white" ? "#ffffff" : paper.ground;
  context.fillRect(0, 0, width, height);
  const texture = textures.get(appearance.paper);
  if (surface !== "white" && texture) {
    context.save();
    context.globalAlpha = surface === "light" ? 0.32 : 1;
    if (index % 2) { context.translate(width, 0); context.scale(-1, 1); }
    context.drawImage(texture, 0, 0, width, height);
    context.restore();
  }
  if (pages[index].cover) paintCover(context, layout);
  context.fillStyle = surface === "white" ? "#241f1b" : paper.ink;
  if (appearance.ink === "soft") context.globalAlpha = 0.89;
  paintText(context, pages[index], appearance);
  return node;
}

function paintCover(context: CanvasRenderingContext2D, layout: Layout) {
  const { width, height, appearance, surface } = layout;
  const border = surface !== "white" && appearance.paper === "PA08" ? "#d7c090" : "#a08251";
  context.strokeStyle = border;
  context.fillStyle = border;
  switch (appearance.cover) {
    case "CV01":
      if (appearance.direction === "vertical") context.strokeRect(width - 59, 22, 35, height - 44);
      else context.strokeRect(22, height * 0.22 - 11, width - 44, 52);
      break;
    case "CV02": {
      const x = appearance.binding === "right" ? width - 16 : 0;
      context.fillRect(x, 0, 16, height);
      context.strokeStyle = "#fbf8ef";
      context.globalAlpha = 0.4;
      for (let i = 2; i < 16; i += 3) {
        context.beginPath(); context.moveTo(x + i, 0); context.lineTo(x + i, height); context.stroke();
      }
      context.globalAlpha = 1;
      break;
    }
    case "CV03":
      context.beginPath();
      context.moveTo(0, height - 70); context.lineTo(width / 2, height - 19);
      context.lineTo(width, height - 70); context.stroke();
      break;
    case "CV04": context.fillRect(0, height - 67, width, 8); break;
    case "CV05": context.strokeRect(width - 48, height - 52, 20, 20); break;
    case "CV06": context.strokeRect(14, 14, width - 28, height - 28); break;
  }
}

export function pagePng(layout: Layout, index: number): Promise<Blob> {
  const node = paintPage(layout, index, 2048);
  return new Promise((resolve, reject) => node.toBlob((blob) => {
    node.width = 0;
    if (blob) resolve(blob);
    else reject(new Error("exportFailed"));
  }, "image/png"));
}

export async function bookPdf(layout: Layout): Promise<Blob> {
  const [api, fontkit, fontBytes] = await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit"), bundledFont("base")]);
  const {
    PDFDocument, PDFHexString, PDFName, PDFOperator, PDFOperatorNames, beginText, endText,
    setFontAndSize, setTextMatrix, showText, setTextRenderingMode, TextRenderingMode,
  } = api;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit.default);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const characters = new Set(font.getCharacterSet());
  for (const [index, pageLayout] of layout.pages.entries()) {
    const page = pdf.addPage([layout.width, layout.height]);
    const raster = paintPage(layout, index, 1540);
    const image = await pdf.embedJpg(raster.toDataURL("image/jpeg", 0.92));
    raster.width = 0;
    page.drawImage(image, { x: 0, y: 0, width: layout.width, height: layout.height });
    const fontKey = page.node.newFontDictionary(font.name, font.ref);
    for (const line of pageLayout.lines) {
      if (line.text.length === 0) continue;
      let supported = "";
      for (const char of line.text) supported += characters.has(char.codePointAt(0)!) ? char : "□";
      supported = supported.trim() ? supported : "□";
      // PDF marked content preserves the original Unicode, including clusters that
      // the browser draws with a fallback face. The page image never stands alone.
      const width = font.widthOfTextAtSize(supported, line.size);
      const scale = line.advance > 0 && width > 0 ? line.advance / width : 1;
      const matrix = line.vertical
        ? setTextMatrix(0, -scale, 1, 0, line.x + line.size / 2, layout.height - line.y)
        : setTextMatrix(scale, 0, 0, 1, line.rtl ? line.x - line.advance : line.x, layout.height - line.y);
      page.pushOperators(
        beginText(), setFontAndSize(fontKey, line.size), matrix, setTextRenderingMode(TextRenderingMode.Invisible),
        PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
          PDFName.of("Span"), pdf.context.obj({ ActualText: PDFHexString.fromText(line.text) }).toString(),
        ]),
        showText(font.encodeText(supported)),
        PDFOperator.of(PDFOperatorNames.EndMarkedContent), endText(),
      );
    }
  }
  return fileBlob(await pdf.save(), "application/pdf");
}

export async function imagesZip(layout: Layout): Promise<Blob> {
  const { zipSync } = await import("fflate");
  const pages: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (let index = 0; index < layout.pages.length; index++) {
    const blob = await pagePng(layout, index);
    pages[`zanshin-page-${String(index + 1).padStart(3, "0")}.png`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  }
  return fileBlob(zipSync(pages), "application/zip");
}

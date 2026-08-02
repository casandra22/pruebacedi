// Genera el listado de Novedades (novedades.html) y el resumen de las
// 3 más recientes (index.html) a partir del Google Sheet publicado como
// CSV. Sin dependencias externas (parser de CSV propio) para no
// necesitar npm install en el GitHub Action. Ver .claude/NO_NEGOCIABLES.md.
//
// Uso: node scripts/build-novedades.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQksVyXCArKYXB2yqQVi4S74gK1nz4v2bbhvmLDUq_yuIX5xLoI8m24CRk3BIHsZe0KtGcBj7I5IocP/pub?output=csv";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NOVEDADES_HTML = path.join(ROOT, "novedades.html");
const INDEX_HTML = path.join(ROOT, "index.html");
const IMG_DIR = path.join(ROOT, "assets", "img");

const IMG_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\r") {
      // ignorado, se procesa el \n que sigue
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkify(escapedText) {
  return escapedText.replace(/(https?:\/\/[^\s<]+)/g, (match) => {
    let trail = "";
    while (match.length && /[.,;:!?)\]"']/.test(match[match.length - 1])) {
      trail = match[match.length - 1] + trail;
      match = match.slice(0, -1);
    }
    return `<a href="${match}" target="_blank" rel="noopener noreferrer">${match}<span class="visually-hidden"> (se abre en una pestaña nueva)</span></a>${trail}`;
  });
}

function bodyToHtml(cuerpo) {
  const lines = cuerpo.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const blocks = [];
  let currentList = null;
  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (!currentList) { currentList = []; blocks.push({ type: "ul", items: currentList }); }
      currentList.push(line.slice(2).trim());
    } else {
      currentList = null;
      blocks.push({ type: "p", text: line });
    }
  }
  return blocks
    .map((b) => {
      if (b.type === "p") return `                  <p>${linkify(escapeHtml(b.text))}</p>`;
      const items = b.items.map((i) => `                    <li>${linkify(escapeHtml(i))}</li>`).join("\n");
      return `                  <ul>\n${items}\n                  </ul>`;
    })
    .join("\n");
}

function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFecha(raw) {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { y: +m[3], mo: +m[2], d: +m[1] };
  return null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function spliceBetween(content, startMarker, endMarker, innerHtml, endIndent) {
  const re = new RegExp(escapeRegex(startMarker) + "[\\s\\S]*?" + escapeRegex(endMarker));
  if (!re.test(content)) {
    throw new Error(`No se encontró el marcador "${startMarker}" — revisar el HTML.`);
  }
  return content.replace(re, `${startMarker}\n${innerHtml}\n${endIndent}${endMarker}`);
}

function extractDriveId(link) {
  const s = link.trim();
  let m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/); // .../file/d/ID/view
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/); // .../open?id=ID o .../uc?id=ID
  if (m) return m[1];
  return null;
}

function detectImageExt(buffer, contentType) {
  if (buffer.length >= 4) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "gif";
    if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  }
  if (contentType) {
    if (contentType.includes("jpeg")) return "jpg";
    if (contentType.includes("png")) return "png";
    if (contentType.includes("webp")) return "webp";
    if (contentType.includes("gif")) return "gif";
  }
  return "jpg";
}

function findExistingImage(baseName) {
  for (const ext of IMG_EXTS) {
    const p = path.join(IMG_DIR, `${baseName}.${ext}`);
    if (fs.existsSync(p)) return `${baseName}.${ext}`;
  }
  return null;
}

async function resolveDriveImage(link, baseName, tituloLabel) {
  const existing = findExistingImage(baseName);
  if (existing) return existing; // ya descargada en un build anterior, no se vuelve a bajar

  const id = extractDriveId(link);
  if (!id) {
    console.warn(`"${tituloLabel}": no pude reconocer el link de Drive "${link}" — la novedad se publica sin foto.`);
    return "";
  }

  let res;
  try {
    res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`, { redirect: "follow" });
  } catch (err) {
    console.warn(`"${tituloLabel}": falló la descarga desde Drive (${err.message}) — se publica sin foto.`);
    return "";
  }
  if (!res.ok) {
    console.warn(`"${tituloLabel}": Drive devolvió HTTP ${res.status} al bajar la foto — se publica sin foto. Revisar que el link tenga "Cualquier persona con el enlace" habilitado.`);
    return "";
  }

  const contentType = res.headers.get("content-type") || "";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (contentType.includes("text/html") || buffer.length < 200) {
    console.warn(`"${tituloLabel}": Drive no devolvió una imagen válida (¿el link no es público, o el archivo no es una foto?) — se publica sin foto.`);
    return "";
  }

  const ext = detectImageExt(buffer, contentType);
  const filename = `${baseName}.${ext}`;
  fs.mkdirSync(IMG_DIR, { recursive: true });
  fs.writeFileSync(path.join(IMG_DIR, filename), buffer);
  console.log(`"${tituloLabel}": foto descargada de Drive -> assets/img/${filename}`);
  return filename;
}

async function resolveImage(value, baseName, tituloLabel) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    return resolveDriveImage(value, baseName, tituloLabel);
  }
  // No es un link: se interpreta como el nombre de un archivo ya subido a mano a assets/img/.
  if (!fs.existsSync(path.join(IMG_DIR, value))) {
    console.warn(`"${tituloLabel}": no encontré assets/img/${value} — la novedad se publica sin foto.`);
    return "";
  }
  return value;
}

async function main() {
  const res = await fetch(CSV_URL);
  if (!res.ok) {
    throw new Error(`No se pudo descargar el Sheet publicado (HTTP ${res.status}).`);
  }
  let text = await res.text();
  text = text.replace(/^﻿/, "");

  const rows = parseCSV(text).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) {
    throw new Error("El CSV vino vacío, ni siquiera tiene encabezados. Aborto sin tocar el HTML.");
  }
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);

  const items = [];
  for (const [idx, row] of dataRows.entries()) {
    const rowNum = idx + 2; // +1 por encabezado, +1 por índice base 1
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] ?? "").trim(); });

    const fechaParsed = parseFecha(obj.fecha || "");
    if (!fechaParsed || !obj.titulo || !obj.resumen || !obj.cuerpo) {
      console.warn(`Fila ${rowNum} salteada: faltan datos obligatorios (fecha/titulo/resumen/cuerpo). Título: "${obj.titulo || "(sin título)"}"`);
      continue;
    }

    let tipo = (obj.tipo || "").trim().toLowerCase();
    if (tipo !== "actividad" && tipo !== "noticia") {
      console.warn(`Fila ${rowNum} ("${obj.titulo}"): tipo "${obj.tipo}" no es válido, se usa "actividad" por defecto.`);
      tipo = "actividad";
    }

    const imagenAlt = (obj.imagen_alt || "").trim();

    const { y, mo, d } = fechaParsed;
    const sortKey = `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const fechaDisplay = `${d} de ${MESES[mo - 1]} de ${y}`;

    items.push({
      titulo: obj.titulo,
      resumen: obj.resumen,
      cuerpo: obj.cuerpo,
      tipo,
      year: y,
      sortKey,
      fechaDisplay,
      imagen_link: (obj.imagen_link || "").trim(),
      imagen_alt: imagenAlt,
      link_texto: (obj.link_texto || "").trim(),
      link_url: (obj.link_url || "").trim(),
    });
  }

  if (items.length === 0) {
    throw new Error("Ninguna fila del Sheet tiene los datos obligatorios completos. Aborto sin tocar el HTML para no vaciar el sitio.");
  }

  items.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));

  const usedSlugs = new Set();
  for (const item of items) {
    let base = slugify(item.titulo) || "novedad";
    let slug = base;
    let n = 2;
    while (usedSlugs.has(slug)) { slug = `${base}-${n}`; n++; }
    usedSlugs.add(slug);
    item.slug = slug;
  }

  for (const item of items) {
    item.imagen_archivo = await resolveImage(item.imagen_link, `novedad-${item.slug}`, item.titulo);
  }

  function renderArticle(item) {
    const tagLabel = item.tipo === "noticia" ? "Noticia" : "Actividad";
    const mediaBlock = item.imagen_archivo
      ? `
                <a class="post-image-link" href="assets/img/${item.imagen_archivo}">
                  <div class="news-card-media">
                    <img src="assets/img/${item.imagen_archivo}" alt="${escapeHtml(item.imagen_alt)}" loading="lazy">
                  </div>
                  <span class="post-image-zoom-hint" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6"/><path d="M21 21l-4.3-4.3"/></svg>
                  </span>
                  <span class="visually-hidden"> — Ver foto completa</span>
                </a>`
      : "";
    const linkBlock = item.link_url
      ? `\n                  <a class="news-card-link" href="${escapeHtml(item.link_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.link_texto || item.link_url)}<span class="visually-hidden"> (se abre en una pestaña nueva)</span> →</a>`
      : "";

    return `            <article class="news-card" id="${item.slug}" data-animate data-type="${item.tipo}">
              <div class="news-card-inner">${mediaBlock}
                <div class="news-card-body">
                  <span class="news-tag news-tag--${item.tipo}">${tagLabel}</span>
                  <span class="news-date">${item.fechaDisplay}</span>
                  <h2>${escapeHtml(item.titulo)}</h2>
${bodyToHtml(item.cuerpo)}${linkBlock}
                </div>
              </div>
            </article>`;
  }

  function renderPreviewCard(item) {
    const mediaBlock = item.imagen_archivo
      ? `
            <div class="news-card-media">
              <img src="assets/img/${item.imagen_archivo}" alt="${escapeHtml(item.imagen_alt)}" loading="lazy">
            </div>`
      : "";
    return `          <a class="news-card" href="novedades.html#${item.slug}" data-animate>${mediaBlock}
            <div class="news-card-body">
              <span class="news-tag news-tag--${item.tipo}">${item.tipo === "noticia" ? "Noticia" : "Actividad"}</span>
              <span class="news-date">${item.fechaDisplay}</span>
              <h3>${escapeHtml(item.titulo)}</h3>
              <p>${linkify(escapeHtml(item.resumen))}</p>
            </div>
          </a>`;
  }

  const years = [...new Set(items.map((it) => it.year))].sort((a, b) => b - a);

  const listaHtml = years
    .map((year) => {
      const articles = items.filter((it) => it.year === year).map(renderArticle).join("\n");
      return `          <p id="year-${year}" class="post-year-marker">${year}</p>\n          <div class="post-list">\n${articles}\n          </div>`;
    })
    .join("\n\n");

  const añosHtml = years.map((y) => `                <li><a href="#year-${y}">${y}</a></li>`).join("\n");

  const previewHtml = items.slice(0, 3).map(renderPreviewCard).join("\n");

  let novedadesContent = fs.readFileSync(NOVEDADES_HTML, "utf8");
  novedadesContent = spliceBetween(
    novedadesContent,
    "<!-- NOVEDADES:LISTA:START -->",
    "<!-- NOVEDADES:LISTA:END -->",
    listaHtml,
    "          "
  );
  novedadesContent = spliceBetween(
    novedadesContent,
    "<!-- NOVEDADES:AÑOS:START -->",
    "<!-- NOVEDADES:AÑOS:END -->",
    añosHtml,
    "                "
  );
  fs.writeFileSync(NOVEDADES_HTML, novedadesContent);

  let indexContent = fs.readFileSync(INDEX_HTML, "utf8");
  indexContent = spliceBetween(
    indexContent,
    "<!-- NOVEDADES-PREVIEW:START -->",
    "<!-- NOVEDADES-PREVIEW:END -->",
    previewHtml,
    "          "
  );
  fs.writeFileSync(INDEX_HTML, indexContent);

  console.log(`Listo: ${items.length} novedades procesadas, ${years.length} año(s) (${years.join(", ")}).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

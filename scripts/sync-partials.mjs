// Genera el header y el footer de las 11 páginas a partir de una única
// fuente acá abajo (NAV), para no tener que editar el menú/footer a mano
// en cada archivo. Sin dependencias externas, mismo criterio que
// build-novedades.mjs. Ver .claude/NO_NEGOCIABLES.md.
//
// Uso: node scripts/sync-partials.mjs
//
// Importante: el header y el footer de las 11 páginas dejan de ser la
// fuente de verdad. Para cambiar el menú o el footer, se edita este
// archivo (NAV / FOOTER_ADDRESS / etc.) y se corre este script — nunca
// a mano en index.html, biblioteca.html, etc., porque el próximo
// "node scripts/sync-partials.mjs" pisaría ese cambio.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const PAGES = [
  "index.html",
  "quienes-somos.html",
  "equipo.html",
  "distinciones.html",
  "novedades.html",
  "servicios.html",
  "investigacion.html",
  "publicaciones-especiales.html",
  "articulos-academicos.html",
  "biblioteca.html",
  "contacto.html",
];

// Estructura del menú principal. Cada entrada de nivel superior es un
// link suelto o un dropdown con submenú. "href" de un dropdown es la
// página a la que apunta su propio link (normalmente la primera del
// submenú).
const NAV = [
  { href: "index.html", label: "Inicio" },
  {
    href: "quienes-somos.html",
    label: "Quiénes somos",
    submenu: [
      { href: "quienes-somos.html", label: "Nuestra historia" },
      { href: "equipo.html", label: "Equipo CEDILIJ" },
      { href: "distinciones.html", label: "Distinciones" },
    ],
  },
  { href: "novedades.html", label: "Novedades" },
  { href: "servicios.html", label: "Servicios" },
  {
    href: "investigacion.html",
    label: "Investigación",
    submenu: [
      { href: "investigacion.html", label: "Revista Piedra Libre" },
      { href: "publicaciones-especiales.html", label: "Publicaciones especiales" },
      { href: "articulos-academicos.html", label: "Artículos académicos" },
    ],
  },
  {
    href: "biblioteca.html",
    label: "Biblioteca",
    submenu: [
      { href: "biblioteca.html#servicios-bibliotecarios", label: "Servicios bibliotecarios" },
      { href: "biblioteca.html#asociate", label: "Asociate" },
      { href: "https://cedilij.puntobiblio.com/", label: "Catálogo", external: true },
    ],
  },
  { href: "contacto.html", label: "Contacto", isButton: true },
];

function basename(href) {
  return href.split("#")[0];
}

function slugify(href) {
  return basename(href).replace(/\.html$/, "");
}

const CHEVRON_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const EXTERNAL_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>';

function renderNavItem(item, currentBasename) {
  if (!item.submenu) {
    const current = basename(item.href) === currentBasename;
    const cls = item.isButton ? ' class="nav-catalog-btn"' : "";
    const ariaCurrent = current ? ' aria-current="page"' : "";
    return `        <a href="${item.href}"${cls}${ariaCurrent}>${item.label}</a>`;
  }

  const isActive = item.submenu.some((sub) => !sub.external && basename(sub.href) === currentBasename);
  const submenuId = `nav-submenu-${slugify(item.href)}`;
  let markedCurrent = false;
  const items = item.submenu
    .map((sub) => {
      if (sub.external) {
        return `            <li><a href="${sub.href}" target="_blank" rel="noopener noreferrer" class="nav-submenu-external">${sub.label}${EXTERNAL_SVG}<span class="visually-hidden"> (se abre en una pestaña nueva)</span></a></li>`;
      }
      const isCurrent = !markedCurrent && basename(sub.href) === currentBasename;
      if (isCurrent) markedCurrent = true;
      const ariaCurrent = isCurrent ? ' aria-current="page"' : "";
      return `            <li><a href="${sub.href}"${ariaCurrent}>${sub.label}</a></li>`;
    })
    .join("\n");

  return `        <div class="nav-dropdown${isActive ? " is-active" : ""}">
          <a href="${item.href}" class="nav-dropdown-link">${item.label}</a>
          <button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-controls="${submenuId}" aria-label="Mostrar submenú de ${item.label}">
            ${CHEVRON_SVG}
          </button>
          <ul class="nav-submenu" id="${submenuId}">
${items}
          </ul>
        </div>`;
}

function renderHeader(pageFile) {
  const currentBasename = pageFile;
  const hasHero = pageFile === "index.html";
  const brand = hasHero
    ? `        <span class="brand-logo">
          <img class="brand-logo-color" src="assets/img/logo-cedilij.png" alt="" width="55" height="40">
          <img class="brand-logo-white" src="assets/img/logo-cedilij-white-cutout.png" alt="" width="55" height="40" aria-hidden="true">
        </span>
        <span class="brand-text">
          <strong>cedilij</strong>
        </span>`
    : `        <img src="assets/img/logo-cedilij.png" alt="" width="55" height="40">
        <span class="brand-text">
          <strong>cedilij</strong>
        </span>`;

  const navItems = NAV.map((item) => renderNavItem(item, currentBasename)).join("\n");

  return `<header class="site-header">
    <div class="nav-bar">
      <a class="brand" href="index.html">
${brand}
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="Abrir menú de navegación">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18"/>
        </svg>
      </button>
      <nav class="nav-menu" id="nav-menu" aria-label="Principal">
${navItems}
      </nav>
    </div>
  </header>`;
}

// Los 7 links de nivel superior del footer (mismo orden fijo en las 11
// páginas), derivados de NAV para no repetir la lista a mano.
const FOOTER_NAV = NAV.map((item) => ({ href: basename(item.href), label: item.label }));

function renderFooterNav(currentBasename) {
  return FOOTER_NAV.map((item) => {
    const ariaCurrent = item.href === currentBasename ? ' aria-current="page"' : "";
    return `            <li><a href="${item.href}"${ariaCurrent}>${item.label}</a></li>`;
  }).join("\n");
}

function renderFooter(pageFile) {
  return `<footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <img class="footer-brand-bird" src="assets/img/logo-cedilij-white-cutout.png" alt="" width="45" height="33">
          <h2 class="footer-brand-name">cedilij</h2>
          <p>Centro de Difusión e Investigación de Literatura Infantil y Juvenil. Córdoba, Argentina.</p>
        </div>
        <div>
          <h3>Navegación</h3>
          <ul>
${renderFooterNav(pageFile)}
          </ul>
        </div>
        <div>
          <h3>Dirección</h3>
          <p>Pasaje Revol 56, B.º Güemes, Córdoba</p>
          <div class="footer-map">
            <iframe class="footer-map-embed" src="https://maps.google.com/maps?q=Cedilij,+Pasaje+Revol+56,+C%C3%B3rdoba&z=17&output=embed" title="Mapa: CEDILIJ, Pasaje Revol 56, Barrio Güemes, Córdoba" loading="lazy"></iframe>
          </div>
          <a class="footer-map-link" href="https://maps.app.goo.gl/PSmqAt9gFaP3ftS48" target="_blank" rel="noopener noreferrer">Ver mapa más grande<span class="visually-hidden"> (se abre en una pestaña nueva)</span></a>
        </div>
        <div>
          <h3>Horarios</h3>
          <p>Martes y jueves<br>9:30 a 12:30 h y 14:30 a 17:30 h<br>Sábados (cada 15 días)<br>16:30 a 19:30 h</p>
          <h3>Contacto</h3>
          <ul>
            <li class="footer-contact-whatsapp">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <a href="https://wa.me/5493518175972" target="_blank" rel="noopener noreferrer">+54 9 351 817-5972<span class="visually-hidden"> por WhatsApp (se abre en una pestaña nueva)</span></a>
            </li>
            <li><a href="mailto:cedilijargentina@gmail.com">cedilijargentina@gmail.com</a></li>
            <li class="footer-social">
              <a href="https://www.instagram.com/cedilij/" target="_blank" rel="noopener noreferrer" aria-label="Instagram (se abre en una pestaña nueva)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/></svg>
              </a>
              <a href="https://www.facebook.com/cedilij/" target="_blank" rel="noopener noreferrer" aria-label="Facebook (se abre en una pestaña nueva)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M14 8h-1.5A2.5 2.5 0 0 0 10 10.5V12M8 12h5M11 12v6"/></svg>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© <span data-year></span> CEDILIJ. Todos los derechos reservados.</p>
      </div>
    </div>
  </footer>`;
}

function replaceBetween(content, openTag, closeTag, replacement, file) {
  const start = content.indexOf(openTag);
  const end = content.indexOf(closeTag);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No encontré "${openTag}"..."${closeTag}" en ${file}`);
  }
  return content.slice(0, start) + replacement + content.slice(end + closeTag.length);
}

for (const file of PAGES) {
  const filePath = path.join(ROOT, file);
  let content = fs.readFileSync(filePath, "utf8");

  content = replaceBetween(content, "<header class=\"site-header\">", "</header>", renderHeader(file), file);
  content = replaceBetween(content, "<footer class=\"site-footer\">", "</footer>", renderFooter(file), file);

  fs.writeFileSync(filePath, content, "utf8");
  console.log("OK:", file);
}

console.log(`Listo: header y footer regenerados en ${PAGES.length} páginas.`);

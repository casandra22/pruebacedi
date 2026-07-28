(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.querySelector(".nav-menu");

  var closeSubmenus = function () {
    document
      .querySelectorAll('.nav-dropdown-toggle[aria-expanded="true"]')
      .forEach(function (btn) {
        btn.setAttribute("aria-expanded", "false");
      });
  };

  if (toggle && header && menu) {
    var setToggleLabel = function (isOpen) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute(
        "aria-label",
        isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"
      );
    };

    toggle.addEventListener("click", function () {
      var isOpen = header.classList.toggle("nav-open");
      setToggleLabel(isOpen);
      if (!isOpen) closeSubmenus();
    });

    menu.addEventListener("click", function (event) {
      if (event.target.tagName === "A" && header.classList.contains("nav-open")) {
        header.classList.remove("nav-open");
        setToggleLabel(false);
        closeSubmenus();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && header.classList.contains("nav-open")) {
        header.classList.remove("nav-open");
        setToggleLabel(false);
        closeSubmenus();
        toggle.focus();
      }
    });
  }

  // Submenú "Quiénes somos" en el nav: clic alterna aria-expanded.
  // En desktop, hover/foco ya lo muestran vía CSS (:hover/:focus-within);
  // esto cubre el clic directo y pantallas táctiles.
  document.querySelectorAll(".nav-dropdown-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var wasOpen = btn.getAttribute("aria-expanded") === "true";
      closeSubmenus();
      btn.setAttribute("aria-expanded", String(!wasOpen));
    });
  });

  document.addEventListener("click", function (event) {
    document
      .querySelectorAll('.nav-dropdown-toggle[aria-expanded="true"]')
      .forEach(function (btn) {
        if (!btn.parentElement.contains(event.target)) {
          btn.setAttribute("aria-expanded", "false");
        }
      });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeSubmenus();
  });

  var hero = document.querySelector(".hero");
  if (hero && header) {
    // Sube el hero por detrás del header (que sigue en el flujo normal)
    // usando su altura real, para que el header transparente muestre
    // el azul del hero en vez del fondo de la página. Se recalcula con
    // ResizeObserver porque la altura cambia al terminar de cargar la
    // tipografía web (font-display: swap reordena el texto del header).
    var setHeaderHeightVar = function () {
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    };
    setHeaderHeightVar();
    hero.classList.add("hero-overlay");
    header.classList.add("hero-transparent");

    if ("ResizeObserver" in window) {
      new ResizeObserver(setHeaderHeightVar).observe(header);
    }

    // El header pasa a sólido apenas arranca el scroll (no cuando
    // termina el hero) — la transición gradual la da el CSS.
    var SCROLL_THRESHOLD = 8;
    var updateHeaderOnScroll = function () {
      header.classList.toggle("hero-transparent", window.scrollY < SCROLL_THRESHOLD);
    };
    window.addEventListener("scroll", updateHeaderOnScroll, { passive: true });
  }

  // Carrusel del hero: avanza solo, sin flechas. Se pausa con
  // hover/foco/touch (así quien lo esté mirando no pierde la foto),
  // y no arranca si el usuario prefiere menos movimiento.
  var carouselTrack = document.querySelector(".hero-carousel-track");
  if (carouselTrack && !prefersReducedMotion) {
    var slideCount = carouselTrack.children.length;
    var AUTO_ADVANCE_MS = 4500;
    var carouselTimer = null;

    var goToNextSlide = function () {
      var slideWidth = carouselTrack.clientWidth;
      var atEnd = carouselTrack.scrollLeft + slideWidth >= carouselTrack.scrollWidth - 1;
      carouselTrack.scrollTo({
        left: atEnd ? 0 : carouselTrack.scrollLeft + slideWidth,
        behavior: "smooth",
      });
    };

    var startCarousel = function () {
      if (carouselTimer || slideCount < 2) return;
      carouselTimer = window.setInterval(goToNextSlide, AUTO_ADVANCE_MS);
    };

    var stopCarousel = function () {
      window.clearInterval(carouselTimer);
      carouselTimer = null;
    };

    startCarousel();
    carouselTrack.addEventListener("mouseenter", stopCarousel);
    carouselTrack.addEventListener("mouseleave", startCarousel);
    carouselTrack.addEventListener("focusin", stopCarousel);
    carouselTrack.addEventListener("focusout", startCarousel);
    carouselTrack.addEventListener("touchstart", stopCarousel, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopCarousel();
      } else {
        startCarousel();
      }
    });
  }

  var yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  var animatedEls = document.querySelectorAll("[data-animate]");

  if (animatedEls.length && !prefersReducedMotion && "IntersectionObserver" in window) {
    // Recién ahora el CSS puede ocultar [data-animate]: ya nos
    // comprometimos a revelarlo con el observer de abajo.
    document.body.classList.add("js-animate");

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    animatedEls.forEach(function (el) {
      observer.observe(el);
    });
  }

  // Lightbox de fotos en Novedades: mejora progresiva. Sin JS, cada
  // .post-image-link ya abre el archivo de imagen completo tal cual
  // (es un <a href> normal); con JS, se muestra ampliada en el sitio
  // usando <dialog>, que ya resuelve foco y cierre con Escape.
  var lightbox = document.getElementById("lightbox");
  if (lightbox && typeof lightbox.showModal === "function") {
    var lightboxImg = lightbox.querySelector(".lightbox-img");
    var lightboxClose = lightbox.querySelector(".lightbox-close");
    var lastTrigger = null;

    document.querySelectorAll(".post-image-link").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        lastTrigger = link;
        lightboxImg.src = link.href;
        var innerImg = link.querySelector("img");
        lightboxImg.alt = innerImg ? innerImg.alt : link.dataset.alt || link.textContent.trim();
        lightbox.showModal();
      });
    });

    lightboxClose.addEventListener("click", function () {
      lightbox.close();
    });

    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) {
        lightbox.close();
      }
    });

    lightbox.addEventListener("close", function () {
      lightboxImg.src = "";
      if (lastTrigger) lastTrigger.focus();
    });
  }

  // Filtro "Filtrá por" de Novedades: muestra/oculta posteos según su
  // data-type. Sin JS quedan todos visibles (no depende de esto para
  // funcionar, solo para achicar la lista).
  var filterButtons = document.querySelectorAll(".novedades-filter-btn");
  var posts = document.querySelectorAll(".post-list .news-card");
  if (filterButtons.length && posts.length) {
    filterButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filter = btn.dataset.filter;

        filterButtons.forEach(function (b) {
          var isActive = b === btn;
          b.classList.toggle("is-active", isActive);
          b.setAttribute("aria-pressed", String(isActive));
        });

        posts.forEach(function (post) {
          post.hidden = filter !== "todos" && post.dataset.type !== filter;
        });
      });
    });
  }
})();

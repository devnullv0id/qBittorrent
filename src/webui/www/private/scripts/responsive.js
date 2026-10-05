/*
 * Bittorrent Client using Qt and libtorrent.
 * Copyright (C) 2026  qBittorrent project
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * In addition, as a special exception, the copyright holders give permission to
 * link this program with the OpenSSL project's "OpenSSL" library (or with
 * modified versions of it that use the same license as the "OpenSSL" library),
 * and distribute the linked executables. You must obey the GNU General Public
 * License in all respects for all of the code used other than "OpenSSL".  If you
 * modify file(s), you may extend this exception to your version of the file(s),
 * but you are not obligated to do so. If you do not wish to do so, delete this
 * exception statement from your version.
 */

"use strict";

// Behavior of the responsive layout that CSS can't provide
window.qBittorrent ??= {};
window.qBittorrent.Responsive ??= (() => {
    const exports = () => {
        return {
            init: init
        };
    };

    // keep in sync with responsive.css
    const drawerQuery = window.matchMedia("(width < 1100px)");
    const phoneQuery = window.matchMedia("(width < 760px)");
    const smallQuery = window.matchMedia("(width < 760px), (height < 620px)");

    const root = document.documentElement;

    const addScrim = (onClick) => {
        const scrim = document.createElement("div");
        scrim.className = "responsiveScrim";
        scrim.addEventListener("click", (_event) => onClick());
        document.body.append(scrim);
        return scrim;
    };

    /* Focus */

    // the focus stays in an open drawer
    const focusableSelector = "a[href], button:not([disabled]), input:not([disabled], [type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const trapFocus = (container) => {
        const returnTo = document.activeElement;
        const focusable = () => [...container.querySelectorAll(focusableSelector)].filter((element) => element.getClientRects().length > 0);
        const first = focusable()[0];
        if (first !== undefined) {
            first.focus();
        }
        else {
            container.tabIndex = -1;
            container.focus();
        }
        const onKeyDown = (event) => {
            if (event.key !== "Tab")
                return;

            const items = focusable();
            if (items.length === 0) {
                event.preventDefault();
                return;
            }
            const index = items.indexOf(document.activeElement);
            if (event.shiftKey && (index <= 0)) {
                event.preventDefault();
                items.at(-1).focus();
            }
            else if (!event.shiftKey && ((index === -1) || (index === (items.length - 1)))) {
                event.preventDefault();
                items[0].focus();
            }
        };

        const listening = new AbortController();
        document.addEventListener("keydown", ((event) => onKeyDown(event)), { capture: true, signal: listening.signal });
        return () => {
            listening.abort();
            if (returnTo?.isConnected)
                returnTo.focus();
        };
    };

    // filters reachable and activated from the keyboard
    const keyboardItems = "ul.filterList span.link";

    const initKeyboardItems = () => {
        const mark = (container) => {
            for (const item of container.querySelectorAll(keyboardItems)) {
                if (!item.hasAttribute("tabindex"))
                    item.tabIndex = 0;
            }
        };

        mark(document);
        // the filter lists are filled in later
        new MutationObserver((mutations) => {
            for (const target of new Set(mutations.map((mutation) => mutation.target)))
                mark(target);
        }).observe(document.getElementById("Filters"), { childList: true, subtree: true });
        document.addEventListener("keydown", (event) => {
            switch (event.key) {
                case "Enter":
                case " ":
                    if (!event.target.matches?.(keyboardItems))
                        break;

                    event.preventDefault();
                    event.target.click();
                    break;
            }
        });
    };

    /* Main window layout */

    // on phones and short screens the properties panel gives way until the list has this share of the page
    const MIN_TRANSFER_LIST_SHARE = 0.45;
    const MIN_PROPERTIES_HEIGHT = 60;

    const fitPropertiesPanel = () => {
        const mainColumn = document.getElementById("mainColumn");
        const list = document.getElementById("transferList");
        const properties = document.getElementById("propertiesPanel");
        if (!smallQuery.matches)
            return false;

        // hidden (another tab is shown) or collapsed
        if ((mainColumn.offsetHeight === 0) || (properties.offsetHeight === 0))
            return false;

        const missing = Math.round(mainColumn.offsetHeight * MIN_TRANSFER_LIST_SHARE) - list.offsetHeight;
        if (missing <= 0)
            return false;

        const height = Math.max(MIN_PROPERTIES_HEIGHT, properties.offsetHeight - missing);
        const given = properties.offsetHeight - height;
        if (given <= 0)
            return false;

        // Mocha shares the height in proportion, so set both
        properties.style.height = `${height}px`;
        list.style.height = `${list.offsetHeight + given}px`;
        return true;
    };

    // Mocha lays the page out only on window resize, not when the header or the filters column change size
    const initLayout = () => {
        const relayout = window.qBittorrent.Misc.createDebounceHandler(50, () => {
            MochaUI.Desktop.setDesktopSize();
            if (fitPropertiesPanel())
                MochaUI.Desktop.setDesktopSize();
        });
        const observer = new ResizeObserver(relayout);
        observer.observe(document.getElementById("desktopHeader"));
        observer.observe(document.getElementById("desktopFooterWrapper"));
        observer.observe(document.getElementById("filtersColumn"));
        // after Mocha's own resize handling
        window.addEventListener("resize", (_event) => relayout());
    };

    /* Filters drawer */

    let filtersScrim = null;

    let releaseFiltersFocus = null;

    const openFiltersDrawer = () => {
        if (!drawerQuery.matches)
            return;

        root.classList.add("filtersDrawerOpen");
        filtersScrim ??= addScrim(closeFiltersDrawer);
        document.getElementById("filtersButton").setAttribute("aria-expanded", "true");
        releaseFiltersFocus ??= trapFocus(document.getElementById("Filters"));
    };

    const closeFiltersDrawer = () => {
        if (!root.classList.contains("filtersDrawerOpen"))
            return;

        root.classList.remove("filtersDrawerOpen");
        filtersScrim?.remove();
        filtersScrim = null;
        document.getElementById("filtersButton").setAttribute("aria-expanded", "false");
        releaseFiltersFocus?.();
        releaseFiltersFocus = null;
    };

    const initFiltersDrawer = () => {
        const button = document.getElementById("filtersButton");
        // Mocha creates the column at runtime
        button.setAttribute("aria-controls", "filtersColumn");
        button.addEventListener("click", (_event) => openFiltersDrawer());
        document.getElementById("filtersColumn").addEventListener("click", (event) => {
            if (event.target.closest("ul.filterList li"))
                closeFiltersDrawer();
        });
        drawerQuery.addEventListener("change", (event) => {
            if (!drawerQuery.matches)
                closeFiltersDrawer();
        });
        document.addEventListener("keydown", (event) => {
            switch (event.key) {
                case "Escape":
                    closeFiltersDrawer();
                    break;
            }
        });

        // while View > Top Toolbar hides the toolbar, the button waits at the menubar's end
        const toolbar = document.getElementById("mochaToolbar");
        const home = button.parentElement;
        const homeNext = button.nextSibling;
        const placeButton = () => {
            if (toolbar.classList.contains("invisible"))
                document.getElementById("desktopNavbar").append(button);
            else if (button.parentElement !== home)
                home.insertBefore(button, homeNext);
        };
        new MutationObserver(placeButton).observe(toolbar, { attributes: true, attributeFilter: ["class"] });
        placeButton();
    };

    /* Windows */

    // distance from the screen's edges
    const WINDOW_MARGIN = 8;

    // resizes like a drag of the edge, without storing the size as the user's
    const setContentSize = (instance, width, height) => {
        const wrapper = instance.contentWrapperEl;
        if ((wrapper.style.width === width) && (wrapper.style.height === height))
            return;

        wrapper.style.width = width;
        wrapper.style.height = height;
        instance.drawWindow();
        // only resizable windows have handles
        if (instance.options.resizable)
            instance.adjustHandles();
        MochaUI.rWidth(wrapper);
        for (const column of wrapper.querySelectorAll(":scope > .column"))
            MochaUI.panelHeight(column);
    };

    // the size a window asks for; an empty width or height fits its content
    const wantedSize = (instance) => {
        const { width, height } = instance.contentWrapperEl.style;
        const fitted = instance.responsiveFittedSize;
        if ((fitted === undefined) || (width !== fitted.width) || (height !== fitted.height))
            instance.responsiveWantedSize = { width: width, height: height };
        return instance.responsiveWantedSize;
    };

    // sizes a window and keeps it on the screen; on phones it fills the screen
    const fitWindow = (instance) => {
        const windowEl = instance.windowEl;
        if (!windowEl.isConnected || (windowEl.style.display === "none") || instance.isMaximized)
            return;

        const phone = phoneQuery.matches;
        fitWindowSize(instance, phone);

        // phones: no dragging a window that fills the screen
        if (phone)
            instance.windowDrag?.detach();
        else
            instance.windowDrag?.attach();

        const margin = phone ? 0 : WINDOW_MARGIN;
        const wasPhone = windowEl.classList.contains("responsiveFullScreen");
        windowEl.classList.toggle("responsiveFullScreen", phone);
        const maxLeft = window.innerWidth - windowEl.offsetWidth - margin;
        const maxTop = window.innerHeight - windowEl.offsetHeight - margin;
        if (phone) {
            windowEl.style.left = "0px";
            windowEl.style.top = "0px";
        }
        else if (wasPhone) {
            windowEl.style.left = `${Math.max(margin, Math.round((maxLeft + margin) / 2))}px`;
            windowEl.style.top = `${Math.max(margin, Math.round((maxTop + margin) / 2))}px`;
        }
        else {
            windowEl.style.left = `${Math.max(margin, Math.min(windowEl.offsetLeft, maxLeft))}px`;
            windowEl.style.top = `${Math.max(margin, Math.min(windowEl.offsetTop, maxTop))}px`;
        }
    };

    const fitWindowSize = (instance, phone) => {
        const windowEl = instance.windowEl;
        const wrapper = instance.contentWrapperEl;
        const wanted = wantedSize(instance);
        // title bar and borders
        const frameWidth = windowEl.offsetWidth - wrapper.offsetWidth;
        const frameHeight = windowEl.offsetHeight - wrapper.offsetHeight;
        // measure the wanted size
        wrapper.style.width = wanted.width;
        wrapper.style.height = wanted.height;
        const margin = phone ? 0 : WINDOW_MARGIN;
        const maxWidth = window.innerWidth - (2 * margin) - frameWidth;
        const maxHeight = window.innerHeight - (2 * margin) - frameHeight;
        const width = (phone || (wrapper.offsetWidth > maxWidth)) ? `${maxWidth}px` : wanted.width;
        const height = (phone || (wrapper.offsetHeight > maxHeight)) ? `${maxHeight}px` : wanted.height;
        // restore, so the window is only redrawn on a change
        wrapper.style.width = instance.responsiveFittedSize?.width ?? wanted.width;
        wrapper.style.height = instance.responsiveFittedSize?.height ?? wanted.height;
        setContentSize(instance, width, height);
        instance.responsiveFittedSize = { width: width, height: height };
    };

    // taller title bars from the stylesheet, as Mocha's default for new windows
    const applyWindowTitleHeight = () => {
        const height = Number.parseInt(getComputedStyle(root).getPropertyValue("--window-title-height"), 10);
        if (!(height > 0))
            return;

        MochaUI.Window.prototype.options.headerHeight = height;
        MochaUI.Modal.prototype.options.headerHeight = height;
    };

    const fitWindows = () => {
        for (const instance of Object.values(MochaUI.Windows.instances))
            fitWindow(instance);
    };

    const initWindows = () => {
        // responsive.css loads after the page
        applyWindowTitleHeight();
        document.getElementById("responsiveStylesheet").addEventListener("load", (_event) => applyWindowTitleHeight());

        // content that changes size fits its window again
        const contentObserver = new ResizeObserver(window.qBittorrent.Misc.createDebounceHandler(50, fitWindows));
        const watch = (node) => {
            if (!node.classList?.contains("mocha"))
                return;

            const instance = MochaUI.Windows.instances[node.id];
            if (instance === undefined)
                return;

            // a window opened from the drawer would open behind it
            closeFiltersDrawer();
            fitWindow(instance);
            contentObserver.observe(instance.contentEl);
        };

        const windowObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes)
                    watch(node);
            }
        });
        for (const container of new Set([document.getElementById("desktop"), document.body]))
            windowObserver.observe(container, { childList: true });
        for (const node of document.querySelectorAll(".mocha"))
            watch(node);

        // after Mocha's own resize handling
        window.addEventListener("resize", window.qBittorrent.Misc.createDebounceHandler(50, fitWindows));
    };

    /* Context menus */

    // menus taller than the screen scroll; fitted after each input
    const syncMenus = () => {
        for (const menu of document.querySelectorAll(".contextMenu")) {
            const visible = menu.classList.contains("visible");
            const scrolling = visible && (menu.scrollHeight > window.innerHeight);
            if (scrolling !== menu.classList.contains("responsiveScrollingMenu"))
                menu.classList.toggle("responsiveScrollingMenu", scrolling);
        }
    };

    const initMenus = () => {
        // after the handlers of the input, before the next paint
        const scheduleSync = () => requestAnimationFrame(syncMenus);
        for (const type of ["contextmenu", "click", "touchend", "keydown"])
            document.addEventListener(type, (_event) => scheduleSync(), true);
    };

    // called by client.js once the main window is built
    const init = () => {
        initLayout();
        initFiltersDrawer();
        initWindows();
        initMenus();
        initKeyboardItems();
    };

    return exports();
})();
Object.freeze(window.qBittorrent.Responsive);

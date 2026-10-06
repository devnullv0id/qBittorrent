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

// Behavior of the responsive layout, and of Modern on top of it, that CSS can't provide
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
    const localPreferences = new window.qBittorrent.LocalPreferences.LocalPreferences();
    const isModern = () => root.classList.contains("modern");

    const addScrim = (onClick, zIndex) => {
        const scrim = document.createElement("div");
        scrim.className = "responsiveScrim";
        if (zIndex !== undefined)
            scrim.style.zIndex = zIndex;
        scrim.addEventListener("click", (_event) => onClick());
        document.body.append(scrim);
        return scrim;
    };

    // for the elements client.js creates later
    const whenElement = (id) => new Promise((resolve) => {
        const found = document.getElementById(id);
        if (found !== null) {
            resolve(found);
            return;
        }
        const observer = new MutationObserver(() => {
            const element = document.getElementById(id);
            if (element === null)
                return;

            observer.disconnect();
            resolve(element);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });

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

    // rows are touch-sized while the pointer is coarse (dynamicTable.js), which can change
    const initRowHeights = () => {
        window.matchMedia("(pointer: coarse)").addEventListener("change", (event) => window.torrentsTable.rerender());
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

        // view tabs showing only their icons are named on hover
        for (const img of document.querySelectorAll("#mainWindowTabsList img"))
            img.parentElement.title = img.alt;
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

        // while View > Top Toolbar hides the toolbar, the button waits at the menubar's end (Modern keeps its toolbar)
        const toolbar = document.getElementById("mochaToolbar");
        const home = button.parentElement;
        const homeNext = button.nextSibling;
        const placeButton = () => {
            if (toolbar.classList.contains("invisible") && !isModern())
                document.getElementById("desktopNavbar").append(button);
            else if (button.parentElement !== home)
                home.insertBefore(button, homeNext);
        };
        new MutationObserver(placeButton).observe(toolbar, { attributes: true, attributeFilter: ["class"] });
        placeButton();
    };

    /* Menu drawer on phones */

    let menuDrawerScrim = null;

    let releaseMenuDrawerFocus = null;

    const openMenuDrawer = () => {
        if (!phoneQuery.matches)
            return;

        root.classList.add("menuDrawerOpen");
        menuDrawerScrim ??= addScrim(closeMenuDrawer);
        document.getElementById("menuDrawerButton").setAttribute("aria-expanded", "true");
        releaseMenuDrawerFocus ??= trapFocus(document.getElementById("desktopNavbar"));
    };

    const closeMenuDrawer = () => {
        if (!root.classList.contains("menuDrawerOpen"))
            return;

        root.classList.remove("menuDrawerOpen");
        for (const li of document.querySelectorAll("#desktopNavbar > ul > li.menuDrawerExpanded"))
            li.classList.remove("menuDrawerExpanded");
        menuDrawerScrim?.remove();
        menuDrawerScrim = null;
        document.getElementById("menuDrawerButton").setAttribute("aria-expanded", "false");
        releaseMenuDrawerFocus?.();
        releaseMenuDrawerFocus = null;
    };

    const initMenuDrawer = () => {
        const navbar = document.getElementById("desktopNavbar");
        document.getElementById("menuDrawerButton").addEventListener("click", (_event) => openMenuDrawer());
        document.getElementById("menuDrawerClose").addEventListener("click", (_event) => closeMenuDrawer());
        // in the drawer a tap on a menu's name opens the menu below it, and closes any other
        for (const li of navbar.querySelectorAll(":scope > ul > li")) {
            li.firstElementChild.addEventListener("click", (event) => {
                if (!root.classList.contains("menuDrawerOpen"))
                    return;

                const open = !li.classList.contains("menuDrawerExpanded");
                for (const other of navbar.querySelectorAll(":scope > ul > li.menuDrawerExpanded"))
                    other.classList.remove("menuDrawerExpanded");
                li.classList.toggle("menuDrawerExpanded", open);
            });
        }
        // choosing an item closes the drawer; capturing, as the items' handlers stop the click
        navbar.addEventListener("click", (event) => {
            if (event.target.closest("li li"))
                closeMenuDrawer();
        }, true);
        phoneQuery.addEventListener("change", (event) => {
            if (!phoneQuery.matches)
                closeMenuDrawer();
        });
        document.addEventListener("keydown", (event) => {
            switch (event.key) {
                case "Escape":
                    closeMenuDrawer();
                    break;
            }
        });
    };

    /* Header that slides away */

    // the header hides once the first torrent has scrolled out of view, unless a menu is open or a field has focus
    const initHeaderAutoHide = async () => {
        const header = document.getElementById("desktopHeader");
        const list = await whenElement("torrentsTableDiv");
        let lockedUntil = 0;
        let unpinTimer = null;
        const setHidden = (hidden) => {
            if (root.classList.contains("headerHidden") === hidden)
                return;

            // slide between fixed heights, as auto can't be animated
            clearTimeout(unpinTimer);
            header.classList.add("sliding");
            header.style.height = `${header.offsetHeight}px`;
            void header.offsetHeight;
            root.classList.toggle("headerHidden", hidden);
            if (!hidden)
                header.style.height = `${header.scrollHeight}px`;
            unpinTimer = setTimeout(() => {
                header.classList.remove("sliding");
                header.style.removeProperty("height");
            }, 250);
            // ignore the scroll the relayout causes
            lockedUntil = performance.now() + 250;
        };

        const busy = () => (document.querySelector("#desktopNavbar li.open, #toolbarOverflowMenu.visible") !== null)
            || (header.contains(document.activeElement) && document.activeElement.matches("input, select"));

        list.addEventListener("scroll", (event) => {
            if (!smallQuery.matches) {
                setHidden(false);
                return;
            }
            if (performance.now() < lockedUntil)
                return;

            const rowHeight = list.querySelector("tbody tr")?.offsetHeight || 26;
            if (list.scrollTop <= rowHeight)
                setHidden(false);
            else if (!root.classList.contains("headerHidden") && !busy() && ((list.scrollHeight - list.clientHeight) > (header.offsetHeight + 24)))
                setHidden(true);
        }, { passive: true });
        smallQuery.addEventListener("change", (event) => {
            if (!smallQuery.matches)
                setHidden(false);
        });
        header.addEventListener("focusin", (event) => setHidden(false));
    };

    /* Torrent cards on phones */

    // on phones each torrent is a card (responsive.css), laid out by the column of each cell
    const initCards = async () => {
        root.style.setProperty("--card-height", `${window.qBittorrent.DynamicTable.TorrentsTable.CARD_HEIGHT}px`);
        const tableDiv = await whenElement("torrentsTableDiv");
        const tag = () => {
            if (!phoneQuery.matches)
                return;

            const headers = [...document.querySelectorAll("#torrentsTableFixedHeaderDiv th")];
            const names = headers.map((th) => (th.className.match(/column_(\S+)/) ?? [])[1] ?? "");
            const labels = headers.map((th) => th.textContent.trim());
            for (const tr of tableDiv.querySelectorAll("tbody tr")) {
                for (const [i, td] of [...tr.children].entries()) {
                    if (td.dataset.col !== names[i])
                        td.dataset.col = names[i];
                    if (td.dataset.label !== labels[i])
                        td.dataset.label = labels[i];
                }
            }
        };

        new MutationObserver(tag).observe(tableDiv, { childList: true, subtree: true });
        // rows and cards differ in height
        phoneQuery.addEventListener("change", (event) => {
            window.torrentsTable.rerender();
            tag();
        });
        tag();

        // the ⋯ at a card's top right opens the torrent's menu, as a long press does
        document.addEventListener("click", (event) => {
            const tr = (phoneQuery.matches && !isModern()) ? event.target.closest?.("#torrentsTableDiv tbody tr") : null;
            if (!tr)
                return;

            const box = tr.getBoundingClientRect();
            if ((event.clientX < (box.right - 44)) || (event.clientY > (box.top + 40)))
                return;

            event.preventDefault();
            event.stopPropagation();
            tr.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: event.clientX, clientY: event.clientY }));
        }, true);
    };

    // a card's checkbox adds its torrent to the selection or takes it out, as a Ctrl+click on a row does; the bar above
    // the cards counts the selected torrents and selects all or none
    const initCardCheckboxes = async () => {
        const tableDiv = await whenElement("torrentsTableDiv");
        const table = window.torrentsTable;
        // the checkbox zone: the card's left side
        const hitCheckbox = (event) => {
            const tr = (phoneQuery.matches && !isModern()) ? event.target.closest("tbody tr") : null;
            if (tr === null)
                return false;

            const point = event.changedTouches?.[0] ?? event;
            return point.clientX < (tr.getBoundingClientRect().left + 40);
        };

        // a touch on the checkbox neither selects the card alone nor starts a long press, and a double click on it
        // doesn't start or stop the torrent
        tableDiv.addEventListener("touchstart", (event) => {
            if (hitCheckbox(event))
                event.stopPropagation();
        }, { capture: true, passive: true });
        tableDiv.addEventListener("dblclick", (event) => {
            if (hitCheckbox(event))
                event.stopPropagation();
        }, true);
        tableDiv.addEventListener("click", (event) => {
            if (event.ctrlKey || !hitCheckbox(event))
                return;

            event.stopPropagation();
            event.target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true, clientX: event.clientX, clientY: event.clientY }));
        }, true);

        const count = document.getElementById("torrentsSelectionCount");
        const selectNone = document.getElementById("torrentsSelectNone");
        const update = () => {
            const selected = table.selectedRowsIds().length;
            count.textContent = (selected > 0) ? count.dataset.format.replace("%1", selected) : "";
            selectNone.disabled = (selected === 0);
        };
        document.getElementById("torrentsSelectAll").addEventListener("click", (event) => {
            table.selectAll();
            update();
        });
        selectNone.addEventListener("click", (event) => {
            table.deselectAll();
            table.setRowClass();
            update();
        });
        // the cards show the selection, and the list renders them anew as it scrolls and updates
        new MutationObserver(window.qBittorrent.Misc.createDebounceHandler(100, update)).observe(tableDiv.querySelector("tbody"), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
        update();
    };

    /* Windows */

    // distance from the screen's edges, and the least width
    const WINDOW_MARGIN = 8;
    const PHONE_WINDOW_MARGIN = 12;
    const MIN_WINDOW_WIDTH = 300;
    // the least height of a page that scrolls anyway or fills whatever height it is given
    const MIN_WINDOW_HEIGHT = 240;
    // the largest a window grows to fit its page
    const MAX_WINDOW_WIDTH = 1200;
    const MAX_WINDOW_HEIGHT = 800;

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

    // measure(page) at the given size, or null while the page loads
    const measurePage = (instance, width, height, measure) => {
        const iframe = instance.iframeEl;
        const box = iframe ?? instance.contentWrapperEl;
        const page = iframe ? iframe.contentDocument?.documentElement : box;
        const loading = iframe
            ? ((iframe.contentDocument?.readyState !== "complete") || (iframe.contentWindow.location.href === "about:blank"))
            : (instance.contentEl.childElementCount === 0);
        if (!page || loading)
            return null;

        const { width: oldWidth, height: oldHeight } = box.style;
        const oldOverflow = page.style.overflow;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
        // a scrollbar would narrow the page
        page.style.overflow = "hidden";
        const result = measure(page);
        page.style.overflow = oldOverflow;
        box.style.width = oldWidth;
        box.style.height = oldHeight;
        return result;
    };

    // heights of the scrolling boxes and leaf elements
    const contentHeights = (page) => {
        const view = page.ownerDocument.defaultView;
        const heights = [];
        for (const el of page.querySelectorAll("*")) {
            if ((el === page.ownerDocument.body) || ((el.firstElementChild !== null) && !/auto|scroll/.test(view.getComputedStyle(el).overflowY)))
                continue;

            heights.push(el.getBoundingClientRect().height);
        }
        return heights;
    };

    // a page's own height at the given width, 0 if it fills whatever height it is given, or null while it loads
    const pageHeight = (instance, width, tallHeight) => {
        const short = measurePage(instance, width, 1, (page) => ({ height: page.scrollHeight + pageBottomPadding(instance), heights: contentHeights(page) }));
        if (short === null)
            return null;

        const tall = measurePage(instance, width, tallHeight, contentHeights);
        return tall.some((height, i) => Math.abs(height - short.heights[i]) > 1) ? 0 : short.height;
    };

    // the bottom padding of a content box the page runs past
    const pageBottomPadding = (instance) => {
        const content = instance.iframeEl ? null : instance.contentEl;
        if ((content === null) || (content.scrollHeight <= content.clientHeight))
            return 0;

        return Number.parseFloat(getComputedStyle(content).paddingBottom) || 0;
    };

    // the size a page needs not to scroll, 0 where it fits
    const pageOverflow = (instance, width, height) => measurePage(instance, width, height, (page) => ({
        width: (page.scrollWidth > page.clientWidth) ? page.scrollWidth : 0,
        height: (page.scrollHeight > page.clientHeight) ? page.scrollHeight : 0
    })) ?? { width: 0, height: 0 };

    // the width a vertical scrollbar takes where it would make the page scroll sideways, else 0 (also where scrollbars
    // are drawn over the page)
    const sidewaysScrollbarWidth = (instance, width, height) => measurePage(instance, width, height, (page) => {
        const fullWidth = page.clientWidth;
        page.style.overflowY = "scroll";
        return (page.scrollWidth > page.clientWidth) ? (fullWidth - page.clientWidth) : 0;
    }) ?? 0;

    // the largest content size a window has room for on the screen
    const roomOnScreen = (instance) => {
        const wrapper = instance.contentWrapperEl;
        const margin = phoneQuery.matches ? PHONE_WINDOW_MARGIN : WINDOW_MARGIN;
        return {
            width: window.innerWidth - (2 * margin) - (instance.windowEl.offsetWidth - wrapper.offsetWidth),
            height: window.innerHeight - (2 * margin) - (instance.windowEl.offsetHeight - wrapper.offsetHeight)
        };
    };

    // whether a fitted window shows all of its page at the given width; not where the page scrolls anyway or fills
    // whatever height it is given
    const pageFits = (instance, width) => {
        const room = roomOnScreen(instance).height;
        const ownHeight = pageHeight(instance, width, room) ?? 0;
        return (ownHeight > 0) && (ownHeight <= Math.min(room, MAX_WINDOW_HEIGHT));
    };

    // the smallest size a page is shown in at the given width, within the screen: all of it where it fits (pageFits),
    // else MIN_WINDOW_HEIGHT of it
    const pageMinSize = (instance, width, fits) => {
        const room = roomOnScreen(instance);
        const height = fits ? (measurePage(instance, width, 1, (page) => page.scrollHeight + pageBottomPadding(instance)) ?? 0) : MIN_WINDOW_HEIGHT;
        return {
            width: Math.min(room.width, Math.max(MIN_WINDOW_WIDTH, pageOverflow(instance, MIN_WINDOW_WIDTH, instance.contentWrapperEl.offsetHeight).width)),
            height: Math.min(room.height, height)
        };
    };

    // a window can't be resized smaller than its page needs or its own limit, unless it already is
    const limitResize = (instance) => {
        const wrapper = instance.contentWrapperEl;
        instance.responsivePageFits = pageFits(instance, wrapper.offsetWidth);
        const page = pageMinSize(instance, wrapper.offsetWidth, instance.responsivePageFits);
        const frameWidth = instance.windowEl.offsetWidth - wrapper.offsetWidth;
        const frameHeight = instance.windowEl.offsetHeight - wrapper.offsetHeight;
        // the limits the window was opened with
        const own = instance.responsiveResizeLimit ??= { x: [...instance.options.resizeLimit.x], y: [...instance.options.resizeLimit.y] };
        const min = {
            width: Math.min(wrapper.offsetWidth, Math.max(page.width, own.x[0] - frameWidth)),
            height: Math.min(wrapper.offsetHeight, Math.max(page.height, own.y[0] - frameHeight))
        };
        instance.options.resizeLimit = { x: [min.width + frameWidth, own.x[1]], y: [min.height + frameHeight, own.y[1]] };
        for (const drag of [instance.resizable2, instance.resizable3, instance.resizable4]) {
            if (drag?.options.limit.x)
                drag.options.limit.x[0] = min.width;
            if (drag?.options.limit.y)
                drag.options.limit.y[0] = min.height;
        }
    };

    // a narrower page needs more height
    const keepPageHeight = (instance) => {
        const wrapper = instance.contentWrapperEl;
        const minHeight = pageMinSize(instance, wrapper.offsetWidth, instance.responsivePageFits).height;
        if (wrapper.offsetHeight >= minHeight)
            return;

        wrapper.style.height = `${minHeight}px`;
        instance.drawWindow();
    };

    // sizes a window to its page and keeps it on the screen
    const fitWindow = (instance) => {
        const windowEl = instance.windowEl;
        if (!windowEl.isConnected || (windowEl.style.display === "none") || instance.isMaximized)
            return;

        const phone = phoneQuery.matches;
        const fullScreen = fitWindowSize(instance, phone);

        // no dragging on phones
        if (phone)
            instance.windowDrag?.detach();
        else
            instance.windowDrag?.attach();

        const margin = fullScreen ? 0 : (phone ? PHONE_WINDOW_MARGIN : WINDOW_MARGIN);
        const wasFullScreen = windowEl.classList.contains("responsiveFullScreen");
        windowEl.classList.toggle("responsiveFullScreen", fullScreen);
        const maxLeft = window.innerWidth - windowEl.offsetWidth - margin;
        const maxTop = window.innerHeight - windowEl.offsetHeight - margin;
        if (fullScreen) {
            windowEl.style.left = "0px";
            windowEl.style.top = "0px";
        }
        else if (phone || wasFullScreen || (!instance.responsiveUserMoved && root.classList.contains("responsiveRelayout"))) {
            windowEl.style.left = `${Math.max(margin, Math.round((maxLeft + margin) / 2))}px`;
            windowEl.style.top = `${Math.max(margin, Math.round((maxTop + margin) / 2))}px`;
        }
        else {
            windowEl.style.left = `${Math.max(margin, Math.min(windowEl.offsetLeft, maxLeft))}px`;
            windowEl.style.top = `${Math.max(margin, Math.min(windowEl.offsetTop, maxTop))}px`;
        }
    };

    // the size a window asks for, larger where its page needs it (responsiveRelayout), within the screen; returns whether it fills the screen
    const fitWindowSize = (instance, phone) => {
        const windowEl = instance.windowEl;
        const wrapper = instance.contentWrapperEl;
        // Mocha draws the window around the toolbar's inline height
        const toolbar = instance.toolbarWrapperEl;
        if (toolbar && (toolbar.style.height !== `${toolbar.offsetHeight}px`)) {
            toolbar.style.height = `${toolbar.offsetHeight}px`;
            instance.drawWindow();
        }
        const wanted = wantedSize(instance);
        // title bar, toolbar and borders
        const frameWidth = windowEl.offsetWidth - wrapper.offsetWidth;
        const frameHeight = windowEl.offsetHeight - wrapper.offsetHeight;
        // measure the wanted size
        wrapper.style.width = wanted.width;
        wrapper.style.height = wanted.height;
        const wantedWidth = wrapper.offsetWidth;
        const wantedHeight = wrapper.offsetHeight;
        const margin = phone ? PHONE_WINDOW_MARGIN : WINDOW_MARGIN;
        const maxWidth = window.innerWidth - (2 * margin) - frameWidth;
        const maxHeight = window.innerHeight - (2 * margin) - frameHeight;

        let width = phone ? maxWidth : Math.min(maxWidth, wantedWidth);
        let height = Math.min(maxHeight, wantedHeight);
        // null while unknown: a window the user sized, or a page still loading, isn't taken full screen
        let ownHeight = null;
        if (!instance.responsiveUserResized && root.classList.contains("responsiveRelayout")) {
            const fitWidth = Math.min(maxWidth, MAX_WINDOW_WIDTH);
            const fitHeight = Math.min(maxHeight, MAX_WINDOW_HEIGHT);
            width = phone ? maxWidth : Math.min(fitWidth, Math.max(width, MIN_WINDOW_WIDTH, pageOverflow(instance, width, wantedHeight).width));
            ownHeight = pageHeight(instance, width, maxHeight);
            height = Math.min(fitHeight, (ownHeight > 0) ? ownHeight : Math.max(wantedHeight, pageOverflow(instance, width, wantedHeight).height));
            // a page that scrolls keeps its width beside the scrollbar
            if (pageOverflow(instance, width, height).height > 0)
                width = Math.min(fitWidth, width + sidewaysScrollbarWidth(instance, width, height));
        }
        const fullScreen = phone && (ownHeight !== null) && ((ownHeight === 0) || (ownHeight > maxHeight));
        if (fullScreen) {
            width = window.innerWidth - frameWidth;
            height = window.innerHeight - frameHeight;
        }

        // restore, so the window is only redrawn on a change
        wrapper.style.width = instance.responsiveFittedSize?.width ?? wanted.width;
        wrapper.style.height = instance.responsiveFittedSize?.height ?? wanted.height;
        setContentSize(instance, `${width}px`, `${height}px`);
        instance.responsiveFittedSize = { width: `${width}px`, height: `${height}px` };
        return fullScreen;
    };

    // taller title bars from the stylesheets, as Mocha's default for new windows
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
        // the display mode stylesheets load after the page
        applyWindowTitleHeight();
        for (const link of document.querySelectorAll("link[id$='Stylesheet']"))
            link.addEventListener("load", (_event) => applyWindowTitleHeight());

        // content that changes size fits its window again, and only that window
        const changed = new Set();
        const fitChanged = window.qBittorrent.Misc.createDebounceHandler(50, () => {
            for (const instance of changed)
                fitWindow(instance);
            changed.clear();
        });
        const fitSoon = (records) => {
            for (const { target } of records) {
                const instance = MochaUI.Windows.instances[target.closest(".mocha")?.id];
                if (instance !== undefined)
                    changed.add(instance);
            }
            fitChanged();
        };
        const contentObserver = new ResizeObserver(fitSoon);
        const contentChangeObserver = new MutationObserver(fitSoon);
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
            contentChangeObserver.observe(instance.contentEl, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
            if (instance.toolbarWrapperEl)
                contentObserver.observe(instance.toolbarWrapperEl);
            // a size or place the user chose is kept, from the start of the drag
            instance.addEvent("resize", () => {
                instance.responsiveUserResized = true;
            });
            for (const drag of [instance.resizable1, instance.resizable2, instance.resizable3, instance.resizable4, instance.resizable5]) {
                drag?.addEvent("start", () => {
                    instance.responsiveUserMoved = true;
                });
                drag?.addEvent("beforeStart", () => limitResize(instance));
            }
            // the edges that change the width
            for (const drag of [instance.resizable2, instance.resizable3, instance.resizable5])
                drag?.addEvent("drag", () => keepPageHeight(instance));
            instance.windowDrag?.addEvent("complete", () => {
                instance.responsiveUserMoved = true;
            });
            // dialog pages
            const iframe = instance.iframeEl;
            iframe?.addEventListener("load", (event) => {
                fitWindow(instance);
                const pageObserver = new iframe.contentWindow.ResizeObserver(window.qBittorrent.Misc.createDebounceHandler(50, () => fitWindow(instance)));
                pageObserver.observe(iframe.contentDocument.body);
            });
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

    /* Modern menubar */

    // menus open on click; with one open, hovering another switches to it (with a mouse only: a tap hovers too)
    const initNavbar = () => {
        const navbar = document.getElementById("desktopNavbar");
        const topItems = [...navbar.querySelectorAll(":scope > ul > li")];
        const closeAll = () => {
            for (const li of topItems)
                li.classList.remove("open");
        };

        for (const li of topItems) {
            li.firstElementChild.addEventListener("click", (event) => {
                event.preventDefault();
                const wasOpen = li.classList.contains("open");
                closeAll();
                if (!wasOpen)
                    li.classList.add("open");
            });
            li.addEventListener("pointerenter", (event) => {
                if (event.pointerType !== "mouse")
                    return;

                if (!li.classList.contains("open") && topItems.some((item) => item.classList.contains("open"))) {
                    closeAll();
                    li.classList.add("open");
                }
            });
        }
        document.addEventListener("pointerdown", (event) => {
            if (!navbar.contains(event.target))
                closeAll();
        });
        // capturing, as the items' handlers stop the click
        navbar.addEventListener("click", (event) => {
            if (event.target.closest("li li"))
                closeAll();
        }, true);
        document.addEventListener("keydown", (event) => {
            switch (event.key) {
                case "Escape":
                    closeAll();
                    break;
            }
        });
    };

    /* Modern phone header */

    let navScrim = null;

    const setNavDrawer = (open) => {
        const navbar = document.getElementById("desktopNavbar");
        if (open && !navbar.querySelector(".modernDrawerHead")) {
            // drawer header: logo, title, close
            const head = document.createElement("div");
            head.className = "modernDrawerHead";
            const logo = document.createElement("img");
            logo.src = "images/qbittorrent-tray.svg";
            logo.alt = "";
            logo.width = 22;
            logo.height = 22;
            const title = document.createElement("span");
            title.textContent = "QBT_TR(qBittorrent WebUI)QBT_TR[CONTEXT=Login]";
            const close = document.createElement("button");
            close.type = "button";
            close.className = "modernDrawerClose";
            close.title = "QBT_TR(Close)QBT_TR[CONTEXT=MainWindow]";
            close.setAttribute("aria-label", close.title);
            const glyph = document.createElement("span");
            glyph.className = "modernGlyph";
            glyph.dataset.glyph = "close";
            close.append(glyph);
            close.addEventListener("click", (event) => setNavDrawer(false));
            head.append(logo, title, close);
            navbar.prepend(head);
        }
        if (!open) {
            for (const li of navbar.querySelectorAll(":scope > ul > li.open"))
                li.classList.remove("open");
        }
        root.classList.toggle("navDrawerOpen", open);
        document.getElementById("mobileMenuButton").setAttribute("aria-expanded", open.toString());
        if (open) {
            // below the drawer
            navScrim ??= addScrim(() => setNavDrawer(false), 9780);
        }
        else {
            navScrim?.remove();
            navScrim = null;
        }
    };

    const initPhoneToolbar = () => {
        document.getElementById("mobileMenuButton").addEventListener("click", (event) => setNavDrawer(!root.classList.contains("navDrawerOpen")));
        // capturing, as the items' handlers stop the click
        document.getElementById("desktopNavbar").addEventListener("click", (event) => {
            if (event.target.closest("li li"))
                setNavDrawer(false);
        }, true);
        phoneQuery.addEventListener("change", (event) => setNavDrawer(false));
        document.addEventListener("keydown", (event) => {
            switch (event.key) {
                case "Escape":
                    if (root.classList.contains("navDrawerOpen"))
                        setNavDrawer(false);
                    break;
            }
        });

        // the overflow menu's items click the toolbar's buttons
        const button = document.getElementById("toolbarOverflowButton");
        const menu = document.getElementById("toolbarOverflowMenu");
        const close = () => {
            menu.classList.remove("visible");
            button.setAttribute("aria-expanded", "false");
        };

        button.addEventListener("click", (event) => {
            event.stopPropagation();
            const open = !menu.classList.contains("visible");
            // only what the toolbar offers now
            for (const item of menu.querySelectorAll("a[data-target]")) {
                const target = document.getElementById(item.dataset.target);
                item.parentElement.classList.toggle("invisible", (target === null) || (target.closest(".invisible") !== null));
            }
            menu.classList.toggle("visible", open);
            button.setAttribute("aria-expanded", open.toString());
        });
        menu.addEventListener("click", (event) => {
            const item = event.target.closest("a[data-target]");
            if (item === null)
                return;

            close();
            document.getElementById(item.dataset.target).click();
        });
        document.addEventListener("pointerdown", (event) => {
            if (!menu.contains(event.target) && !button.contains(event.target))
                close();
        });
    };

    /* Modern torrent cards and properties sheet */

    // the properties sheet opens at half height and grows to full screen
    let sheetWired = false;
    // a collapsed panel opened for the sheet
    let collapseAfterSheet = false;

    const openHalfSheet = (wrapper) => {
        wrapper.style.removeProperty("--modern-sheet-top");
        wrapper.classList.add("modernSheetHalf");
        if (sheetWired)
            return;

        sheetWired = true;

        const isOpen = () => wrapper.classList.contains("modernSheet");
        const isHalf = () => wrapper.classList.contains("modernSheetHalf");
        const close = () => wrapper.classList.remove("modernSheet");
        const toFull = () => wrapper.classList.remove("modernSheetHalf");
        const toHalf = () => {
            wrapper.style.removeProperty("--modern-sheet-top");
            wrapper.classList.add("modernSheetHalf");
        };

        // closing clears the state; changing classes would trigger this again
        new MutationObserver(() => {
            if (isOpen())
                return;

            for (const cls of ["modernSheetHalf", "modernSheetDragging"]) {
                if (wrapper.classList.contains(cls))
                    wrapper.classList.remove(cls);
            }
            if (wrapper.style.getPropertyValue("--modern-sheet-top"))
                wrapper.style.removeProperty("--modern-sheet-top");
            if (collapseAfterSheet) {
                collapseAfterSheet = false;
                document.getElementById("propertiesPanel_collapseToggle").click();
            }
        }).observe(wrapper, { attributes: true, attributeFilter: ["class"] });

        // a tap outside it (not on a menu, scrim or window) closes it without selecting a torrent
        let swallowClick = false;
        document.addEventListener("pointerdown", (event) => {
            if (!isOpen() || !isHalf() || wrapper.contains(event.target) || event.target.closest(".contextMenu, .responsiveScrim, .mocha"))
                return;

            swallowClick = true;
            setTimeout(() => {
                swallowClick = false;
            }, 400);
            event.preventDefault();
            event.stopPropagation();
            close();
        }, true);
        document.addEventListener("click", (event) => {
            if (!swallowClick)
                return;

            swallowClick = false;
            event.preventDefault();
            event.stopPropagation();
        }, true);

        // dragging the header resizes the sheet
        const header = document.getElementById("propertiesPanel_header");
        let drag = null;
        header.addEventListener("pointerdown", (event) => {
            if (!isOpen() || event.target.closest("button, input") || (event.button > 0))
                return;

            drag = { id: event.pointerId, y0: event.clientY, top0: wrapper.getBoundingClientRect().top, moved: false };
        });
        header.addEventListener("pointermove", (event) => {
            if ((drag === null) || (event.pointerId !== drag.id))
                return;

            const dy = event.clientY - drag.y0;
            if (!drag.moved) {
                if (Math.abs(dy) < 6)
                    return;

                drag.moved = true;
                header.setPointerCapture(drag.id);
                wrapper.classList.add("modernSheetHalf", "modernSheetDragging");
            }
            const top = Math.min(Math.max(drag.top0 + dy, 0), window.innerHeight - 80);
            wrapper.style.setProperty("--modern-sheet-top", `${top}px`);
        });
        const endDrag = (event) => {
            if ((drag === null) || (event.pointerId !== drag.id))
                return;

            const moved = drag.moved;
            drag = null;
            if (!moved)
                return;

            wrapper.classList.remove("modernSheetDragging");
            const top = wrapper.getBoundingClientRect().top;
            if (top < (window.innerHeight * 0.12))
                toFull();
            else if (top > (window.innerHeight * 0.8))
                close();
            // the click ending a mouse drag (a finger's drag and a cancel end without one)
            if ((event.type === "pointerup") && (event.pointerType !== "touch")) {
                header.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                }, { capture: true, once: true });
            }
        };

        header.addEventListener("pointerup", (event) => endDrag(event));
        header.addEventListener("pointercancel", (event) => endDrag(event));

        // one step per gesture
        let lockedUntil = 0;
        const step = (fn) => {
            if (performance.now() < lockedUntil)
                return;

            lockedUntil = performance.now() + 450;
            fn();
        };

        const scrollerOf = (target) => target.closest?.(".dynamicTableDiv") ?? document.getElementById("propertiesPanel");
        const atTop = (target) => (scrollerOf(target)?.scrollTop ?? 0) <= 0;
        const shrinkOrClose = () => step(() => (isHalf() ? close() : toHalf()));

        wrapper.addEventListener("scroll", (event) => {
            if (isHalf() && !wrapper.classList.contains("modernSheetDragging") && (event.target.scrollTop > 4))
                step(toFull);
        }, true);
        // only a gesture's first wheel event counts
        let lastWheel = 0;
        wrapper.addEventListener("wheel", (event) => {
            const now = performance.now();
            const newGesture = (now - lastWheel) > 250;
            lastWheel = now;
            if (!newGesture)
                return;

            if ((event.deltaY > 0) && isHalf())
                step(toFull);
            else if ((event.deltaY < 0) && atTop(event.target))
                shrinkOrClose();
        }, { passive: true });
        let startY = null;
        let startAtTop = false;
        wrapper.addEventListener("touchstart", (event) => {
            startY = header.contains(event.target) ? null : event.touches[0].clientY;
            startAtTop = atTop(event.target);
        }, { passive: true });
        wrapper.addEventListener("touchmove", (event) => {
            if (startY === null)
                return;

            const dy = event.touches[0].clientY - startY;
            if ((dy < -12) && isHalf()) {
                step(toFull);
                startY = null;
            }
            else if ((dy > 60) && startAtTop) {
                shrinkOrClose();
                startY = null;
            }
        }, { passive: true });
        wrapper.addEventListener("touchend", (event) => {
            startY = null;
        });
    };

    // show a collapsed panel in the sheet, keeping the stored state
    const expandPanelForSheet = () => {
        const toggle = document.getElementById("propertiesPanel_collapseToggle");
        if (!toggle?.classList.contains("panel-expand"))
            return;

        const saved = localPreferences.get("properties_panel_collapsed");
        toggle.click();
        collapseAfterSheet = true;
        if (saved !== null)
            localPreferences.set("properties_panel_collapsed", saved);
    };

    const addSheetBar = (wrapper) => {
        const header = wrapper.querySelector(".panel-header");
        if (header.querySelector(".modernSheetBar"))
            return;

        const bar = document.createElement("div");
        bar.className = "modernSheetBar";
        const back = document.createElement("button");
        back.type = "button";
        back.className = "modernSheetBack";
        back.title = "QBT_TR(Back)QBT_TR[CONTEXT=MainWindow]";
        back.setAttribute("aria-label", back.title);
        back.addEventListener("click", (event) => wrapper.classList.remove("modernSheet"));
        const title = document.createElement("span");
        title.className = "modernSheetTitle";
        bar.append(back, title);
        header.prepend(bar);
    };

    const initTorrentCards = async () => {
        // also used in modern.css
        root.style.setProperty("--modern-card-height", `${window.qBittorrent.DynamicTable.TorrentsTable.MODERN_CARD_HEIGHT}px`);
        const tableDiv = await whenElement("torrentsTableDiv");
        // the cells tell the card layout which column they are
        const tag = () => {
            if (!phoneQuery.matches)
                return;

            const headers = [...document.querySelectorAll("#torrentsTableFixedHeaderDiv th")];
            const names = headers.map((th) => (th.className.match(/column_(\S+)/) ?? [])[1] ?? "");
            const labels = headers.map((th) => th.textContent.trim());
            for (const tr of tableDiv.querySelectorAll("tbody tr")) {
                for (const [i, td] of [...tr.children].entries()) {
                    if (td.dataset.col !== names[i])
                        td.dataset.col = names[i];
                    if (td.dataset.label !== labels[i])
                        td.dataset.label = labels[i];
                }
            }
        };

        new MutationObserver(tag).observe(tableDiv, { childList: true, subtree: true });
        // rows and cards differ in height
        phoneQuery.addEventListener("change", (event) => {
            window.torrentsTable.rerender();
            tag();
        });
        tag();

        // tapping a card opens its properties as a sheet
        const wrapper = await whenElement("propertiesPanel_wrapper");
        tableDiv.addEventListener("click", (event) => {
            const tr = event.target.closest("tbody tr");
            if (!phoneQuery.matches || (tr === null))
                return;

            addSheetBar(wrapper);
            if (!wrapper.classList.contains("modernSheet"))
                openHalfSheet(wrapper);
            wrapper.classList.add("modernSheet");
            wrapper.querySelector(".modernSheetTitle").textContent = tr.querySelector("td[data-col='name']")?.textContent.trim() ?? "";
            expandPanelForSheet();
        });
        // tapping the selected tab mustn't collapse the panel
        document.addEventListener("click", (event) => {
            if (wrapper.classList.contains("modernSheet") && event.target.closest("#propertiesTabs li.selected"))
                event.stopPropagation();
        }, true);
        document.addEventListener("keydown", (event) => {
            switch (event.key) {
                case "Escape":
                    wrapper.classList.remove("modernSheet");
                    break;
            }
        });
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

    /* Options */

    // a page opens at its top, as the pages share the window's scrolling
    const initOptionsPages = () => {
        document.addEventListener("click", (event) => {
            if (event.target.closest("#preferencesTabs a") === null)
                return;

            document.getElementById("preferencesPage_contentWrapper").scrollTop = 0;
        });
    };

    // called by client.js once the main window is built
    const init = () => {
        initLayout();
        initRowHeights();
        initFiltersDrawer();
        initMenuDrawer();
        initWindows();
        initMenus();
        initHeaderAutoHide();
        initCards();
        initCardCheckboxes();
        initKeyboardItems();
        initOptionsPages();

        if (!isModern())
            return;

        initNavbar();
        initPhoneToolbar();
        initTorrentCards();
    };

    return exports();
})();
Object.freeze(window.qBittorrent.Responsive);

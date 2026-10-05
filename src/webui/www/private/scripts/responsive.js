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
    const smallQuery = window.matchMedia("(width < 760px), (height < 620px)");

    const root = document.documentElement;

    const addScrim = (onClick) => {
        const scrim = document.createElement("div");
        scrim.className = "responsiveScrim";
        scrim.addEventListener("click", (_event) => onClick());
        document.body.append(scrim);
        return scrim;
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

    const openFiltersDrawer = () => {
        if (!drawerQuery.matches)
            return;

        root.classList.add("filtersDrawerOpen");
        filtersScrim ??= addScrim(closeFiltersDrawer);
        document.getElementById("filtersButton").setAttribute("aria-expanded", "true");
    };

    const closeFiltersDrawer = () => {
        if (!root.classList.contains("filtersDrawerOpen"))
            return;

        root.classList.remove("filtersDrawerOpen");
        filtersScrim?.remove();
        filtersScrim = null;
        document.getElementById("filtersButton").setAttribute("aria-expanded", "false");
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

    // called by client.js once the main window is built
    const init = () => {
        initLayout();
        initFiltersDrawer();
    };

    return exports();
})();
Object.freeze(window.qBittorrent.Responsive);

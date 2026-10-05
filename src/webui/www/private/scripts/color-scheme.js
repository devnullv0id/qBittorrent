/*
 * Bittorrent Client using Qt and libtorrent.
 * Copyright (C) 2024  sledgehammer999 <hammered999@gmail.com>
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

window.qBittorrent ??= {};
window.qBittorrent.ColorScheme ??= (() => {
    const exports = () => {
        return {
            update,
        };
    };

    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    // the main window's screen, also from a dialog's frame
    const phoneQuery = window.parent.matchMedia("(width < 760px)");
    // touch screens and narrower screens, where the desktop layout doesn't hold
    const relayoutQuery = window.parent.matchMedia("(pointer: coarse), (width < 1100px)");
    const clientData = window.parent.qBittorrent.ClientData;

    const update = () => {
        const root = document.documentElement;
        const colorScheme = clientData.get("color_scheme");
        const validScheme = (colorScheme === "light") || (colorScheme === "dark");
        const isDark = colorSchemeQuery.matches;
        root.classList.toggle("dark", ((!validScheme && isDark) || (colorScheme === "dark")));
        root.classList.toggle("responsivePhone", phoneQuery.matches);
        // pages laid out anew only there
        root.classList.toggle("responsiveRelayout", relayoutQuery.matches);
    };

    // responsive.css follows the page's own stylesheets; this script runs in the main window and in every dialog frame
    const responsiveStylesheet = document.createElement("link");
    responsiveStylesheet.id = "responsiveStylesheet";
    responsiveStylesheet.rel = "stylesheet";
    responsiveStylesheet.type = "text/css";
    const href = new URL("css/responsive.css", window.location);
    href.search = new URLSearchParams({ v: "${CACHEID}" });
    responsiveStylesheet.href = href;
    document.head.append(responsiveStylesheet);

    colorSchemeQuery.addEventListener("change", (_event) => update());
    // the main window's queries outlive a dialog page, so its listeners go with it
    const followScreen = (query) => {
        const listening = new AbortController();
        query.addEventListener("change", ((_event) => update()), { signal: listening.signal });
        if (window.parent !== window)
            window.addEventListener("pagehide", (_event) => listening.abort());
    };
    followScreen(phoneQuery);
    followScreen(relayoutQuery);
    // Apply immediately: framed windows already have parent's ClientData loaded;
    // main window falls back to system preference until client.js calls update() after fetch
    update();

    return exports();
})();
Object.freeze(window.qBittorrent.ColorScheme);

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
            storeLook,
        };
    };

    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    // the main window's screen, also from a dialog's frame
    const phoneQuery = window.parent.matchMedia("(width < 760px)");
    // touch screens and narrower screens, where the desktop layout doesn't hold
    const relayoutQuery = window.parent.matchMedia("(pointer: coarse), (width < 1100px)");
    const clientData = window.parent.qBittorrent.ClientData;
    const isMainWindow = window.parent === window;

    // the last look, so the main window doesn't start as Classic before the client data arrives
    const lookSettings = ["color_scheme", "display_density", "display_mode"];
    const localPreferences = new window.qBittorrent.LocalPreferences.LocalPreferences();
    const storedLook = () => {
        try {
            return JSON.parse(localPreferences.get("display_look", "{}")) ?? {};
        }
        catch (error) {
            return {};
        }
    };

    // the main window, once client.js has built it, keeps its display mode until it reloads; dialogs take its mode
    let built = false;
    const builtDisplayMode = () => {
        const mainRoot = window.parent.document.documentElement;
        return mainRoot.classList.contains("modern") ? "modern" : null;
    };

    const update = (look = null) => {
        const setting = (key) => ((look !== null) ? look[key] : clientData.get(key));
        const root = document.documentElement;
        const colorScheme = setting("color_scheme");
        const validScheme = (colorScheme === "light") || (colorScheme === "dark");
        const isDark = colorSchemeQuery.matches;
        root.classList.toggle("dark", ((!validScheme && isDark) || (colorScheme === "dark")));

        const displayMode = ((look === null) && (built || !isMainWindow)) ? builtDisplayMode() : setting("display_mode");
        const isModern = (displayMode === "modern");
        root.classList.toggle("modern", isModern);
        root.classList.toggle("responsivePhone", phoneQuery.matches);
        // pages laid out anew: always in Modern, in Classic where the desktop layout doesn't hold
        root.classList.toggle("responsiveRelayout", isModern || relayoutQuery.matches);
        toggleStylesheet("modern", isModern);

        // client.js sets the density itself once the client data is there
        if (look !== null)
            root.classList.toggle("compact", look.display_density === "compact");
    };

    // called by client.js once it has the client data
    const storeLook = () => {
        built = true;
        localPreferences.set("display_look", JSON.stringify(Object.fromEntries(lookSettings.map((key) => [key, clientData.get(key) ?? null]))));
    };

    // a display mode's stylesheet loads only while the mode is on
    const toggleStylesheet = (name, enabled) => {
        const id = `${name}Stylesheet`;
        const link = document.getElementById(id);
        if (!enabled) {
            link?.remove();
            return;
        }
        if (link !== null)
            return;

        const newLink = document.createElement("link");
        newLink.id = id;
        newLink.rel = "stylesheet";
        newLink.type = "text/css";
        const href = new URL(`css/${name}.css`, window.location);
        href.search = new URLSearchParams({ v: "${CACHEID}" });
        newLink.href = href;
        document.head.append(newLink);
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
    // (in Modern, to the last look)
    const look = isMainWindow ? storedLook() : {};
    if (look.display_mode === "modern")
        update(look);
    else
        update();

    return exports();
})();
Object.freeze(window.qBittorrent.ColorScheme);

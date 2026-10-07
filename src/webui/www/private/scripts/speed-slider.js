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
 */

"use strict";

// Logarithmic speed limit sliders in Modern; elsewhere upgrade() does nothing and readKiB() reads the field as it is

window.qBittorrent ??= {};
window.qBittorrent.SpeedSlider ??= (() => {
    const exports = () => {
        return {
            upgrade: upgrade,
            readKiB: readKiB
        };
    };

    const MAX_KIB = 10 * 1024 * 1024; // 10 GiB/s
    const STEPS = 1000;
    const units = [
        ["QBT_TR(KiB)QBT_TR[CONTEXT=misc]QBT_TR(/s)QBT_TR[CONTEXT=misc]", 1],
        ["QBT_TR(MiB)QBT_TR[CONTEXT=misc]QBT_TR(/s)QBT_TR[CONTEXT=misc]", 1024],
        ["QBT_TR(GiB)QBT_TR[CONTEXT=misc]QBT_TR(/s)QBT_TR[CONTEXT=misc]", 1024 * 1024]
    ];

    const unitFor = (kib) => ((kib >= units[2][1]) ? units[2] : ((kib >= units[1][1]) ? units[1] : units[0]));
    // two significant digits in the unit shown, whole KiB/s
    const round = (kib) => {
        const [unit, factor] = unitFor(kib);
        const value = kib / factor;
        const p = (value < 10) ? 0.1 : 10 ** (Math.floor(Math.log10(value)) - 1);
        const rounded = Math.round(value / p) * p;
        return (unit === units[0][0]) ? Math.max(1, Math.round(rounded)) : Math.round(rounded * factor);
    };

    const toKiB = (pos) => ((pos <= 0) ? 0 : ((pos >= STEPS) ? MAX_KIB : Math.min(MAX_KIB, round(MAX_KIB ** (pos / STEPS)))));
    const toPos = (kib) => ((kib <= 0) ? 0 : Math.max(1, Math.min(STEPS, Math.round((Math.log(kib) / Math.log(MAX_KIB)) * STEPS))));
    // the next value along the slider, up (1) or down (-1)
    const stepKiB = (kib, direction) => {
        let pos = toPos(kib);
        while (((pos + direction) >= 0) && ((pos + direction) <= STEPS)) {
            pos += direction;
            const next = toKiB(pos);
            if ((direction > 0) ? (next > kib) : (next < kib))
                return next;
        }
        return kib;
    };

    // keys and their steps
    const stepKeys = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };

    const format = (kib) => {
        const [unit, factor] = unitFor(kib);
        return [Number((kib / factor).toFixed(2)).toString(), unit];
    };

    const parse = (text, currentUnit) => {
        const match = text.trim().match(/^([\d.,]+)\s*(\S?)/);
        if (!match)
            return 0;

        const number = Number.parseFloat(match[1].replace(",", "."));
        // a unit by its first letter, as shown or in English, else the one shown
        const letter = match[2].toLowerCase();
        const [, factor] = units.find(([unit]) => unit[0].toLowerCase() === letter) ?? units[["k", "m", "g"].indexOf(letter)] ?? units.find(([unit]) => unit === currentUnit) ?? units[0];
        return Number.isNaN(number) ? 0 : Math.min(MAX_KIB, Math.max(0, Math.round(number * factor)));
    };

    /**
     * Makes a speed limit slider logarithmic, in Modern only
     *
     * @param {HTMLInputElement} slider the range input
     * @param {HTMLInputElement} input the field showing its value
     */
    const upgrade = (slider, input, unitEl = null) => {
        if (!document.documentElement.classList.contains("modern") || slider.dataset.speedScale)
            return;

        slider.dataset.speedScale = "log";
        unitEl ??= (input.nextElementSibling?.tagName === "SPAN") ? input.nextElementSibling : null;

        let kib = Number(input.value) || 0;
        const show = () => {
            input.dataset.kib = kib;
            if (kib === 0) {
                input.value = "\u221e";
                input.dataset.unit = units[0][0];
                if (unitEl)
                    unitEl.style.visibility = "hidden";
            }
            else {
                const [value, unit] = format(kib);
                input.value = value;
                input.dataset.unit = unit;
                if (unitEl) {
                    unitEl.textContent = unit;
                    unitEl.style.visibility = "visible";
                }
            }
            input.dataset.shown = input.value;
            input.setAttribute("aria-valuenow", kib);
            input.setAttribute("aria-valuetext", (kib === 0) ? input.value : `${input.value} ${input.dataset.unit}`);
        };

        slider.min = 0;
        slider.max = STEPS;
        slider.step = 1;
        slider.value = toPos(kib);
        // before the page's own handlers, which assume a linear scale
        slider.addEventListener("input", (event) => {
            event.stopImmediatePropagation();
            kib = toKiB(Number(slider.value));
            show();
        }, true);
        input.addEventListener("change", (event) => {
            event.stopImmediatePropagation();
            kib = parse(input.value, input.dataset.unit);
            slider.value = toPos(kib);
            show();
        }, true);

        // arrows and keys step along the slider
        input.setAttribute("role", "spinbutton");
        input.setAttribute("aria-valuemin", 0);
        input.setAttribute("aria-valuemax", MAX_KIB);
        const step = (direction) => {
            kib = stepKiB(readKiB(input), direction);
            slider.value = toPos(kib);
            show();
        };

        input.addEventListener("keydown", (event) => {
            const steps = stepKeys[event.key];
            if (steps === undefined)
                return;

            event.preventDefault();
            for (let i = 0; i < Math.abs(steps); ++i)
                step(Math.sign(steps));
        });
        const stepper = document.createElement("span");
        stepper.className = "speedStepper";
        input.before(stepper);
        stepper.append(input);
        for (const direction of [1, -1]) {
            const arrow = document.createElement("span");
            arrow.className = (direction > 0) ? "speedStepperUp" : "speedStepperDown";
            arrow.setAttribute("aria-hidden", "true");
            // the focus stays in the field
            arrow.addEventListener("mousedown", (event) => event.preventDefault());
            arrow.addEventListener("click", (event) => step(direction));
            stepper.append(arrow);
        }
        show();
    };

    /**
     * @param {HTMLInputElement} input a speed field
     * @returns {number} its value in KiB/s
     */
    const readKiB = (input) => {
        if (input.dataset.kib === undefined)
            return Number(input.value);

        return (input.value === input.dataset.shown) ? Number(input.dataset.kib) : parse(input.value, input.dataset.unit);
    };

    return exports();
})();
Object.freeze(window.qBittorrent.SpeedSlider);

import { SelectionHandler } from "./SelectionHandler";

/** Returns 'light' if the hex background color is perceptually light, 'dark' otherwise. */
export function colorSchemeOf(hex: string): "light" | "dark" {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.5 ? "light" : "dark";
}

export const contentLoaded = `
    (function() {
        try {
            if (document.documentElement) {
                document.documentElement.classList.add('styles-applied');
            }
        } catch(e) {
            console.error('Error adding content loaded class:', e);
        }
        true;
    })();
`;

export function buildApplyStyles(opts: {
    backgroundColor: string;
    foregroundColor: string;
    fontSize: number;
    fontFamily: string;
    alignment: string;
    markerColor: string;
}): string {
    const {
        backgroundColor,
        foregroundColor,
        fontSize,
        fontFamily,
        alignment,
        markerColor,
    } = opts;
    const scheme = colorSchemeOf(backgroundColor);
    return `
        (function() {
            try {
                if (document.body) {
                    document.body.style.backgroundColor = '${backgroundColor}';
                    document.body.style.color = '${foregroundColor}';
                    document.body.style.fontSize = '${fontSize}px';
                    document.body.style.fontFamily = '${fontFamily}';
                    document.body.dataset.scheme = '${scheme}';
                    var chapterEl = document.querySelector('ol.simple-text');
                    if (chapterEl) chapterEl.style.textAlign = '${alignment}';
                    document.body.classList.remove('highlight-gradient', 'highlight-solid');
                    document.body.classList.add('highlight-gradient');
                }

                const elements = document.querySelectorAll('span.le-chapter, sup.le-verse');
                if (elements && elements.length > 0) {
                    elements.forEach(el => {
                        if (el) {
                            el.style.color = '${markerColor}';
                        }
                    });
                }
            } catch(e) {
                console.error('Error applying styles:', e);
            }
            true;
        })();
    `;
}

export function buildScrollScript(position: number): string {
    const elementId = position > 0 ? position : 1;
    return `
        (function() {
            try {
                // Scroll to position
                if (${position} > 0) {
                    const element = document.getElementById('${elementId}');
                    if (element) {
                        element.scrollIntoView({
                            block: 'start',
                            behavior: 'instant'
                        });
                    } else {
                        console.log('Element with id ${elementId} not found');
                    }
                }
            } catch(e) {
                console.error('JavaScript injection error: ', e);
            }
            ${contentLoaded}
            true;
        })();
        true;
    `;
}

export function buildLinkInjectedJavaScript(isIOS: boolean): string {
    return `
        (function() {
            // Prevent duplicate event listeners
            if (window.__clickHandlerInitialized) {
                return;
            }
            window.__clickHandlerInitialized = true;

            // Suppress native context menu on long-press (Android floating toolbar, iOS callout)
            document.addEventListener('contextmenu', function(e) {
                e.preventDefault();
            }, true);

            var EDGE_WIDTH = 50; // Width of edge navigation zones in pixels
            var PAGE_ZONE = 0.28; // Top/bottom fraction of screen that triggers page scroll
            var DOUBLE_TAP_MS = 300; // Window to detect double-tap and suppress page scroll
            var ROW_HEIGHT = 30; 
            var lastZoneClickTime = 0;
            var pendingPageScroll = null;

            function smoothPageScroll(distance) {
                var start = window.scrollY;
                var duration = 180;
                var startTime = performance.now();
                function step(now) {
                    var t = Math.min((now - startTime) / duration, 1);
                    var ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
                    window.scrollTo(0, start + distance * ease);
                    if (t < 1) requestAnimationFrame(step);
                }
                requestAnimationFrame(step);
            }

            document.addEventListener('click', function(e) {
                // Check if clicking on a highlight (walk up in case tap landed on a child element)
                var hlTarget = e.target;
                while (hlTarget && hlTarget !== document.body) {
                    if (hlTarget.classList && hlTarget.classList.contains('user-highlight')) break;
                    hlTarget = hlTarget.parentElement;
                }
                if (hlTarget && hlTarget !== document.body && hlTarget.classList && hlTarget.classList.contains('user-highlight')) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    var highlightId = hlTarget.getAttribute('data-highlight-id');
                    var color = hlTarget.getAttribute('data-color') || '';
                    var rect = hlTarget.getBoundingClientRect();
                    if (typeof window.__showHighlightEditModal === 'function') {
                        window.__showHighlightEditModal(highlightId, color, rect);
                    }
                    return;
                }

                // Check if clicking on a link
                var target = e.target;
                while (target && target.tagName !== 'A') {
                    target = target.parentNode;
                }
                if (target) {
                    e.preventDefault();
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'link',
                        href: target.getAttribute('href')
                    }));
                    return;
                }

                var screenWidth = window.innerWidth;
                var clickX = e.clientX;
                var clickY = e.clientY;
                var screenHeight = window.innerHeight;

                // Left/right edge navigation in the middle 80% of screen height
                var verticalMargin = screenHeight * 0.1;
                if (clickY > verticalMargin && clickY < screenHeight - verticalMargin) {
                    if (clickX < EDGE_WIDTH) {
                        e.preventDefault();
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'navigation',
                            direction: 'previous'
                        }));
                        return;
                    } else if (clickX > screenWidth - EDGE_WIDTH) {
                        e.preventDefault();
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'navigation',
                            direction: 'next'
                        }));
                        return;
                    }
                }

                // Top/bottom zone: page up / page down.
                // Debounced so a double-tap (handled natively by RNGH) cancels the scroll.
                var isTopZone = clickY < screenHeight * PAGE_ZONE;
                var isBottomZone = clickY > screenHeight * (1 - PAGE_ZONE);

                if (isTopZone || isBottomZone) {
                    var now = Date.now();
                    if (pendingPageScroll !== null && (now - lastZoneClickTime) < DOUBLE_TAP_MS) {
                        // Second tap arrived within the double-tap window — cancel the scroll.
                        clearTimeout(pendingPageScroll);
                        pendingPageScroll = null;
                        return;
                    }
                    lastZoneClickTime = now;
                    var scrollAmount = isTopZone ? -window.innerHeight + ROW_HEIGHT : window.innerHeight - ROW_HEIGHT;
                    pendingPageScroll = setTimeout(function() {
                        pendingPageScroll = null;
                        smoothPageScroll(scrollAmount);
                    }, DOUBLE_TAP_MS);
                }
            }, true);
        })();
        ${SelectionHandler.generateModalScript(isIOS)}
        ${SelectionHandler.generateSelectionScript(300, !isIOS)}
        true;
    `;
}

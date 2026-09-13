/**
 * SelectionHandler.ts
 * Handles text selection events in WebView and creates Range objects
 * Enhanced to support paragraph-relative character offsets for persistent highlights
 */

import { Highlight } from "../data/UserDatabaseSchema";

export interface RangeData {
    // Original DOM path data (kept for debugging)
    startContainerPath: number[];
    startOffset: number;
    endContainerPath: number[];
    endOffset: number;
    selectedText: string;
    commonAncestorPath: number[];

    // NEW: Paragraph-relative data for persistent storage
    paragraphPosition: number | null; // Numeric ID of the start paragraph element
    paragraphStartOffset: number | null; // Character offset from start of paragraphPosition to selection start
    paragraphEndOffset: number | null; // Character offset from start of paragraphPosition to selection end (single-paragraph only)
    spansParagraphs: boolean; // True if selection crosses paragraph boundaries
    endParagraphPosition: number | null; // Numeric ID of the end paragraph (multi-paragraph only)
    endParagraphOffset: number | null; // Character offset from start of endParagraphPosition to selection end (multi-paragraph only)

    // Position data for modal placement
    position?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
}

export class SelectionHandler {
    /**
     * Generates JavaScript code to inject into WebView for handling text selection
     * Returns a script that listens for selectionchange events and posts Range data
     * @param debounceMs - Milliseconds to debounce selection events (default: 300)
     */
    static generateSelectionScript(
        debounceMs: number = 300,
        autoShowModal: boolean = true,
    ): string {
        const script = `
            (function() {
                // Prevent duplicate selection handlers
                if (window.__selectionHandlerInitialized) {
                    return;
                }
                window.__selectionHandlerInitialized = true;

                var selectionTimeout = null;
                var lastSelectionText = '';
                var selectionChangeCount = 0;

                // Debounce helper that only fires if selection is stable
                function debounce(func, wait) {
                    return function() {
                        var context = this;
                        var args = arguments;
                        var currentSelection = window.getSelection();
                        var currentText = currentSelection ? currentSelection.toString() : '';

                        // Track selection changes
                        if (currentText !== lastSelectionText) {
                            lastSelectionText = currentText;
                            selectionChangeCount++;
                            // Hide the modal while the user is dragging selection handles,
                            // without clearing the selection itself.
                            // Don't hide when selection is cleared (e.g. tapping a modal button) —
                            // the document click listener handles that case.
                            if (currentText !== '' && typeof window.__hideHighlightModalKeepSelection === 'function') {
                                window.__hideHighlightModalKeepSelection();
                            }
                        }

                        clearTimeout(selectionTimeout);
                        selectionTimeout = setTimeout(function() {
                            // Only trigger if selection hasn't changed in the last interval
                            // This ensures user is done adjusting selection handles
                            selectionChangeCount = 0;
                            func.apply(context, args);
                        }, wait);
                    };
                }

                // Find paragraph element containing a node (element with numeric ID)
                function findParagraphContainer(node) {
                    // Start from the node itself if it's an element, or its parent if it's a text node
                    var current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
                    var depth = 0;
                    var maxDepth = 20; // Prevent infinite loops

                    while (current && current !== document.body && current !== document.documentElement && depth < maxDepth) {
                        // Check if this element has a numeric ID
                        if (current.nodeType === Node.ELEMENT_NODE && current.id) {
                            if (/^\\d+$/.test(current.id)) {
                                return {
                                    element: current,
                                    position: parseInt(current.id, 10)
                                };
                            }
                        }
                        current = current.parentElement;
                        depth++;
                    }

                    return null;
                }

                // Calculate character offset from paragraph start to a specific node/offset
                function getCharacterOffsetInParagraph(paragraphElement, targetNode, targetOffset) {
                    var range = document.createRange();
                    range.setStart(paragraphElement, 0);
                    range.setEnd(targetNode, targetOffset);
                    return range.toString().length;  // Text content length (no HTML tags)
                }

                // Helper function to get the path to a node from the document root
                function getNodePath(node) {
                    var path = [];
                    while (node && node !== document) {
                        var parent = node.parentNode;
                        if (parent) {
                            var index = Array.prototype.indexOf.call(parent.childNodes, node);
                            path.unshift(index);
                        }
                        node = parent;
                    }
                    return path;
                }

                // Handle selection change
                function handleSelectionChange() {
                    var selection = window.getSelection();
                    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                        var range = selection.getRangeAt(0);

                        // Additional check: ensure selection has at least 2 characters
                        // This helps avoid capturing accidental single-character selections
                        var selectedText = selection.toString().trim();
                        if (selectedText.length < 2) {
                            return;
                        }

                        // Find paragraph containers for start and end
                        var startParagraph = findParagraphContainer(range.startContainer);
                        var endParagraph = findParagraphContainer(range.endContainer);

                        // Calculate paragraph-relative offsets
                        var paragraphPosition = null;
                        var paragraphStartOffset = null;
                        var paragraphEndOffset = null;
                        var spansParagraphs = false;
                        var endParagraphPosition = null;
                        var endParagraphOffset = null;

                        if (startParagraph && endParagraph) {
                            if (startParagraph.position === endParagraph.position) {
                                // Selection within single paragraph
                                paragraphPosition = startParagraph.position;
                                paragraphStartOffset = getCharacterOffsetInParagraph(
                                    startParagraph.element,
                                    range.startContainer,
                                    range.startOffset
                                );
                                paragraphEndOffset = getCharacterOffsetInParagraph(
                                    startParagraph.element,
                                    range.endContainer,
                                    range.endOffset
                                );
                                spansParagraphs = false;
                            } else {
                                // Selection spans multiple paragraphs
                                spansParagraphs = true;
                                paragraphPosition = startParagraph.position;
                                paragraphStartOffset = getCharacterOffsetInParagraph(
                                    startParagraph.element,
                                    range.startContainer,
                                    range.startOffset
                                );
                                endParagraphPosition = endParagraph.position;
                                endParagraphOffset = getCharacterOffsetInParagraph(
                                    endParagraph.element,
                                    range.endContainer,
                                    range.endOffset
                                );
                            }
                        }

                        // Get the bounding rectangle of the selection
                        var selectionRect = range.getBoundingClientRect();

                        // Create a serializable representation of the Range
                        var rangeData = {
                            startContainerPath: getNodePath(range.startContainer),
                            startOffset: range.startOffset,
                            endContainerPath: getNodePath(range.endContainer),
                            endOffset: range.endOffset,
                            selectedText: selection.toString(),
                            commonAncestorPath: getNodePath(range.commonAncestorContainer),
                            paragraphPosition: paragraphPosition,
                            paragraphStartOffset: paragraphStartOffset,
                            paragraphEndOffset: paragraphEndOffset,
                            spansParagraphs: spansParagraphs,
                            endParagraphPosition: endParagraphPosition,
                            endParagraphOffset: endParagraphOffset,
                            position: {
                                top: selectionRect.top,
                                bottom: selectionRect.bottom,
                                left: selectionRect.left,
                                right: selectionRect.right
                            }
                        };

                        var canHighlight = rangeData.paragraphPosition !== null && rangeData.paragraphStartOffset !== null &&
                            (!rangeData.spansParagraphs
                                ? rangeData.paragraphEndOffset !== null
                                : rangeData.endParagraphPosition !== null && rangeData.endParagraphOffset !== null);

                        if (canHighlight) {
                            window.__lastRangeData = rangeData;
                            ${autoShowModal ? `if (typeof window.__showHighlightModal === 'function') { window.__showHighlightModal(rangeData); }` : ""}
                        }
                    }
                }

                // Listen for text selection changes with debouncing
                // Using passive: true to avoid blocking the native selection UI
                document.addEventListener('selectionchange', debounce(handleSelectionChange, ${debounceMs}), { passive: true });
            })();
            true;
        `;
        return script;
    }

    /**
     * Generates JavaScript code to inject an in-WebView highlight modal.
     * The modal lives in the WebView DOM (always present, hidden until needed),
     * so it shows instantly without any bridge roundtrip.
     */
    static generateModalScript(iosMode: boolean = false): string {
        const copySearchDefineJS = iosMode
            ? ""
            : `
                var copyBtn = mkLabeledBtn('copy', 'Copy');
                copyBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var text = state.selectedText;
                    if (text) {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(text).catch(function() {});
                        } else {
                            var ta = document.createElement('textarea');
                            ta.value = text;
                            ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            document.body.removeChild(ta);
                        }
                    }
                    hideModal();
                    window.ReactNativeWebView.postMessage(JSON.stringify({type:'modalClosed'}));
                });

                var searchBtn = mkLabeledBtn('search', 'Search');
                searchBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (state.selectedText) {
                        var searchText = state.selectedText;
                        if (searchText.length > 150) {
                            searchText = searchText.slice(0, 150).replace(/\\s+\\S*$/, '');
                        }
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'searchText',
                            text: searchText,
                        }));
                    }
                    hideModal();
                });

                var defineBtn = mkLabeledBtn('define', 'Define');
                defineBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (state.selectedText) {
                        var defineText = state.selectedText;
                        if (defineText.length > 150) {
                            defineText = defineText.slice(0, 150).replace(/\\s+\\S*$/, '');
                        }
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'defineText',
                            text: defineText,
                        }));
                    }
                    hideModal();
                });
        `;

        const actionRowAppendsJS = iosMode
            ? ""
            : `
                actionRow.appendChild(copyBtn);
                actionRow.appendChild(searchBtn);
                actionRow.appendChild(defineBtn);
        `;

        const updateRemoveBtnJS = iosMode
            ? `
                function updateRemoveBtn() {
                    var enabled = state.isEditing && !!state.highlightId;
                    actionRow.style.display = enabled ? 'flex' : 'none';
                }
        `
            : `
                function updateRemoveBtn() {
                    var enabled = state.isEditing && !!state.highlightId;
                    removeBtn.style.opacity = enabled ? '1' : '0.35';
                    removeBtn.style.cursor = enabled ? 'pointer' : 'default';
                }
        `;

        return `
            (function() {
                if (window.__highlightModalInitialized) return;
                if (!document.body) return;
                window.__highlightModalInitialized = true;

                var COLORS = [
                    {color:'hsl(0,100%,27%)'},
                    {color:'hsl(30,100%,40%)'},
                    {color:'hsl(55,100%,30%)'},
                    {color:'hsl(96,57%,20%)'},
                    {color:'hsl(189,100%,25%)'},
                    {color:'hsl(217,85%,34%)'},
                    {color:'hsl(267,75%,31%)'},
                ];
                var ICONS = {
                    check:  'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
                    del:    'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
                    mark:   'M0 479.98L99.92 512l35.45-35.45-67.04-67.04L0 479.98zm124.61-240.01a36.592 36.592 0 0 0-10.79 38.1l13.05 42.83-50.93 50.94 96.23 96.23 50.86-50.86 42.74 13.08c13.73 4.2 28.65-.01 38.15-10.78l35.55-41.64-173.34-173.34-41.52 35.44zm403.31-160.7l-63.2-63.2c-20.49-20.49-53.38-21.52-75.12-2.35L190.55 183.68l169.77 169.78L530.27 154.4c19.18-21.74 18.15-54.63-2.35-75.13z',
                    under:  'M5 21h14v-2H5v2zm7-4c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6z',
                    copy:   'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
                    search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
                    define: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h4v-2H5V8h14v10h-4v2h4c1.1 0 2-.9 2-2V6c0-1.1-.89-2-2-2zm-7 6l-4 4h3v6h2v-6h3l-4-4z',
                    chevronRight: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
                };

                var NS = 'http://www.w3.org/2000/svg';
                function mkSvg(path, fill, size, vb) {
                    var svg = document.createElementNS(NS, 'svg');
                    svg.setAttribute('width', String(size || 24));
                    svg.setAttribute('height', String(size || 24));
                    svg.setAttribute('viewBox', vb || '0 0 24 24');
                    var p = document.createElementNS(NS, 'path');
                    p.setAttribute('fill', fill);
                    p.setAttribute('d', path);
                    svg.appendChild(p);
                    return svg;
                }
                function mkEl(tag, css) {
                    var el = document.createElement(tag);
                    el.style.cssText = css;
                    return el;
                }
                function mkIconBtn(w, h, r, bg) {
                    return mkEl('div',
                        'width:'+w+'px;height:'+h+'px;border-radius:'+r+'px;' +
                        'background:'+bg+';display:flex;align-items:center;' +
                        'justify-content:center;cursor:pointer;flex-shrink:0;');
                }
                var state = {
                    isEditing: false,
                    highlightId: null,
                    rangeData: null,
                    selectedColor: 'hsl(50,100%,26%)',
                    selectedText: '',
                    markType: 'highlight',
                };

                var modal = mkEl('div',
                    'position:fixed;left:50%;transform:translateX(-50%);' +
                    'max-width:85vw;background:hsl(0,0%,17%);border-radius:12px;' +
                    'padding:12px;box-shadow:0 4px 20px rgba(0,0,0,0.5);' +
                    'z-index:99999;display:none;flex-direction:column;gap:10px;' +
                    'box-sizing:border-box;-webkit-user-select:none;user-select:none;');
                modal.id = '__hlmodal';

                var topRow = mkEl('div', 'display:flex;flex-direction:row;align-items:center;gap:4px;row-gap:0px;');

                var hlBtn = mkIconBtn(44, 44, 8, 'hsl(204,66%,64%)');
                hlBtn.appendChild(mkSvg(ICONS.mark, 'white', 24, '0 0 544 512'));

                var ulBtn = mkIconBtn(44, 44, 8, 'hsl(0,0%,24%)');
                ulBtn.appendChild(mkSvg(ICONS.under, 'white', 24));

                var divider = mkEl('div',
                    'width:1px;height:40px;background:hsl(0,0%,33%);margin:0 4px;flex-shrink:0;');

                // ---- Color row (inline in top row) ----
                var colorRow = mkEl('div',
                    'display:flex;flex-direction:row;gap:4px;padding:0 0;flex:1;' +
                    'align-items:center;overflow-x:auto;-webkit-overflow-scrolling:touch;');

                COLORS.forEach(function(item) {
                    var circle = mkEl('div',
                        'width:36px;height:36px;border-radius:18px;background:'+item.color+';' +
                        'border:2px solid hsl(0,0%,33%);display:flex;align-items:center;' +
                        'justify-content:center;cursor:pointer;flex-shrink:0;box-sizing:border-box;');
                    circle.setAttribute('data-color', item.color);

                    var checkEl = mkEl('div', 'display:none;align-items:center;justify-content:center;');
                    checkEl.appendChild(mkSvg(ICONS.check, 'white', 20));
                    circle.appendChild(checkEl);

                    circle.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var color = this.getAttribute('data-color');
                        state.selectedColor = color;
                        updateChecks();
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'colorSelect',
                            color: color,
                            markType: state.markType,
                            isEditing: state.isEditing,
                            highlightId: state.highlightId,
                            rangeData: state.rangeData,
                        }));
                        hideModal();
                    });
                    colorRow.appendChild(circle);
                });

                var scrollCaret = mkEl('div',
                    'width:16px;overflow:hidden;display:flex;align-items:center;justify-content:center;' +
                    'flex-shrink:0;pointer-events:none;');
                scrollCaret.appendChild(mkSvg(ICONS.chevronRight, 'hsl(0,0%,70%)', 22));

                topRow.appendChild(hlBtn);
                topRow.appendChild(ulBtn);
                topRow.appendChild(divider);
                topRow.appendChild(colorRow);
                topRow.appendChild(scrollCaret);

                // ---- Action row (Copy / Search / Remove) ----
                var actionRow = mkEl('div',
                    'display:flex;flex-direction:row;gap:4px;justify-content:space-evenly;' +
                    'padding-top:4px;border-top:1px solid hsl(0,0%,26%);margin-top:2px;');

                function mkLabeledBtn(iconKey, label) {
                    var wrapper = mkEl('div',
                        'display:flex;flex-direction:column;align-items:center;gap:3px;' +
                        'cursor:pointer;min-width:56px;padding:4px 0;');
                    var iconDiv = mkIconBtn(40, 40, 8, 'hsl(0,0%,24%)');
                    iconDiv.appendChild(mkSvg(ICONS[iconKey], 'white', 22));
                    var lbl = document.createElement('span');
                    lbl.style.cssText = 'color:hsl(0,0%,72%);font-size:11px;font-family:sans-serif;' +
                        '-webkit-user-select:none;user-select:none;text-align:center;';
                    lbl.textContent = label;
                    wrapper.appendChild(iconDiv);
                    wrapper.appendChild(lbl);
                    return wrapper;
                }

                ${copySearchDefineJS}

                var removeBtn = mkLabeledBtn('del', 'Remove');
                removeBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (!state.isEditing || !state.highlightId) return;
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'deleteHighlight',
                        highlightId: state.highlightId,
                    }));
                    hideModal();
                });

                ${actionRowAppendsJS}
                actionRow.appendChild(removeBtn);

                ${updateRemoveBtnJS}

                modal.appendChild(topRow);
                modal.appendChild(actionRow);
                document.body.appendChild(modal);

                document.addEventListener('click', function(e) {
                    if (modal.style.display !== 'none' && !modal.contains(e.target)) {
                        hideModal();
                        window.ReactNativeWebView.postMessage(JSON.stringify({type:'modalClosed'}));
                    }
                }, true);

                function updateChecks() {
                    var circles = colorRow.querySelectorAll('[data-color]');
                    circles.forEach(function(el) {
                        var ch = el.querySelector('div');
                        if (ch) ch.style.display = el.getAttribute('data-color') === state.selectedColor ? 'flex' : 'none';
                    });
                }

                function updateStyleToggle() {
                    var isHL = state.markType === 'highlight';
                    hlBtn.style.background = isHL ? 'hsl(204,66%,64%)' : 'hsl(0,0%,24%)';
                    ulBtn.style.background = isHL ? 'hsl(0,0%,24%)' : 'hsl(204,66%,64%)';
                }

                // Use touchstart preventDefault + touchend for hl/ul toggle buttons so that
                // tapping them does not clear the active text selection (native browser behavior).
                function addToggleTap(btn, handler) {
                    btn.addEventListener('touchstart', function(e) { e.preventDefault(); e.stopPropagation(); }, { passive: false });
                    btn.addEventListener('touchend', function(e) { e.stopPropagation(); handler(); });
                    // Fallback for desktop/mouse
                    btn.addEventListener('click', function(e) { e.stopPropagation(); handler(); });
                }

                addToggleTap(hlBtn, function() {
                    if (state.markType === 'highlight') return;
                    state.markType = 'highlight';
                    updateStyleToggle();
                    if (state.isEditing && state.highlightId) {
                        var hlEl = document.querySelector('[data-highlight-id="' + state.highlightId + '"]');
                        if (hlEl) hlEl.setAttribute('data-mark-type', 'highlight');
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'updateMarkType',
                            highlightId: state.highlightId,
                            markType: 'highlight',
                        }));
                    }
                });

                addToggleTap(ulBtn, function() {
                    if (state.markType === 'underline') return;
                    state.markType = 'underline';
                    updateStyleToggle();
                    if (state.isEditing && state.highlightId) {
                        var hlEl = document.querySelector('[data-highlight-id="' + state.highlightId + '"]');
                        if (hlEl) hlEl.setAttribute('data-mark-type', 'underline');
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'updateMarkType',
                            highlightId: state.highlightId,
                            markType: 'underline',
                        }));
                    }
                });

                function positionModal(rect) {
                    var vp = window.innerHeight;
                    var mh = modal.offsetHeight || 110;
                    if (rect && rect.top - mh - 24 > 0) {
                        modal.style.top = (rect.top - mh - 20) + 'px';
                        modal.style.bottom = 'auto';
                    } else if (rect && rect.bottom + mh + 24 < vp) {
                        modal.style.top = (rect.bottom + 20) + 'px';
                        modal.style.bottom = 'auto';
                    } else {
                        modal.style.top = 'auto';
                        modal.style.bottom = '20px';
                    }
                }

                function hideModal() {
                    modal.style.display = 'none';
                    state.isEditing = false;
                    state.highlightId = null;
                    state.rangeData = null;
                    var sel = window.getSelection();
                    if (sel) sel.removeAllRanges();
                }

                window.__showHighlightModal = function(rangeData) {
                    state.isEditing = false;
                    state.highlightId = null;
                    state.rangeData = rangeData;
                    state.selectedText = (rangeData && rangeData.selectedText) ? rangeData.selectedText : '';
                    state.markType = 'highlight';
                    updateChecks();
                    updateStyleToggle();
                    updateRemoveBtn();
                    modal.style.display = 'flex';
                    setTimeout(function() {
                        positionModal(rangeData && rangeData.position ? rangeData.position : null);
                    }, 0);
                };

                window.__showHighlightEditModal = function(highlightId, color, rect, markType) {
                    state.isEditing = true;
                    state.highlightId = highlightId;
                    state.rangeData = null;
                    if (color) state.selectedColor = color;
                    state.markType = markType || 'highlight';
                    var hlEl = document.querySelector('[data-highlight-id="' + highlightId + '"]');
                    state.selectedText = hlEl ? (hlEl.textContent || '') : '';
                    updateChecks();
                    updateStyleToggle();
                    updateRemoveBtn();
                    modal.style.display = 'flex';
                    setTimeout(function() { positionModal(rect); }, 0);
                };

                window.__hideHighlightModal = hideModal;
                // Hides the modal visually without clearing the selection —
                // used while the user is still dragging selection handles.
                window.__hideHighlightModalKeepSelection = function() {
                    modal.style.display = 'none';
                };

                // Touch-based tap and long-press detection for existing highlights.
                // We cannot rely on 'click' events on mobile WebView for elements with
                // user-select:none, so we track touchstart/touchend directly.
                var _hts = null;
                var _htTimer = null;

                function findHighlightAncestor(el) {
                    while (el && el !== document.body) {
                        if (el.classList && el.classList.contains('user-highlight')) return el;
                        el = el.parentElement;
                    }
                    return null;
                }

                document.addEventListener('touchstart', function(e) {
                    if (_htTimer) { clearTimeout(_htTimer); _htTimer = null; }
                    var hl = findHighlightAncestor(e.target);
                    _hts = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY,
                        t: Date.now(),
                        target: e.target,
                        hl: hl,
                    };
                    if (hl) {
                        // Long-press: fire after 500ms if finger hasn't moved
                        var captured = hl;
                        _htTimer = setTimeout(function() {
                            _hts = null;
                            // Clear any accidental text selection the browser started
                            var sel = window.getSelection();
                            if (sel) sel.removeAllRanges();
                            var id = captured.getAttribute('data-highlight-id');
                            var color = captured.getAttribute('data-color') || '';
                            var markType = captured.getAttribute('data-mark-type') || 'highlight';
                            var rect = captured.getBoundingClientRect();
                            if (window.__showHighlightEditModal) {
                                window.__showHighlightEditModal(id, color, rect, markType);
                            }
                        }, 500);
                    }
                }, { passive: true });

                document.addEventListener('touchmove', function() {
                    if (_htTimer) { clearTimeout(_htTimer); _htTimer = null; }
                    if (_hts) _hts = null;
                }, { passive: true });

                document.addEventListener('touchend', function(e) {
                    if (_htTimer) { clearTimeout(_htTimer); _htTimer = null; }
                    if (!_hts) return;
                    var touch = e.changedTouches[0];
                    var dx = Math.abs(touch.clientX - _hts.x);
                    var dy = Math.abs(touch.clientY - _hts.y);
                    var dt = Date.now() - _hts.t;
                    var hl = _hts.hl;
                    _hts = null;
                    // Tap: short duration + minimal movement + started on a highlight
                    if (hl && dt < 400 && dx < 12 && dy < 12) {
                        e.preventDefault();
                        var sel = window.getSelection();
                        if (sel) sel.removeAllRanges();
                        var id = hl.getAttribute('data-highlight-id');
                        var color = hl.getAttribute('data-color') || '';
                        var markType = hl.getAttribute('data-mark-type') || 'highlight';
                        var rect = hl.getBoundingClientRect();
                        if (window.__showHighlightEditModal) {
                            window.__showHighlightEditModal(id, color, rect, markType);
                        }
                    }
                }, { passive: false });
            })();
        `;
    }

    /**
     * Generates JavaScript code to restore a Range from RangeData
     * This can be used to recreate a selection in the WebView
     */
    static generateRestoreRangeScript(rangeData: RangeData): string {
        return `
            (function() {
                try {
                    function getNodeByPath(path) {
                        var node = document;
                        for (var i = 0; i < path.length; i++) {
                            node = node.childNodes[path[i]];
                            if (!node) return null;
                        }
                        return node;
                    }

                    var startContainer = getNodeByPath(${JSON.stringify(rangeData.startContainerPath)});
                    var endContainer = getNodeByPath(${JSON.stringify(rangeData.endContainerPath)});

                    if (startContainer && endContainer) {
                        var range = document.createRange();
                        range.setStart(startContainer, ${rangeData.startOffset});
                        range.setEnd(endContainer, ${rangeData.endOffset});

                        var selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                } catch(e) {
                    console.error('Error restoring range:', e);
                }
                true;
            })();
        `;
    }

    /**
     * Generates JavaScript code to remove all existing highlight spans from the DOM
     * @returns JavaScript code as a string
     */
    static generateRemoveHighlightsScript(): string {
        return `
            (function() {
                try {
                    var highlightSpans = document.querySelectorAll('.user-highlight');
                    highlightSpans.forEach(function(span) {
                        // Replace the span with its child nodes (preserves child elements like verse/chapter markers)
                        var parent = span.parentNode;
                        while (span.firstChild) {
                            parent.insertBefore(span.firstChild, span);
                        }
                        parent.removeChild(span);
                    });

                    // Normalize text nodes to merge adjacent text nodes
                    document.body.normalize();
                } catch (e) {
                    console.error('Error removing highlights:', e);
                }
                true;
            })();
        `;
    }

    /**
     * Generates JavaScript code that removes highlight spans whose id is no
     * longer present in the given set of valid ids, leaving the rest untouched.
     * Used to reconcile the DOM after highlights are deleted elsewhere (e.g. the
     * Annotations screen) without flickering the highlights that remain.
     * @param validIds - Ids of highlights that should stay in the DOM
     * @returns JavaScript code as a string
     */
    static generatePruneHighlightsScript(validIds: string[]): string {
        return `
            (function() {
                try {
                    var validIds = ${JSON.stringify(validIds)};
                    var valid = Object.create(null);
                    validIds.forEach(function(id) { valid[id] = true; });

                    var removedAny = false;
                    var highlightSpans = document.querySelectorAll('.user-highlight');
                    highlightSpans.forEach(function(span) {
                        var id = span.getAttribute('data-highlight-id');
                        if (id && valid[id]) return;
                        // Unwrap: replace the span with its child nodes
                        var parent = span.parentNode;
                        if (!parent) return;
                        while (span.firstChild) {
                            parent.insertBefore(span.firstChild, span);
                        }
                        parent.removeChild(span);
                        removedAny = true;
                    });

                    if (removedAny) {
                        // Merge adjacent text nodes left behind by unwrapping
                        document.body.normalize();
                    }
                } catch (e) {
                    console.error('Error pruning highlights:', e);
                }
                true;
            })();
        `;
    }

    /**
     * Generates JavaScript code to apply highlights to a chapter
     * Takes an array of highlights and wraps them in styled span elements
     * @param highlights - Array of Highlight objects to apply
     * @returns JavaScript code as a string
     */
    static generateApplyHighlightsScript(highlights: Highlight[]): string {
        // Separate single-paragraph and multi-paragraph highlights
        const singleParaByParagraph: { [position: number]: Highlight[] } = {};
        const multiParaHighlights: Highlight[] = [];

        highlights.forEach((h) => {
            const endPara = h.end_paragraph_position ?? h.paragraph_position;
            if (endPara === h.paragraph_position) {
                if (!singleParaByParagraph[h.paragraph_position]) {
                    singleParaByParagraph[h.paragraph_position] = [];
                }
                singleParaByParagraph[h.paragraph_position].push(h);
            } else {
                multiParaHighlights.push(h);
            }
        });

        return `
            (function() {
                try {
                    var highlights = ${JSON.stringify(singleParaByParagraph)};
                    var multiHighlights = ${JSON.stringify(multiParaHighlights)};

                    // Lighten an hsl() color for use as an underline on dark backgrounds
                    function lightenForUnderline(hslStr) {
                        var m = hslStr.match(/hsl\\((\\d+),\\s*(\\d+)%,\\s*(\\d+)%\\)/);
                        if (!m) return hslStr;
                        var newL = Math.min(parseInt(m[3]) + 45, 85);
                        return 'hsl(' + m[1] + ',' + m[2] + '%,' + newL + '%)';
                    }

                    // Pastel version of an hsl() color for highlights on light backgrounds
                    function lightenForLightBg(hslStr) {
                        var m = hslStr.match(/hsl\\((\\d+),\\s*(\\d+)%,\\s*(\\d+)%\\)/);
                        if (!m) return hslStr;
                        var newS = Math.min(parseInt(m[2]), 75);
                        var newL = Math.min(parseInt(m[3]) + 48, 80);
                        return 'hsl(' + m[1] + ',' + newS + '%,' + newL + '%)';
                    }

                    // Walk text nodes to recreate range from character offsets
                    function createRangeFromOffsets(paragraphElement, startOffset, endOffset) {
                        var range = document.createRange();
                        var charCount = 0;
                        var startNode = null, endNode = null;
                        var startNodeOffset = 0, endNodeOffset = 0;

                        function walkTextNodes(node) {
                            if (node.nodeType === Node.TEXT_NODE) {
                                var textLength = node.textContent.length;

                                if (!startNode && charCount + textLength >= startOffset) {
                                    startNode = node;
                                    startNodeOffset = startOffset - charCount;
                                }

                                if (!endNode && charCount + textLength >= endOffset) {
                                    endNode = node;
                                    endNodeOffset = endOffset - charCount;
                                    return true;
                                }

                                charCount += textLength;
                            } else {
                                for (var i = 0; i < node.childNodes.length; i++) {
                                    if (walkTextNodes(node.childNodes[i])) return true;
                                }
                            }
                            return false;
                        }

                        walkTextNodes(paragraphElement);

                        if (startNode && endNode) {
                            range.setStart(startNode, startNodeOffset);
                            range.setEnd(endNode, endNodeOffset);
                            return range;
                        }

                        return null;
                    }

                    // Process each paragraph with highlights
                    Object.keys(highlights).forEach(function(position) {
                        var paragraphElement = document.getElementById(position);
                        if (!paragraphElement) return;

                        var paragraphHighlights = highlights[position];

                        // Sort descending to apply end-to-start (prevents offset drift)
                        paragraphHighlights.sort(function(a, b) {
                            return b.start_offset - a.start_offset;
                        });

                        paragraphHighlights.forEach(function(highlight) {
                            try {
                                var range = createRangeFromOffsets(
                                    paragraphElement,
                                    highlight.start_offset,
                                    highlight.end_offset
                                );

                                if (range) {
                                    var span = document.createElement('span');
                                    span.className = 'user-highlight';
                                    span.style.setProperty('--highlight-color', highlight.color);
                                    span.style.setProperty('--underline-color', lightenForUnderline(highlight.color));
                                    span.style.setProperty('--light-highlight-color', lightenForLightBg(highlight.color));
                                    span.setAttribute('data-highlight-id', highlight.id);
                                    span.setAttribute('data-color', highlight.color);
                                    span.setAttribute('data-mark-type', highlight.mark_type || 'highlight');
                                    // extractContents handles ranges that cross element boundaries
                                    // (e.g. verse/chapter markers), unlike surroundContents which throws
                                    var fragment = range.extractContents();
                                    span.appendChild(fragment);
                                    range.insertNode(span);
                                }
                            } catch (e) {
                                console.warn('Failed to apply highlight:', highlight.id, e);
                                // Notify React Native to delete this orphan from the DB
                                if (window.ReactNativeWebView) {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({
                                        type: 'deleteOrphanHighlight',
                                        highlightId: highlight.id,
                                    }));
                                }
                            }
                        });
                    });

                    // Apply multi-paragraph highlights
                    multiHighlights.forEach(function(highlight) {
                        try {
                            var startPos = highlight.paragraph_position;
                            var endPos = highlight.end_paragraph_position;

                            // Collect all paragraphs with numeric IDs between start and end (inclusive)
                            var allParas = Array.prototype.slice.call(document.querySelectorAll('[id]')).filter(function(el) {
                                var id = parseInt(el.id, 10);
                                return !isNaN(id) && id >= startPos && id <= endPos;
                            }).sort(function(a, b) {
                                return parseInt(a.id, 10) - parseInt(b.id, 10);
                            });

                            if (allParas.length === 0) return;

                            // Apply spans from last paragraph to first to avoid offset drift
                            for (var pi = allParas.length - 1; pi >= 0; pi--) {
                                var para = allParas[pi];
                                var paraStartOffset, paraEndOffset;
                                if (allParas.length === 1) {
                                    paraStartOffset = highlight.start_offset;
                                    paraEndOffset = highlight.end_offset;
                                } else if (pi === 0) {
                                    paraStartOffset = highlight.start_offset;
                                    paraEndOffset = para.textContent.length;
                                } else if (pi === allParas.length - 1) {
                                    paraStartOffset = 0;
                                    paraEndOffset = highlight.end_offset;
                                } else {
                                    paraStartOffset = 0;
                                    paraEndOffset = para.textContent.length;
                                }

                                var range = createRangeFromOffsets(para, paraStartOffset, paraEndOffset);
                                if (range) {
                                    var span = document.createElement('span');
                                    span.className = 'user-highlight';
                                    span.style.setProperty('--highlight-color', highlight.color);
                                    span.style.setProperty('--underline-color', lightenForUnderline(highlight.color));
                                    span.style.setProperty('--light-highlight-color', lightenForLightBg(highlight.color));
                                    span.setAttribute('data-highlight-id', highlight.id);
                                    span.setAttribute('data-color', highlight.color);
                                    span.setAttribute('data-mark-type', highlight.mark_type || 'highlight');
                                    var fragment = range.extractContents();
                                    span.appendChild(fragment);
                                    range.insertNode(span);
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to apply multi-paragraph highlight:', highlight.id, e);
                            if (window.ReactNativeWebView) {
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'deleteOrphanHighlight',
                                    highlightId: highlight.id,
                                }));
                            }
                        }
                    });
                } catch (e) {
                    console.error('Error applying highlights:', e);
                }
                true;
            })();
        `;
    }
}

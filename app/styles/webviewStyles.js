const webviewStyles = `
    * {
        box-sizing: border-box;
    }
    html {
        margin: 0;
        padding: 32px;
        width: 100%;
        height: 100%;
        -webkit-text-size-adjust: 100%;
        -webkit-overflow-scrolling: touch;
        -webkit-touch-callout: none;
    }
    body {
        font-family: 'Assistant-Regular';
        background-color: white;
        font-size: 16px;
        padding: 0;
        padding-bottom: 32px;
        margin: 0;
        user-select: auto;
        touch-action: manipulation;
        -webkit-overflow-scrolling: touch;
        overflow-y: auto;
        -webkit-touch-callout: none;
    }   
    body[style*="background-color: rgb(26, 27, 38)"] a,
    body[style*="background-color: rgb(34, 34, 34)"] a,
    body[style*="background-color: rgb(40, 37, 36)"] a {
        color: #69A6D5;
    }
    /* In-text scripture reference links */
    a.scripture-ref {
        color: #1a56a8;
        text-decoration: none;
        cursor: pointer;
    }
    body[data-scheme="dark"] a.scripture-ref {
        color: #69A6D5;
    }
    img {
        width: 100%;
    }
    ol.simple-text {
        margin: 0;
        list-style: none;
        counter-reset: item;
        text-align: justify;
        padding: 0;
    }
    li[id] {
        counter-increment: item;
        margin-bottom: 5px;
    }
    li[id]:before {
        margin-right: 10px;
        content: counter(item);
        width: 1.2em;
        text-align: center;
        display: inline-block;
    }
    span.le-chapter {
        display: inline-block;
        position: relative;
        color: #ba3919;
        padding-right: 12px;
        padding-left: 12px;
        font-weight: bold;
    }
    body.hide-le span.le-chapter {
        display: none;
    }
    sup.le-verse {
        display: inline-block;
        position: relative;
        color: #ba3919;
        font-weight: bold;
        font-size: .8em;
        vertical-align: text-top;
        line-height: inherit;
        padding-right: 2px;
        padding-top: .2em;
    }
    li sup.le-verse:first-of-type {
        padding-left: 4px;
    }
    body.hide-le sup.le-verse {
        display: none;
    }
    section#scriptureText {
        margin-bottom: 160px;
    }
    .SMALL-CAPS {
        font-variant: small-caps;
        font-size: 1.05em;
    }
    div.p-block {
        margin-top: 1em;
        margin-bottom: 1em;
    }

    /* User highlights */
    .user-highlight {
        -webkit-user-select: none;
        user-select: none;
        touch-action: manipulation;
        /* Near-invisible background-color ensures the full element box is a touch target.
           Without this, transparent gradient areas fall through to the parent on mobile WebView. */
        background-color: rgba(0, 0, 0, 0.001);
        /* Use background-image instead of background-color for line-by-line effect */
        background-image: linear-gradient(
            to bottom,
            transparent 0%,
            transparent 10%,
            var(--highlight-color, hsl(50, 100%, 26%)) 10%,
            var(--highlight-color, hsl(50, 100%, 26%)) 90%,
            transparent 90%,
            transparent 100%
        );
        border-radius: 2px;
        cursor: pointer;
        transition: opacity 0.15s ease;
        display: inline;
        -webkit-box-decoration-break: clone;
        box-decoration-break: clone;
        background-origin: content-box;
    }
    .user-highlight:active {
        opacity: 0.6;
    }
    /* Solid background-color mode (toggled via body.highlight-solid) */
    .highlight-solid .user-highlight {
        background-image: none;
        background-color: var(--highlight-color, hsl(50, 100%, 26%));
    }
    /* Underline mode — uses a pre-computed lighter color for visibility on dark backgrounds */
    .user-highlight[data-mark-type="underline"] {
        background-image: none;
        text-decoration-line: underline;
        text-decoration-color: var(--underline-color, var(--highlight-color, hsl(50, 100%, 71%)));
        text-decoration-thickness: 3px;
        text-underline-offset: 5px;
    }

    /* Light background scheme — use pastel highlight colors so text remains readable */
    body[data-scheme="light"] .user-highlight:not([data-mark-type="underline"]) {
        background-image: linear-gradient(
            to bottom,
            transparent 0%,
            transparent 10%,
            var(--light-highlight-color, var(--highlight-color)) 10%,
            var(--light-highlight-color, var(--highlight-color)) 90%,
            transparent 90%,
            transparent 100%
        );
    }
    body[data-scheme="light"].highlight-solid .user-highlight:not([data-mark-type="underline"]) {
        background-image: none;
        background-color: var(--light-highlight-color, var(--highlight-color));
    }
    /* Light background: underlines use the pastel color to match highlights */
    body[data-scheme="light"] .user-highlight[data-mark-type="underline"] {
        text-decoration-color: var(--light-highlight-color, var(--highlight-color));
    }
`;

export default webviewStyles;

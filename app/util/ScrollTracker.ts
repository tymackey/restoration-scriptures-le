/**
 * Scroll tracking utility for WebView content.
 * Detects when paragraphs reach the top of the viewport and sends position updates to React Native.
 */

export class ScrollTracker {
    /**
     * Generates JavaScript code for tracking scroll position and detecting current paragraph.
     * @returns JavaScript code as a string
     */
    static generateScrollTrackingScript(): string {
        return `
      (function() {
        let lastReportedPosition = 0;
        
        function findCurrentParagraph() {
          const paragraphs = document.querySelectorAll('[id]');
          const viewportTop = window.pageYOffset;
          const viewportBottom = viewportTop + window.innerHeight;
          
          let currentPosition = 0;
          
          for (let i = 0; i < paragraphs.length; i++) {
            const element = paragraphs[i];
            const rect = element.getBoundingClientRect();
            const elementTop = rect.top + window.pageYOffset;
            const elementBottom = elementTop + rect.height;
            
            // Check if the element is visible in the viewport
            if (elementTop <= viewportTop + 50 && elementBottom >= viewportTop) {
              const id = parseInt(element.id);
              if (!isNaN(id) && id > 0) {
                currentPosition = id;
                break;
              }
            }
          }
          
          return currentPosition;
        }
        
        function handleScroll() {
          const currentPosition = findCurrentParagraph();
          if (currentPosition !== lastReportedPosition && currentPosition > 0) {
            lastReportedPosition = currentPosition;
            console.log('Scroll tracking: paragraph', currentPosition, 'reached top of viewport');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'scroll',
              position: currentPosition
            }));
          }
        }
        
        // Throttle scroll events for better performance
        let scrollTimeout;
        function throttledScrollHandler() {
          if (scrollTimeout) return;
          scrollTimeout = setTimeout(() => {
            handleScroll();
            scrollTimeout = null;
          }, 100);
        }
        
        // Make throttledScrollHandler globally accessible for cleanup
        window.throttledScrollHandler = throttledScrollHandler;
        
        window.addEventListener('scroll', throttledScrollHandler, { passive: true });
        
        // Initial check
        setTimeout(handleScroll, 500);
      })();
      true;
    `;
    }

    /**
     * Generates JavaScript code for cleaning up scroll event listeners.
     * @returns JavaScript code as a string
     */
    static generateCleanupScript(): string {
        return `
      (function() {
        try {
          // Remove scroll event listeners
          window.removeEventListener('scroll', window.throttledScrollHandler);
        } catch(e) {
          console.error('Error cleaning up scroll listeners:', e);
        }
        true;
      })();
    `;
    }
}

export default ScrollTracker;

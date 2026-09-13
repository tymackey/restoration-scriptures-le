import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

// Map of image names to their require paths
const imageRequireMap = {
    cc: require("../../assets/images/cc.jpg"),
    oc: require("../../assets/images/oc.jpg"),
    nc: require("../../assets/images/nc.jpg"),
    tc: require("../../assets/images/tc.jpg"),
    glossary: require("../../assets/images/glossary.jpg"),
    timeline: require("../../assets/images/timeline.jpg"),
    map1: require("../../assets/images/map1.jpg"),
    map2: require("../../assets/images/map2.jpg"),
    map3: require("../../assets/images/map3.jpg"),
    map4: require("../../assets/images/map4.jpg"),
    map5: require("../../assets/images/map5.jpg"),
    map6: require("../../assets/images/map6.jpg"),
    map7: require("../../assets/images/map7.jpg"),
    map8: require("../../assets/images/map8.jpg"),
    map9: require("../../assets/images/map9.jpg"),
    fac1: require("../../assets/images/fac1.jpg"),
    fac2: require("../../assets/images/fac2.jpg"),
    fac3: require("../../assets/images/fac3.jpg"),
};

// Global cache for base64 data URLs to avoid reloading same images
let globalBase64Cache: { [key: string]: string } = {};

/**
 * Resolves the require()'d source for a bundled image by name, for use with
 * React Native's <Image> component (e.g. the full-screen zoom viewer).
 * @param imageName - One of the keys in imageRequireMap (e.g. "timeline", "fac1")
 */
export const getImageSource = (imageName: string) =>
    imageRequireMap[imageName] ?? null;

/**
 * Analyze HTML content to extract which images are referenced
 * @param htmlContent - The HTML content to analyze
 * @returns Array of image names that are referenced in the HTML
 */
export const extractImagesFromHTML = (htmlContent: string): string[] => {
    const imageNames: Set<string> = new Set();

    // Find all img tags and extract src attributes
    const imgTagRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = imgTagRegex.exec(htmlContent)) !== null) {
        const src = match[1];

        // Try to extract image name from various path formats
        let imageName = null;

        // Pattern 1: /Images/volume/imagename.jpg
        let nameMatch = src.match(/\/Images\/\w+\/(\w+)\.jpg$/i);
        if (nameMatch) {
            imageName = nameMatch[1];
        }

        // Pattern 2: /Images/imagename.jpg
        if (!imageName) {
            nameMatch = src.match(/\/Images\/(\w+)\.jpg$/i);
            if (nameMatch) {
                imageName = nameMatch[1];
            }
        }

        // Pattern 3: just filename.jpg
        if (!imageName) {
            nameMatch = src.match(/([a-zA-Z]+\d*)\.jpg$/i);
            if (nameMatch) {
                imageName = nameMatch[1];
            }
        }

        // Pattern 4: specific known image names
        if (!imageName) {
            nameMatch = src.match(
                /(map\d+|fac\d+|timeline|glossary|cc|oc|nc|tc)\.jpg$/i,
            );
            if (nameMatch) {
                imageName = nameMatch[1];
            }
        }

        if (imageName && imageRequireMap[imageName]) {
            imageNames.add(imageName);
        }
    }

    return Array.from(imageNames);
};

/**
 * Convert a single image to base64 data URL
 */
const convertImageToBase64 = async (imageName: string): Promise<string> => {
    // Check global cache first
    if (globalBase64Cache[imageName]) {
        return globalBase64Cache[imageName];
    }

    try {
        const imageSource = imageRequireMap[imageName];
        if (!imageSource) {
            console.warn(`Image not found: ${imageName}`);
            return "";
        }

        const asset = Asset.fromModule(imageSource);
        await asset.downloadAsync();

        // On Android, when running from the embedded bundle (no OTA update
        // applied yet), expo-asset resolves bundled images to a bare drawable
        // resource name (e.g. "timeline", no URI scheme) for backward
        // compatibility with RN's <Image> component, and marks the asset as
        // already "downloaded" without ever writing a real file. FileSystem
        // can't read that name as a path. Resetting the download state forces
        // a fresh downloadAsync() call, which routes through the native
        // module and copies the drawable resource to a real cache file.
        if (asset.localUri && !asset.localUri.includes(":")) {
            asset.downloaded = false;
            asset.localUri = null;
            await asset.downloadAsync();
        }

        if (!asset.localUri) {
            console.warn(
                `Could not resolve a local file for image: ${imageName}`,
            );
            return "";
        }

        const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Create proper data URL
        const dataUrl = `data:image/jpeg;base64,${base64}`;

        // Cache the result
        globalBase64Cache[imageName] = dataUrl;

        return dataUrl;
    } catch (error) {
        console.error(`Error converting image ${imageName} to base64:`, error);
        return "";
    }
};

/**
 * Preload only the images that are referenced in the HTML content
 * @param htmlContent - The HTML content to analyze for images
 * @returns Promise<{ [key: string]: string }> - Object with image names as keys and base64 data URLs as values
 */
export const preloadImagesFromHTML = async (
    htmlContent: string,
): Promise<{ [key: string]: string }> => {
    const requiredImages = extractImagesFromHTML(htmlContent);

    if (requiredImages.length === 0) {
        return {};
    }

    try {
        // Use Promise.all to handle async operations properly
        const base64Promises = requiredImages.map(async (name) => {
            const base64Url = await convertImageToBase64(name);
            return { name, base64Url };
        });

        const results = await Promise.all(base64Promises);

        // Build result object
        const cache: { [key: string]: string } = {};
        results.forEach(({ name, base64Url }) => {
            if (base64Url) {
                cache[name] = base64Url;
            }
        });

        return cache;
    } catch (error) {
        console.error("Error preloading images from HTML:", error);
        return {};
    }
};

/**
 * Preload all images and convert to base64 (kept for backward compatibility)
 */
export const preloadImagesAsBase64 = async (): Promise<{
    [key: string]: string;
}> => {
    try {
        const imageNames = Object.keys(imageRequireMap);

        // Use Promise.all to handle async operations properly
        const base64Promises = imageNames.map(async (name) => {
            const base64Url = await convertImageToBase64(name);
            return { name, base64Url };
        });

        const results = await Promise.all(base64Promises);

        // Build cache object
        const cache: { [key: string]: string } = {};
        results.forEach(({ name, base64Url }) => {
            cache[name] = base64Url;
        });

        return cache;
    } catch (error) {
        console.error("Error preloading images:", error);
        return {};
    }
};

/**
 * Generate JavaScript code to replace image sources in WebView
 * @param base64Images - Object with image names as keys and base64 data URLs as values
 * @returns string - JavaScript code to inject
 */
export const generateImageReplacementScript = (base64Images: {
    [key: string]: string;
}): string => {
    // Create JavaScript object with base64 images
    const imageDataScript = Object.entries(base64Images)
        .map(([name, dataUrl]) => `'${name}': '${dataUrl}'`)
        .join(",\n        ");

    return `
        (function() {
            try {
                // Base64 image data
                const imageData = {
                    ${imageDataScript}
                };
                
                // Function to replace images with retry mechanism
                function replaceImages() {
                    try {
                        const images = document.querySelectorAll('img');
                        if (images.length === 0) {
                            console.log('No images found to replace');
                            return;
                        }
                        
                        let replacedCount = 0;
                        
                        images.forEach(img => {
                            try {
                                // img.src resolves against the document's base URL, which is
                                // "about:blank" on Android (no baseUrl is set for the WebView
                                // there) — that fails to resolve a root-relative path like
                                // "/Images/tc/timeline.jpg" and yields an empty string. The
                                // raw attribute is unaffected by base-URL resolution.
                                const src = img.getAttribute('src') || img.src;

                                // Already replaced by an earlier pass (retries run on a
                                // timer and on DOMContentLoaded) — skip re-matching a
                                // multi-KB base64 data URI against the name patterns below.
                                if (src.indexOf('data:') === 0) {
                                    return;
                                }

                                // Try different matching patterns
                                let imageName = null;
                                
                                // Pattern 1: /Images/volume/imagename.jpg (extract imagename)
                                let match = src.match(/\\/Images\\/\\w+\\/(\\w+)\\.jpg$/i);
                                if (match) {
                                    imageName = match[1];
                                }
                                
                                // Pattern 2: /Images/imagename.jpg (extract imagename)
                                if (!imageName) {
                                    match = src.match(/\\/Images\\/(\\w+)\\.jpg$/i);
                                    if (match) {
                                        imageName = match[1];
                                    }
                                }
                                
                                // Pattern 3: just filename.jpg (extract filename without extension)
                                if (!imageName) {
                                    match = src.match(/([a-zA-Z]+\\d*)\\.jpg$/i);
                                    if (match) {
                                        imageName = match[1];
                                    }
                                }
                                
                                // Pattern 4: Handle specific cases for maps, facsimiles, etc.
                                if (!imageName) {
                                    match = src.match(/(map\\d+|fac\\d+|timeline|glossary|cc|oc|nc|tc)\\.jpg$/i);
                                    if (match) {
                                        imageName = match[1];
                                    }
                                }
                                
                                // Pattern 5: Extract from any path ending with known image names
                                if (!imageName) {
                                    const knownImages = Object.keys(imageData);
                                    for (const knownImage of knownImages) {
                                        if (src.toLowerCase().includes(knownImage.toLowerCase() + '.jpg')) {
                                            imageName = knownImage;
                                            break;
                                        }
                                    }
                                }
                                
                                if (imageName && imageData[imageName]) {
                                    img.src = imageData[imageName];
                                    img.onerror = (e) => console.error('Image load error:', imageName, e);
                                    replacedCount++;

                                    // Wire up tap-to-zoom once per element. Only images the
                                    // source HTML marks "zoomable" (maps, facsimiles, the
                                    // timeline chart) open the native zoom viewer — icons or
                                    // decorative images elsewhere should stay inert.
                                    if (
                                        !img.dataset.zoomBound &&
                                        img.classList.contains('zoomable')
                                    ) {
                                        img.dataset.zoomBound = '1';
                                        img.addEventListener('click', function () {
                                            if (window.ReactNativeWebView) {
                                                window.ReactNativeWebView.postMessage(
                                                    JSON.stringify({
                                                        type: 'imageZoom',
                                                        imageName: imageName,
                                                    }),
                                                );
                                            }
                                        });
                                    }
                                } else if (imageName) {
                                    console.warn('Image data not found for:', imageName, 'Available images:', Object.keys(imageData));
                                } else {
                                    console.warn('Could not extract image name from src:', src);
                                }
                            } catch (imgError) {
                                console.error('Error processing image:', imgError);
                            }
                        });
                        
                        console.log('Replaced', replacedCount, 'out of', images.length, 'images');
                    } catch (error) {
                        console.error('Error in replaceImages:', error);
                    }
                }
                
                // Execute image replacement with retry
                function executeImageReplacement() {
                    // Try immediately
                    replaceImages();
                    
                    // Also try after a short delay to catch any late-loading images
                    setTimeout(replaceImages, 500);
                    
                    // And try again after DOM is fully loaded
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', replaceImages, { once: true });
                    }
                }
                
                executeImageReplacement();
                
            } catch (error) {
                console.error('Error in image replacement script:', error);
            }
        })();
    `;
};

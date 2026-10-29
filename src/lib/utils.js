/**
 * Formats a number or numeric string as Indonesian Rupiah (IDR) currency.
 * If the input is not a standard numeric value or has non-numeric text,
 * it returns the original string.
 * 
 * Example:
 *   4950000 -> Rp 4.950.000
 *   "8850000" -> Rp 8850.000
 *   "Custom" -> "Custom"
 * 
 * @param {number|string} value - The price value to format
 * @returns {string} The formatted Rupiah string or original value
 */
export function formatRupiah(value) {
  if (value === null || value === undefined) return '';

  const str = String(value).trim();
  if (!str) return '';

  // Strip common prefix/suffix and checks if the remainder is purely numeric
  const cleanStr = str.replace(/^(Rp|rp|IDR|idr)\.?\s*/i, '').replace(/[\s.,]/g, '');
  
  if (cleanStr && /^\d+$/.test(cleanStr)) {
    const number = parseInt(cleanStr, 10);
    // Format only the number using Indonesian thousand separator (dot)
    return new Intl.NumberFormat('id-ID').format(number);
  }

  return str;
}

/**
 * Compresses an image file using Canvas to create a thumbnail.
 * @param {File} file - The original image file
 * @param {number} maxWidthHeight - Maximum width or height for the thumbnail
 * @returns {Promise<File>} A promise that resolves to the compressed image File
 */
export async function compressImage(file, maxWidthHeight = 2560, targetSizeKB = 0) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Use URL.createObjectURL which is much more memory efficient than FileReader's base64
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = async () => {
      // Clean up object URL immediately to free memory
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidthHeight) {
          height *= maxWidthHeight / width;
          width = maxWidthHeight;
        }
      } else {
        if (height > maxWidthHeight) {
          width *= maxWidthHeight / height;
          height = maxWidthHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const getBlobAtQuality = (quality) => {
        return new Promise((res) => {
          canvas.toBlob((blob) => res(blob), 'image/jpeg', quality);
        });
      };

      const cleanupAndResolve = (blob) => {
        // Help browser garbage collect the canvas memory
        canvas.width = 0;
        canvas.height = 0;
        
        const resultFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpeg", {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve(resultFile);
      };

      try {
        if (targetSizeKB > 0) {
          const targetSize = targetSizeKB * 1024;
          const tolerance = 150 * 1024;
          
          let minQ = 0.1;
          let maxQ = 1.0;
          let bestBlob = null;
          let bestDiff = Infinity;
          
          for (let i = 0; i < 7; i++) {
            const q = (minQ + maxQ) / 2;
            const blob = await getBlobAtQuality(q);
            if (!blob) break;
            
            const diff = Math.abs(blob.size - targetSize);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestBlob = blob;
            }
            
            if (diff <= tolerance) break;
            
            if (blob.size > targetSize) maxQ = q;
            else minQ = q;
          }
          
          if (!bestBlob) bestBlob = await getBlobAtQuality(0.95);
          cleanupAndResolve(bestBlob);
        } else {
          // Simple fast compression for thumbnails
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas is empty'));
              return;
            }
            cleanupAndResolve(blob);
          }, 'image/jpeg', 0.85); // 85% quality for small thumbnails
        }
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };
  });
}

/**
 * Optimizes an image URL for preview (Google Sites preview method).
 * Google Drive links are converted to thumbnail URLs to save bandwidth.
 * 
 * @param {string} url - The original image URL
 * @param {number} width - The desired width for the thumbnail
 * @returns {string} The optimized URL
 */
export function optimizeImageUrl(url, width = 600) {
  if (!url || typeof url !== 'string') return url || '';

  // 1. Handle Google Drive URLs
  let fileId = null;
  if (url.includes('drive.google.com')) {
    const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) fileId = fileMatch[1];
    else {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) fileId = idMatch[1];
    }
    if (fileId) {
      // The drive.google.com/thumbnail endpoint is now restricted and often returns 403 Forbidden
      // for third-party embedding. We fallback to the direct viewing URL.
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  }

  // 2. Handle Google Photos / Google User Content URLs (lh3, lh4, etc)
  if (url.match(/googleusercontent\.com|ggpht\.com/)) {
    // If it already has sizing parameter (e.g., =s..., =w..., -s...), replace it
    if (url.match(/=[s|w|h]\d+([^/]*)$/)) {
      return url.replace(/=[s|w|h]\d+([^/]*)$/, `=s${width}`);
    }
    // If no size parameter, append it
    return `${url}=s${width}`;
  }

  return url;
}

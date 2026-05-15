/**
 * Image URL Helper Functions
 * 
 * Converts various image URL formats to direct image URLs that work in React Native
 */

/**
 * Converts a Google Drive sharing link to a direct image URL
 * 
 * @param {string} driveUrl - Google Drive sharing URL
 * @returns {string} Direct image URL or original URL if conversion fails
 * 
 * Examples:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - Converts to: https://drive.google.com/uc?export=view&id=FILE_ID
 */
export function convertGoogleDriveUrl(driveUrl) {
  if (!driveUrl || typeof driveUrl !== 'string') {
    return driveUrl;
  }

  // Check if it's already a direct image URL
  if (driveUrl.includes('drive.google.com/uc?export=view')) {
    return driveUrl;
  }

  // Extract file ID from various Google Drive URL formats
  let fileId = null;

  // Format 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const match1 = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) {
    fileId = match1[1];
  }

  // Format 2: https://drive.google.com/open?id=FILE_ID
  if (!fileId) {
    const match2 = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) {
      fileId = match2[1];
    }
  }

  // Format 3: https://drive.google.com/uc?id=FILE_ID (already direct, but might need export=view)
  if (!fileId) {
    const match3 = driveUrl.match(/\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (match3) {
      fileId = match3[1];
    }
  }

  // If we found a file ID, convert to direct image URL
  if (fileId) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // If we couldn't extract file ID, return original URL
  // (might be a different type of URL that works directly)
  return driveUrl;
}

/**
 * Normalizes any image URL to ensure it works in React Native
 * Handles Google Drive, Imgur, and other common image hosting services
 * 
 * @param {string} url - Image URL
 * @returns {string} Normalized direct image URL
 */
export function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return null;
  }

  // Convert Google Drive URLs
  if (trimmedUrl.includes('drive.google.com')) {
    return convertGoogleDriveUrl(trimmedUrl);
  }

  // Imgur URLs - ensure they're direct image URLs
  if (trimmedUrl.includes('imgur.com')) {
    // Convert imgur.com/xxx to i.imgur.com/xxx.jpg if needed
    if (trimmedUrl.includes('imgur.com/') && !trimmedUrl.includes('i.imgur.com')) {
      const imgurId = trimmedUrl.split('imgur.com/')[1]?.split(/[?#]/)[0];
      if (imgurId && !imgurId.includes('.')) {
        return `https://i.imgur.com/${imgurId}.png`;
      }
    }
  }

  // Return as-is if it's already a direct image URL
  return trimmedUrl;
}


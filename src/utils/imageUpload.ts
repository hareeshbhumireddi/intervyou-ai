const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const TARGET_AVATAR_SIZE = 320;
const MAX_ENCODED_DATA_URL_LENGTH = 240_000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unsupported or corrupted image file. Please select a JPG, PNG, or WebP photo.'));
    img.src = src;
  });
}

/**
 * Center-crops and compresses any uploaded portrait/photo to a 320x320 JPEG data URL
 * well under Firestore's 1MB document limit and blueprint avatarUrl limit (250,000 chars).
 */
export async function processAvatarFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, WebP, or GIF).');
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('Image must be smaller than 10 MB.');
  }

  let objectUrl = '';
  try {
    objectUrl = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await loadImageElement(objectUrl);
    } catch {
      const rawDataUrl = await readFileAsDataUrl(file);
      img = await loadImageElement(rawDataUrl);
    }

    const srcWidth = img.naturalWidth || img.width || TARGET_AVATAR_SIZE;
    const srcHeight = img.naturalHeight || img.height || TARGET_AVATAR_SIZE;
    const cropSize = Math.min(srcWidth, srcHeight);
    const sx = Math.max(0, Math.floor((srcWidth - cropSize) / 2));
    const sy = Math.max(0, Math.floor((srcHeight - cropSize) / 2));

    const canvas = document.createElement('canvas');
    canvas.width = TARGET_AVATAR_SIZE;
    canvas.height = TARGET_AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser canvas is unavailable for image processing.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, TARGET_AVATAR_SIZE, TARGET_AVATAR_SIZE);
    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, TARGET_AVATAR_SIZE, TARGET_AVATAR_SIZE);

    let quality = 0.84;
    let compressed = canvas.toDataURL('image/jpeg', quality);
    while (compressed.length > MAX_ENCODED_DATA_URL_LENGTH && quality > 0.45) {
      quality -= 0.1;
      compressed = canvas.toDataURL('image/jpeg', quality);
    }

    if (compressed.length > MAX_ENCODED_DATA_URL_LENGTH) {
      throw new Error('Image is still too large after compression. Please pick a smaller photo.');
    }

    return compressed;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

// Resize and letterbox/cover an image file to exactly width x height
// Returns a Blob of the requested mime type
export async function resizeToCover(file, { width = 1600, height = 900, type = 'image/png', quality = 0.9 } = {}) {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // Compute aspect cover
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const targetAspect = width / height;
  const srcAspect = srcW / srcH;
  let drawW, drawH, dx, dy;
  if (srcAspect > targetAspect) {
    // source is wider -> height fits, crop sides
    drawH = height;
    drawW = Math.round(height * srcAspect);
  } else {
    // source is taller -> width fits, crop top/bottom
    drawW = width;
    drawH = Math.round(width / srcAspect);
  }
  dx = Math.round((width - drawW) / 2);
  dy = Math.round((height - drawH) / 2);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, dx, dy, drawW, drawH);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
  return blob;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export async function compressImageFile(file, { maxWidth = 1280, maxHeight = 1280, quality = 0.82, mimeType = 'image/jpeg' } = {}) {
  if (!file || !file.type.startsWith('image/')) return file;

  const imageBitmap = await createImageBitmap(file);
  const { width, height } = imageBitmap;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('이미지 압축에 실패했습니다.'));
    }, mimeType, quality);
  });

  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: mimeType,
    lastModified: Date.now(),
  });
}

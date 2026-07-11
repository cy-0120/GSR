const path = require('path');
const fs = require('fs');

const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

/**
 * 제보 사진을 저장하고 접근 가능한 URL을 반환한다.
 * 배포(Vercel) 환경에서는 파일시스템이 읽기 전용이므로 Vercel Blob에 업로드하고,
 * 로컬 개발 환경에서는 별도 계정 설정 없이 public/uploads에 저장한다.
 */
async function savePhoto(file) {
  if (!file) return null;

  const ext = path.extname(file.originalname) || '';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  if (hasBlobToken) {
    const { put } = require('@vercel/blob');
    const blob = await put(`reports/${filename}`, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });
    return blob.url;
  }

  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
  return `/uploads/${filename}`;
}

module.exports = { savePhoto };

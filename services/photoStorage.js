const path = require('path');
const fs = require('fs');

const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

/**
 * 제보 사진을 저장하고 접근 가능한 URL을 반환한다.
 * 배포(Vercel) 환경에서는 파일시스템이 읽기 전용이므로 Vercel Blob에 업로드하고,
 * 로컬 개발 환경에서는 별도 계정 설정 없이 public/uploads에 저장한다.
 * 서버리스인데 Blob 토큰이 없으면 사진만 건너뛰고 제보 자체는 성공시킨다.
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

  if (isServerless) {
    console.warn(
      '[photoStorage] BLOB_READ_WRITE_TOKEN이 없어 사진을 저장하지 못했습니다. ' +
      'Vercel 프로젝트 Storage 탭에서 Blob 스토어를 생성하세요. (사진 없이 제보는 정상 접수됨)',
    );
    return null;
  }

  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
  return `/uploads/${filename}`;
}

module.exports = { savePhoto };

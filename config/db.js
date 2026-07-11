const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClient } = require('@libsql/client');

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

// Vercel/Lambda 같은 서버리스 환경은 /tmp 를 제외한 파일시스템이 읽기 전용이다.
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

let url = databaseUrl;
if (!url) {
  if (isServerless) {
    // Turso 미설정 상태로 배포된 경우: 500으로 죽는 대신 임시 디렉터리 DB로 부팅한다.
    // 단, 인스턴스가 재활용될 때마다 데이터가 사라지므로 반드시 TURSO_DATABASE_URL을 설정해야 한다.
    console.warn(
      '[db] TURSO_DATABASE_URL이 설정되지 않아 임시 DB로 동작합니다. ' +
      '데이터가 인스턴스 재시작 시 사라지니 Vercel 환경 변수에 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN을 등록하세요. (README의 "Vercel 배포하기" 참고)',
    );
    url = `file:${path.join(os.tmpdir(), 'gangnam-safety-pin.db')}`;
  } else {
    // 로컬 개발: data/ 폴더에 파일 DB를 둔다.
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    url = `file:${path.join(dataDir, 'gangnam-safety-pin.db')}`;
  }
}

const client = createClient({ url, authToken });

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

let readyPromise = null;
function ready() {
  if (!readyPromise) {
    readyPromise = client.executeMultiple(schema).catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

function rowsToObjects({ columns, rows }) {
  return rows.map((row) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

async function all(sql, args = {}) {
  await ready();
  const result = await client.execute({ sql, args });
  return rowsToObjects(result);
}

async function get(sql, args = {}) {
  const rows = await all(sql, args);
  return rows[0];
}

async function run(sql, args = {}) {
  await ready();
  const result = await client.execute({ sql, args });
  return {
    lastInsertRowid: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined,
    rowsAffected: result.rowsAffected,
  };
}

module.exports = { client, ready, all, get, run };

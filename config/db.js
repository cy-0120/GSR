const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let url = databaseUrl;
if (!url) {
  // 로컬 개발: 배포(Vercel)의 읽기 전용 파일시스템과 달리 로컬은 data/ 폴더에 파일 DB를 둔다.
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  url = `file:${path.join(dataDir, 'gangnam-safety-pin.db')}`;
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

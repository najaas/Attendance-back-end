import 'dotenv/config';
import { connectDB } from '../app/config/db.config.js';
import fs from 'fs';
import path from 'path';

const envFile = path.resolve('.env');

const origins = [
  'https://attendance-front-end.onrender.com',
  'http://localhost:3000',
  'http://localhost:19006',
  'http://localhost:8081',
  'http://localhost:8082'
];

async function main() {
  await connectDB(); // just to ensure env is valid / exit cleanly
  const lines = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8').split(/\r?\n/) : [];
  const filtered = lines.filter((l) => !l.trim().startsWith('CORS_ORIGINS='));
  filtered.push(`CORS_ORIGINS=${origins.join(',')}`);
  fs.writeFileSync(envFile, filtered.join('\n'), 'utf8');
  console.log('Updated .env CORS_ORIGINS to:', origins.join(','));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

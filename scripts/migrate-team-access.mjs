import 'dotenv/config';
import mysql from 'mysql2/promise';
if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL no .env local.');
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [columns] = await db.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='disabledAt'");
  if (!columns.length) await db.execute('ALTER TABLE users ADD COLUMN disabledAt timestamp NULL');
  console.log('Controle de acesso da equipe configurado.');
} finally { await db.end(); }

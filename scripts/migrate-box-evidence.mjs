import 'dotenv/config';
import mysql from 'mysql2/promise';

if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL no arquivo .env local.');
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [columns] = await connection.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_photos' AND COLUMN_NAME = 'kind'");
  if (columns.length === 0) {
    await connection.execute("ALTER TABLE order_photos ADD COLUMN kind enum('CAIXA_ABERTA','CAIXA_FECHADA','LEGADO') NOT NULL DEFAULT 'LEGADO'");
    console.log('Tipos de foto adicionados. Fotos anteriores preservadas como LEGADO.');
  } else {
    console.log('Tipos de foto já configurados. Nenhuma alteração necessária.');
  }
} finally {
  await connection.end();
}

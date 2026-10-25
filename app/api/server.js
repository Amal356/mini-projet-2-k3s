FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./
USER 1000:1000
EXPOSE 3000
CMD ["node",
@'
const express = require('express');
const { Pool } = require('pg');

// Toute la configuration vient des variables d'environnement
const requises = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'API_PORT'];
for (const nom of requises) {
  if (!process.env[nom]) {
    console.error(`Variable d'environnement manquante : ${nom}`);
    process.exit(1);
  }
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

let tableCreee = false;
async function migrer() {
  if (tableCreee) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS taches (
    id SERIAL PRIMARY KEY,
    titre TEXT NOT NULL,
    faite BOOLEAN NOT NULL DEFAULT false,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  tableCreee = true;
  console.log('Table taches prete');
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await migrer();
    res.json({ status: 'ready' });
  } catch (e) {
    console.error('Base injoignable :', e.message);
    res.status(503).json({ status: 'not ready', error: e.message });
  }
});

app.get('/tasks', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM taches ORDER BY id');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/tasks', async (req, res) => {
  const titre = (req.body.titre || '').trim();
  if (!titre) return res.status(400).json({ error: 'titre obligatoire' });
  try {
    const r = await pool.query('INSERT INTO taches (titre) VALUES ($1) RETURNING *', [titre]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/tasks/:id', async (req, res) => {
  const { titre, faite } = req.body;
  try {
    const r = await pool.query(
      'UPDATE taches SET titre = COALESCE($1, titre), faite = COALESCE($2, faite) WHERE id = $3 RETURNING *',
      [titre ?? null, faite ?? null, req.params.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'tache introuvable' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM taches WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'tache introuvable' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const port = Number(process.env.API_PORT);
app.listen(port, () => console.log(`API demarree sur le port ${port}`));

const fs = require('fs');
const path = require('path');

// Carrega variáveis locais de server/.env ou .env na raiz (se existirem) sem sobrescrever o ambiente
for (const envFile of [path.resolve(__dirname, '.env'), path.resolve(__dirname, '..', '.env')]) {
  if (fs.existsSync(envFile)) {
    try {
      const content = fs.readFileSync(envFile, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim();
          if (process.env[k] === undefined) process.env[k] = v;
        }
      }
    } catch (_) {}
  }
}

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3100;

// Oculta header de fingerprinting e adiciona proteções defensivas HTTP
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false, // SPA front gerencia seu CSP
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' } // Anti-Clickjacking
}));

// Express 4 não encaminha rejeição de handler/middleware async para o error handler —
// sem isso qualquer exceção assíncrona vira unhandledRejection e pode derrubar o processo.
// Wrapper centralizado: todo handler async ganha .catch(next).
for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
  const orig = app[m].bind(app);
  app[m] = (path, ...handlers) => orig(path, ...handlers.map(h =>
    typeof h === 'function' && h.constructor.name === 'AsyncFunction'
      ? (req, res, next) => h(req, res, next).catch(next)
      : h
  ));
}
process.on('unhandledRejection', err => console.error('unhandledRejection:', err));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DB_USER || 'animalworld',
  password: process.env.DB_PASSWORD || 'animalworld',
  database: process.env.DB_NAME || 'animalworld'
});
pool.on('error', err => console.error('PostgreSQL idle client error:', err.message));

// Garante colunas de P0/P1 na inicialização do servidor
pool.query(`
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS pet_weight_kg NUMERIC(6,2) DEFAULT NULL;
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS pet_size_tier TEXT DEFAULT '';
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS selected_extras JSONB DEFAULT '[]';
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS tosa_notes TEXT DEFAULT '';
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS estimated_ready_at TEXT DEFAULT NULL;
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS requires_validation BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS validation_confirmed BOOLEAN NOT NULL DEFAULT TRUE;
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS validated_by TEXT DEFAULT '';
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ DEFAULT NULL;
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;
  ALTER TABLE daily_services ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;
`).catch(err => console.error('Migration error:', err.message));

// CORS: só as origens configuradas + a própria API (front estático servido de docs/)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:4200')
  .split(',').map(s => s.trim()).filter(Boolean);
const SELF_ORIGINS = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
app.use(cors({
  origin: (origin, cb) =>
    cb(null, !origin || ALLOWED_ORIGINS.includes(origin) || SELF_ORIGINS.includes(origin))
}));
app.use(express.json({ limit: '10mb' })); // uploads chegam em base64

// Rate limit em memória (janela fixa por IP) para endpoints sensíveis de auth
function createRateLimiter(windowMs, max, message) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  }, windowMs);
  timer.unref();
  return (req, res, next) => {
    const now = Date.now();
    let rec = hits.get(req.ip);
    if (!rec || now > rec.reset) {
      rec = { count: 0, reset: now + windowMs };
      hits.set(req.ip, rec);
    }
    if (++rec.count > max) return res.status(429).json({ error: message });
    next();
  };
}
const loginLimiter = createRateLimiter(5 * 60 * 1000, 10, 'Muitas tentativas de login. Aguarde alguns minutos.');
const authLimiter = createRateLimiter(10 * 60 * 1000, 5, 'Muitas requisições. Aguarde alguns minutos.');

// ---------- senhas ----------

const BCRYPT_ROUNDS = 10;
const hashPassword = async pw => bcrypt.hash(String(pw), BCRYPT_ROUNDS);
const passwordError = pw => {
  const s = String(pw || '');
  if (s.length < 8) return 'Senha deve ter ao menos 8 caracteres';
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return 'Senha deve ter ao menos uma letra e um número';
  return null;
};
// Hash legado sha256 sem salt (pré-bcrypt): confere na hora e migra para bcrypt no login
const LEGACY_SHA256 = pw => crypto.createHash('sha256').update(String(pw)).digest('hex');
const isBcrypt = h => typeof h === 'string' && h.startsWith('$2');
async function verifyPassword(password, storedHash) {
  if (isBcrypt(storedHash)) return bcrypt.compare(String(password), storedHash);
  return LEGACY_SHA256(password) === storedHash;
}
// Hash bcrypt real usado como dummy p/ igualar o tempo de resposta quando o email não existe
const DUMMY_BCRYPT = '$2b$10$6fg4IaGWYY5NjfgQiU2ty.bxWnEhpoykIXRNsEdh2I3z8pz06OguC';

const num = v => (v === null || v === undefined ? null : Number(v));

// ---------- helpers ----------

// M23 auditoria: trilha de alterações (fire-and-forget — nunca quebra o fluxo principal)
function audit(entity, entityId, action, oldData, newData, userId) {
  pool.query(
    'INSERT INTO audit_log (entity, entity_id, action, old_data, new_data, user_id) VALUES ($1,$2,$3,$4,$5,$6)',
    [entity, entityId, action,
     oldData ? JSON.stringify(oldData) : null,
     newData ? JSON.stringify(newData) : null,
     userId || null]
  ).catch(e => console.error('audit:', e.message));
}

// M17: image_path guarda só o basename do arquivo em /uploads; 'image' segue como URL de exibição
const imagePathOf = image => {
  const m = /^\/uploads\/([\w.\-]+)$/.exec(String(image || ''));
  return m ? m[1] : null;
};
const petJson = p => ({
  id: p.id, name: p.name, type: p.type, breed: p.breed, age: p.age,
  weightKg: p.weight_kg !== null && p.weight_kg !== undefined ? Number(p.weight_kg) : null,
  customerId: p.customer_id,
  image: p.image_path ? `/uploads/${p.image_path}` : (p.image || '')
});

async function getCustomersWithPets(userId = null) {
  const { rows: customers } = userId
    ? await pool.query('SELECT * FROM customers WHERE user_id=$1 ORDER BY id', [userId])
    : await pool.query('SELECT * FROM customers ORDER BY id');
  if (!customers.length) return [];
  const custIds = customers.map(c => c.id);
  const { rows: pets } = await pool.query(
    'SELECT * FROM pets WHERE customer_id = ANY($1) ORDER BY id',
    [custIds]
  );
  return customers.map(c => ({
    ...c,
    userId: c.user_id,
    pets: pets.filter(p => p.customer_id === c.id).map(petJson)
  }));
}

// ---------- session tokens (HMAC) ----------

const fs = require('fs');

// Secret de sessão: env SESSION_SECRET tem prioridade; senão usa/cria arquivo local
// persistido (server/.session-secret, gitignored) — nunca hardcoded no código.
const SECRET_FILE = path.join(__dirname, '.session-secret');
function loadSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (existing) return existing;
  } catch { /* arquivo ainda não existe */ }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}
const SESSION_SECRET = loadSessionSecret();
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 dias

function signToken(user, sid) {
  const payload = Buffer.from(JSON.stringify({
    uid: user.id, sid, exp: Date.now() + TOKEN_TTL
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

// Carrega usuário + sessão fresca do banco a cada request:
// role/permissão nunca ficam velhas no token e logout/reset revogam de verdade
async function createSession(userId, client = pool) {
  const { rows } = await client.query(
    'INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id',
    [userId, new Date(Date.now() + TOKEN_TTL)]
  );
  return rows[0].id;
}

async function loadUser(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const data = verifyToken(token);
  if (!data || !data.sid) return res.status(401).json({ error: 'Não autenticado' });
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.can_manage_products, s.id AS session_id
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [data.sid, data.uid]
  );
  if (!rows.length) return res.status(401).json({ error: 'Sessão expirada ou encerrada' });
  req.user = rows[0];
  req.sessionId = rows[0].session_id;
  next();
}

const requireAuth = loadUser;
// Todo :id das rotas é PK inteira — rejeita 'banana' com 400 em vez de estourar no Postgres (500)
app.param('id', (req, res, next, val) => {
  if (!/^\d+$/.test(val)) return res.status(400).json({ error: 'ID inválido' });
  next();
});
const requireStaff = (req, res, next) =>
  (req.user.role === 'admin' || req.user.role === 'collaborator') ? next()
    : res.status(403).json({ error: 'Acesso restrito à equipe' });
const requireAdmin = (req, res, next) =>
  req.user.role === 'admin' ? next()
    : res.status(403).json({ error: 'Acesso restrito ao administrador' });

const isStaff = u => u.role === 'admin' || u.role === 'collaborator';
const canManageProducts = u => u.role === 'admin' || u.can_manage_products === true;
const requireProductManager = (req, res, next) =>
  (isStaff(req.user) && canManageProducts(req.user)) ? next()
    : res.status(403).json({ error: 'Sem permissão para gerenciar produtos' });

// ---------- auth ----------

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });
  const { rows } = await pool.query(
    'SELECT id, name, email, role, can_manage_products, password_hash FROM users WHERE email = $1',
    [email]
  );
  const u = rows[0];
  // bcrypt.compare roda sempre (hash dummy se o email não existe) — não vaza timing nem existência
  const valid = await verifyPassword(password, u ? u.password_hash : DUMMY_BCRYPT);
  if (!u || !valid) return res.status(401).json({ error: 'Credenciais inválidas' });
  if (!isBcrypt(u.password_hash)) {
    await pool.query('UPDATE users SET password_hash=$2 WHERE id=$1', [u.id, await hashPassword(password)]);
  }
  const sid = await createSession(u.id);
  res.json({
    id: u.id, name: u.name, email: u.email, role: u.role,
    canManageProducts: u.can_manage_products, token: signToken(u, sid)
  });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await pool.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [req.sessionId]);
  res.json({ ok: true });
});

app.post('/api/auth/forgot', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  // Sempre 200 — não vaza se o email existe
  res.json({ ok: true });
  if (!email) return;
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (!rows.length) return;
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1 AND used_at IS NULL', [rows[0].id]);
      await client.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
        [rows[0].id, tokenHash, new Date(Date.now() + 60 * 60 * 1000)]
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    // Entrega de token: não vaza o token em logs de produção
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[password-reset] Solicitação de redefinição processada para ${email}`);
    }
  } catch (e) {
    console.error('forgot:', e);
  }
});

app.post('/api/auth/reset', authLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  const pwErr = passwordError(newPassword);
  if (!token || pwErr) return res.status(400).json({ error: pwErr || 'Token obrigatório' });
  const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }
    await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE id=$1', [rows[0].id]);
    await client.query('UPDATE users SET password_hash=$2 WHERE id=$1', [rows[0].user_id, await hashPassword(newPassword)]);
    await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1', [rows[0].user_id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  }
  // LGPD: consentimento é obrigatório no auto-cadastro — sem ele não há base legal
  if (req.body.consent !== true) {
    return res.status(400).json({ error: 'É necessário aceitar os termos e a política de privacidade' });
  }
  const pwErr = passwordError(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  const hash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    const { rows: userRows } = await client.query(
      `INSERT INTO users (name, email, password_hash, role, consent_lgpd_at, consent_version)
       VALUES ($1,$2,$3,$4, CASE WHEN $5 THEN now() END, CASE WHEN $5 THEN '1.0' END)
       RETURNING id, name, email, role, can_manage_products`,
      [name, email, hash, 'customer', req.body.consent === true]
    );
    const user = userRows[0];
    // Cria um cadastro de cliente próprio isolado para o novo usuário autenticado
    const { rows: ownCust } = await client.query(
      'SELECT id FROM customers WHERE user_id = $1',
      [user.id]
    );
    if (!ownCust.length) {
      await client.query(
        'INSERT INTO customers (user_id, name, email, status) VALUES ($1,$2,$3,$4)',
        [user.id, name, email, 'active']
      );
    }
    const sid = await createSession(user.id, client);
    await client.query('COMMIT');
    res.status(201).json({
      ...user,
      canManageProducts: user.can_manage_products,
      token: signToken(user, sid)
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// ---------- users (gestão de funcionários) ----------

const userJson = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, canManageProducts: u.can_manage_products });

app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, email, role, can_manage_products FROM users ORDER BY id');
  res.json(rows.map(userJson));
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password, role, canManageProducts } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  const pwErr = passwordError(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  const validRoles = ['admin', 'collaborator', 'customer'];
  const userRole = validRoles.includes(role) ? role : 'collaborator';
  const hash = await hashPassword(password);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, can_manage_products) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, can_manage_products',
      [name, email, hash, userRole, !!canManageProducts]
    );
    res.status(201).json(userJson(rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
    throw e;
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, role, canManageProducts } = req.body || {};
  if (req.user.id === Number(req.params.id) && role && role !== req.user.role) {
    return res.status(400).json({ error: 'Não é possível alterar o próprio perfil' });
  }
  const validRoles = ['admin', 'collaborator', 'customer'];
  const { rows } = await pool.query(
    `UPDATE users SET
       name=COALESCE($2,name),
       role=COALESCE($3,role),
       can_manage_products=COALESCE($4, can_manage_products)
     WHERE id=$1 RETURNING id, name, email, role, can_manage_products`,
    [req.params.id, name || null, validRoles.includes(role) ? role : null,
     canManageProducts === undefined ? null : !!canManageProducts]
  );
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(userJson(rows[0]));
});

app.put('/api/users/:id/password', requireAuth, async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && req.user.id !== Number(req.params.id)) {
    return res.status(403).json({ error: 'Você só pode alterar a própria senha' });
  }
  const { currentPassword, newPassword } = req.body || {};
  const pwErr = passwordError(newPassword);
  if (pwErr) return res.status(400).json({ error: pwErr });
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
  // Admin redefine senha sem conhecer a atual; usuário comum precisa provar a senha atual
  if (!isAdmin) {
    const ok = await verifyPassword(currentPassword || '', rows[0].password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
  }
  await pool.query('UPDATE users SET password_hash=$2 WHERE id=$1', [req.params.id, await hashPassword(newPassword)]);
  // Derruba as outras sessões do usuário (a atual, se for troca própria, continua valendo)
  await pool.query(
    'UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2',
    [req.params.id, req.sessionId]
  );
  res.json({ ok: true });
});

// ---------- products ----------

app.get('/api/products', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
  res.json(rows.map(p => ({ ...p, price: num(p.price), rating: num(p.rating) })));
});

// Relatório de balanço (admin): faturamento, por pagamento, top produtos, funil de status
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
app.get('/api/reports', requireAuth, requireAdmin, async (req, res) => {
  const from = req.query.from || '1970-01-01';
  const to = req.query.to || '2999-12-31';
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return res.status(400).json({ error: 'Datas no formato AAAA-MM-DD' });
  }
  try {
  const [totals, byPayment, byStatus, topProducts, appointmentsByStatus] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS orders_count, COALESCE(SUM(total),0)::float AS revenue
       FROM orders WHERE status <> 'cancelado' AND created_at::date BETWEEN $1::date AND $2::date`,
      [from, to]),
    pool.query(
      `SELECT COALESCE(payment_method,'não informado') AS payment_method,
              COUNT(*)::int AS orders_count, COALESCE(SUM(total),0)::float AS revenue
       FROM orders WHERE status <> 'cancelado' AND created_at::date BETWEEN $1::date AND $2::date
       GROUP BY payment_method ORDER BY revenue DESC`,
      [from, to]),
    pool.query(
      `SELECT status, COUNT(*)::int AS count FROM orders
       WHERE created_at::date BETWEEN $1::date AND $2::date GROUP BY status`,
      [from, to]),
    pool.query(
      `SELECT (item->>'name') AS name, SUM((item->>'quantity')::int)::int AS quantity,
              SUM((item->>'price')::numeric * (item->>'quantity')::int)::float AS revenue
       FROM orders o, jsonb_array_elements(o.items) item
       WHERE o.status <> 'cancelado' AND o.created_at::date BETWEEN $1::date AND $2::date
       GROUP BY item->>'name' ORDER BY revenue DESC LIMIT 10`,
      [from, to]),
    pool.query(
      `SELECT status, COUNT(*)::int AS count FROM appointments
       WHERE date BETWEEN $1::date AND $2::date GROUP BY status`,
      [from, to])
  ]);
  res.json({
    from, to,
    ordersCount: totals.rows[0].orders_count,
    revenue: totals.rows[0].revenue,
    byPaymentMethod: byPayment.rows,
    ordersByStatus: byStatus.rows,
    topProducts: topProducts.rows,
    appointmentsByStatus: appointmentsByStatus.rows
  });
  } catch (e) {
    console.error('reports:', e);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

app.put('/api/products/:id', requireAuth, requireProductManager, async (req, res) => {
  const { name, price, rating, reviews, image, category, description, stock } = req.body;
  const stockVal = stock === null || stock === undefined || stock === '' ? null : Math.max(0, Math.floor(Number(stock)) || 0);
  const { rows } = await pool.query(
    `UPDATE products SET name=$2, price=$3, rating=$4, reviews=$5, image=$6, category=$7, description=$8, stock=$9, image_path=$10
     WHERE id=$1 RETURNING *`,
    [req.params.id, name, price, rating, reviews, image, category, description, stockVal, imagePathOf(image)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json({ ...rows[0], price: num(rows[0].price), rating: num(rows[0].rating) });
});

app.post('/api/products', requireAuth, requireProductManager, async (req, res) => {
  const { name, price, rating, reviews, image, category, description, stock } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
  const stockVal = stock === null || stock === undefined || stock === '' ? null : Math.max(0, Math.floor(Number(stock)) || 0);
  const { rows } = await pool.query(
    `INSERT INTO products (name, price, rating, reviews, image, category, description, stock, image_path)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name, price, rating || 0, reviews || 0, image || '', category || '', description || '', stockVal, imagePathOf(image)]
  );
  res.status(201).json({ ...rows[0], price: num(rows[0].price), rating: num(rows[0].rating) });
});

app.delete('/api/products/:id', requireAuth, requireProductManager, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Produto não encontrado' });
  res.status(204).end();
});

// ---------- entrada de mercadoria & estoque (HU-20 & HU-21) ----------
app.post('/api/products/:id/stock', requireAuth, requireProductManager, async (req, res) => {
  const { quantity, type, supplier, costPrice, notes } = req.body;
  const q = parseInt(quantity, 10);
  if (isNaN(q) || q <= 0) return res.status(400).json({ error: 'Quantidade inválida' });

  try {
    const { rows: prodRows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!prodRows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    const prod = prodRows[0];

    const currentStock = prod.stock === null ? 0 : Number(prod.stock);
    const newStock = type === 'adjust' || type === 'initial' ? q : currentStock + q;

    const { rows: updatedRows } = await pool.query(
      `UPDATE products SET stock = $1, cost_price = COALESCE($2, cost_price), supplier = COALESCE($3, supplier) WHERE id = $4 RETURNING *`,
      [newStock, costPrice !== undefined ? num(costPrice) : null, supplier || null, req.params.id]
    );

    await pool.query(
      `INSERT INTO stock_movements (product_id, quantity, type, supplier, cost_price, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.params.id, q, type || 'in', supplier || null, costPrice !== undefined ? num(costPrice) : null, notes || '', req.user.id]
    );

    const updated = updatedRows[0];
    res.json({
      ...updated,
      price: num(updated.price),
      rating: num(updated.rating),
      costPrice: num(updated.cost_price),
      minStock: updated.min_stock
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar entrada de estoque' });
  }
});

// ---------- catalog services ----------

app.get('/api/services', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM catalog_services ORDER BY id');
  res.json(rows.map(s => ({ ...s, price: num(s.price), rating: num(s.rating) })));
});

app.post('/api/services', requireAuth, requireAdmin, async (req, res) => {
  const { name, price, rating, reviews, image, category, duration, description } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
  const { rows } = await pool.query(
    `INSERT INTO catalog_services (name, price, rating, reviews, image, category, duration, description, image_path)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name, price, rating || 0, reviews || 0, image || '', category || '', duration || '', description || '', imagePathOf(image)]
  );
  res.status(201).json({ ...rows[0], price: num(rows[0].price), rating: num(rows[0].rating) });
});

app.put('/api/services/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, price, rating, reviews, image, category, duration, description } = req.body;
  const { rows } = await pool.query(
    `UPDATE catalog_services SET name=$2, price=$3, rating=$4, reviews=$5, image=$6, category=$7, duration=$8, description=$9, image_path=$10
     WHERE id=$1 RETURNING *`,
    [req.params.id, name, price, rating, reviews, image, category, duration, description, imagePathOf(image)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Serviço não encontrado' });
  res.json({ ...rows[0], price: num(rows[0].price), rating: num(rows[0].rating) });
});

app.delete('/api/services/:id', requireAuth, requireAdmin, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM catalog_services WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Serviço não encontrado' });
  res.status(204).end();
});

// ---------- customers & pets ----------

app.get('/api/customers', requireAuth, async (req, res) => {
  const userId = isStaff(req.user) ? null : req.user.id;
  res.json(await getCustomersWithPets(userId));
});

app.post('/api/customers', requireAuth, requireStaff, async (req, res) => {
  const { name, email, phone, status } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO customers (name, email, phone, status) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, email, phone, status || 'active']
  );
  res.status(201).json({ ...rows[0], pets: [] });
});

app.put('/api/customers/:id', requireAuth, requireStaff, async (req, res) => {
  const { name, email, phone, status } = req.body;
  const { rows } = await pool.query(
    'UPDATE customers SET name=$2, email=$3, phone=$4, status=$5 WHERE id=$1 RETURNING *',
    [req.params.id, name, email, phone, status]
  );
  if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json(rows[0]);
});

app.post('/api/pets', requireAuth, async (req, res) => {
  const { customerId, name, type, breed, age, weightKg, weight_kg, image } = req.body;
  const petWeight = weightKg !== undefined ? weightKg : (weight_kg !== undefined ? weight_kg : null);
  if (!isStaff(req.user)) {
    const { rows: own } = await pool.query('SELECT id FROM customers WHERE id=$1 AND user_id=$2', [customerId, req.user.id]);
    if (!own.length) return res.status(403).json({ error: 'Cliente não pode cadastrar pet para outro cliente' });
  }
  const { rows } = await pool.query(
    'INSERT INTO pets (customer_id, name, type, breed, age, weight_kg, image_path) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [customerId, name, type, breed || null, age || null, petWeight, imagePathOf(image)]
  );
  res.status(201).json(petJson(rows[0]));
});

// Dono do pet = cliente cujo customer pertence ao usuário da sessão (staff passa direto)
async function ownsPet(req, petId) {
  if (isStaff(req.user)) return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM pets p JOIN customers c ON c.id = p.customer_id
     WHERE p.id=$1 AND c.user_id=$2`,
    [petId, req.user.id]
  );
  return rows.length > 0;
}

app.put('/api/pets/:id', requireAuth, async (req, res) => {
  if (!(await ownsPet(req, req.params.id))) {
    return res.status(403).json({ error: 'Pet não pertence ao seu cadastro' });
  }
  const { name, type, breed, age, weightKg, weight_kg, image } = req.body;
  const petWeight = weightKg !== undefined ? weightKg : (weight_kg !== undefined ? weight_kg : null);
  const { rows } = await pool.query(
    'UPDATE pets SET name=$2, type=$3, breed=$4, age=$5, weight_kg=$6, image_path=$7 WHERE id=$1 RETURNING *',
    [req.params.id, name, type, breed || null, age || null, petWeight, imagePathOf(image)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Pet não encontrado' });
  res.json(petJson(rows[0]));
});

app.delete('/api/pets/:id', requireAuth, async (req, res) => {
  if (!(await ownsPet(req, req.params.id))) {
    return res.status(403).json({ error: 'Pet não pertence ao seu cadastro' });
  }
  const { rowCount } = await pool.query('DELETE FROM pets WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Pet não encontrado' });
  res.status(204).end();
});

// ---------- appointments ----------

app.get('/api/appointments', requireAuth, async (req, res) => {
  const mineOnly = req.query.mine === 'true';
  const { rows } = (isStaff(req.user) && !mineOnly)
    ? await pool.query(
        `SELECT a.*, u.name AS user_name, u.email AS user_email
         FROM appointments a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.date, a.time, a.id`
      )
    : await pool.query(
        `SELECT a.*, u.name AS user_name, u.email AS user_email
         FROM appointments a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.user_id = $1 OR a.customer_id IN (SELECT id FROM customers WHERE user_id=$1)
         ORDER BY a.date, a.time, a.id`,
        [req.user.id]
      );
  res.json(rows.map(a => ({
    ...a,
    id: a.id,
    userId: a.user_id,
    userName: a.user_name,
    customerId: a.customer_id,
    customerName: a.customer_name,
    petName: a.pet_name,
    serviceId: a.service_id,
    serviceName: a.service_name,
    date: a.date instanceof Date ? a.date.toISOString().split('T')[0] : a.date,
    createdAt: a.created_at
  })));
});

app.post('/api/appointments', requireAuth, async (req, res) => {
  let { customerId, customerName, petName, serviceId, serviceName, date, time, notes } = req.body;

  let { rows: cust } = await pool.query('SELECT id, name FROM customers WHERE user_id=$1', [req.user.id]);
  if (!cust.length) {
    const { rows: byEmail } = await pool.query('SELECT id, name FROM customers WHERE email=$1', [req.user.email]);
    if (byEmail.length) {
      await pool.query('UPDATE customers SET user_id=$1 WHERE id=$2', [req.user.id, byEmail[0].id]);
      cust = byEmail;
    } else {
      const { rows: created } = await pool.query(
        'INSERT INTO customers (user_id, name, email, status) VALUES ($1,$2,$3,$4) RETURNING id, name',
        [req.user.id, req.user.name, req.user.email, 'active']
      );
      cust = created;
    }
  }

  if (!isStaff(req.user)) {
    customerId = cust[0].id;
    customerName = cust[0].name;
    const { rows: pet } = await pool.query('SELECT id FROM pets WHERE customer_id=$1 AND name=$2', [customerId, petName]);
    if (!pet.length) return res.status(400).json({ error: 'Pet não encontrado no seu cadastro' });
  } else {
    if (!customerId) {
      customerId = cust[0].id;
      customerName = cust[0].name;
    } else if (!customerName) {
      const { rows: selectedCust } = await pool.query('SELECT name FROM customers WHERE id=$1', [customerId]);
      if (selectedCust.length) {
        customerName = selectedCust[0].name;
      }
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO appointments (user_id, customer_id, customer_name, pet_name, service_id, service_name, date, time, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, customerId || null, customerName || null, petName, serviceId || null, serviceName || null, date, time, notes || null]
  );
  const a = rows[0];
  res.status(201).json({
    id: a.id,
    userId: a.user_id,
    customerId: a.customer_id,
    customerName: a.customer_name,
    petName: a.pet_name,
    serviceId: a.service_id,
    serviceName: a.service_name,
    date: a.date instanceof Date ? a.date.toISOString().split('T')[0] : a.date,
    time: a.time,
    notes: a.notes,
    status: a.status,
    createdAt: a.created_at
  });
});

app.patch('/api/appointments/:id/status', requireAuth, requireStaff, async (req, res) => {
  const { status } = req.body;
  const valid = ['solicitado', 'confirmado', 'concluido', 'cancelado'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  const { rows: oldRows } = await pool.query('SELECT id, status FROM appointments WHERE id=$1', [req.params.id]);
  if (!oldRows.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
  const { rows } = await pool.query(
    'UPDATE appointments SET status=$2 WHERE id=$1 RETURNING *',
    [req.params.id, status]
  );
  audit('appointments', rows[0].id, 'status', { status: oldRows[0].status }, { status }, req.user.id);
  const a = rows[0];
  res.json({
    id: a.id, customerId: a.customer_id, customerName: a.customer_name,
    petName: a.pet_name, serviceId: a.service_id, serviceName: a.service_name,
    date: a.date instanceof Date ? a.date.toISOString().split('T')[0] : a.date,
    time: a.time, notes: a.notes, status: a.status, createdAt: a.created_at
  });
});

// ---------- daily services (Fila do Dia — Banho e Tosa por ordem de chegada) ----------

function dailyServiceJson(r) {
  let hl = r.health_checklist;
  if (typeof hl === 'string') {
    try { hl = JSON.parse(hl); } catch { hl = {}; }
  }
  let extras = r.selected_extras;
  if (typeof extras === 'string') {
    try { extras = JSON.parse(extras); } catch { extras = []; }
  }
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    phone: r.phone || '',
    petId: r.pet_id,
    petName: r.pet_name,
    petBreed: r.pet_breed || '',
    petWeightKg: r.pet_weight_kg !== null && r.pet_weight_kg !== undefined ? Number(r.pet_weight_kg) : null,
    petSizeTier: r.pet_size_tier || '',
    petImage: r.pet_image || null,
    serviceId: r.service_id,
    serviceName: r.service_name,
    selectedExtras: Array.isArray(extras) ? extras : [],
    date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : (typeof r.date === 'string' ? r.date.split('T')[0] : r.date),
    queueOrder: Number(r.queue_order) || 1,
    status: r.status,
    healthChecklist: hl || {},
    notes: r.notes || '',
    tosaNotes: r.tosa_notes || '',
    estimatedPrice: Number(r.estimated_price) || 0,
    finalPrice: r.final_price !== null && r.final_price !== undefined ? Number(r.final_price) : null,
    cageNumber: r.cage_number || '',
    groomerName: r.groomer_name || '',
    requiresValidation: !!r.requires_validation,
    validationConfirmed: !!r.validation_confirmed,
    validatedBy: r.validated_by || null,
    validatedAt: r.validated_at || null,
    checkinAt: r.checkin_at,
    startedAt: r.started_at,
    readyAt: r.ready_at,
    deliveredAt: r.delivered_at,
    estimatedReadyAt: r.estimated_ready_at || null,
    paid: !!r.paid,
    paidAt: r.paid_at || null,
    paymentMethod: r.payment_method || null,
    createdAt: r.created_at
  };
}

// Atalho para check-in direto a partir de um agendamento existente
app.post('/api/appointments/:id/checkin', requireAuth, requireStaff, async (req, res) => {
  const { rows: appts } = await pool.query(
    `SELECT a.*, c.phone as customer_phone, p.breed as pet_breed, p.id as pet_id, s.price as service_price
     FROM appointments a
     LEFT JOIN customers c ON c.id = a.customer_id
     LEFT JOIN pets p ON p.customer_id = a.customer_id AND LOWER(p.name) = LOWER(a.pet_name)
     LEFT JOIN catalog_services s ON s.id = a.service_id
     WHERE a.id = $1`,
    [req.params.id]
  );
  if (!appts.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
  const a = appts[0];

  const todayStr = new Date().toISOString().split('T')[0];
  const { rows: existing } = await pool.query(
    'SELECT id FROM daily_services WHERE appointment_id = $1 AND date = $2',
    [a.id, todayStr]
  );
  if (existing.length) {
    return res.status(400).json({ error: 'Este agendamento já deu entrada na fila hoje', dailyServiceId: existing[0].id });
  }

  const { rows: maxOrder } = await pool.query(
    'SELECT COALESCE(MAX(queue_order), 0) + 1 AS next_order FROM daily_services WHERE date = $1',
    [todayStr]
  );
  const nextOrder = Number(maxOrder[0].next_order) || 1;

  const isTosa = String(a.service_name || '').toLowerCase().includes('tosa');
  const price = a.service_price ? Number(a.service_price) : 79.90;

  const { rows: ds } = await pool.query(
    `INSERT INTO daily_services (
      appointment_id, customer_id, customer_name, phone,
      pet_id, pet_name, pet_breed, service_id, service_name,
      date, queue_order, status, health_checklist, notes,
      estimated_price, requires_validation, validation_confirmed, checkin_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'aguardando', $12, $13, $14, $15, $16, now())
    RETURNING *`,
    [
      a.id, a.customer_id, a.customer_name || 'Cliente', a.customer_phone || '',
      a.pet_id || null, a.pet_name, a.pet_breed || '', a.service_id || null, a.service_name || 'Serviço',
      todayStr, nextOrder, JSON.stringify({}), a.notes || '',
      price, isTosa, !isTosa
    ]
  );

  await pool.query("UPDATE appointments SET status = 'confirmado' WHERE id = $1", [a.id]);
  audit('daily_services', ds[0].id, 'checkin_from_appointment', null, { appointmentId: a.id }, req.user.id);

  res.status(201).json(dailyServiceJson(ds[0]));
});

// Listagem da fila do dia e métricas de capacidade
app.get('/api/daily-services', requireAuth, requireStaff, async (req, res) => {
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    `SELECT ds.*, p.image_path as pet_image
     FROM daily_services ds
     LEFT JOIN pets p ON p.id = ds.pet_id
     WHERE ds.date = $1
     ORDER BY ds.queue_order ASC, ds.id ASC`,
    [targetDate]
  );

  const d = new Date(targetDate + 'T12:00:00Z');
  const dayOfWeek = d.getUTCDay();
  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;
  const capacity = isSunday ? 0 : (isSaturday ? 32 : 50);

  const items = rows.map(dailyServiceJson);
  const waiting = items.filter(i => i.status === 'aguardando').length;
  const inProgress = items.filter(i => i.status === 'em_atendimento').length;
  const ready = items.filter(i => i.status === 'pronto').length;
  const delivered = items.filter(i => i.status === 'entregue').length;
  const canceled = items.filter(i => i.status === 'cancelado').length;
  const activeCount = items.length - canceled;

  res.json({
    items,
    stats: {
      date: targetDate,
      capacity,
      totalToday: items.length,
      waiting,
      inProgress,
      ready,
      delivered,
      canceled,
      remainingSpots: isSunday ? 0 : Math.max(0, capacity - activeCount),
      isFull: isSunday || activeCount >= capacity,
      isClosed: isSunday
    }
  });
});

// Novo check-in de balcão (ordem de chegada)
app.post('/api/daily-services', requireAuth, requireStaff, async (req, res) => {
  const {
    appointmentId, customerId, customerName, phone,
    petId, petName, petBreed, petWeightKg, petSizeTier, serviceId, serviceName,
    selectedExtras, healthChecklist, notes, tosaNotes, estimatedPrice,
    cageNumber, groomerName, requiresValidation, validationConfirmed, date,
    estimatedReadyAt
  } = req.body;

  if (!customerName || !petName || !serviceName) {
    return res.status(400).json({ error: 'Nome do cliente, nome do pet e serviço são obrigatórios' });
  }

  const targetDate = date || new Date().toISOString().split('T')[0];
  const d = new Date(targetDate + 'T12:00:00Z');
  const dayOfWeek = d.getUTCDay();
  const isSunday = dayOfWeek === 0;
  if (isSunday) {
    return res.status(400).json({ error: 'O pet shop está fechado aos domingos. A fila de atendimento não opera.' });
  }
  const isSaturday = dayOfWeek === 6;
  const capacity = isSaturday ? 32 : 50;

  const { rows: countRows } = await pool.query(
    "SELECT COUNT(*) FROM daily_services WHERE date = $1 AND status != 'cancelado'",
    [targetDate]
  );
  if (Number(countRows[0].count) >= capacity) {
    return res.status(400).json({ error: `Vagas do dia encerradas! Capacidade máxima de ${capacity} atendimentos já foi atingida hoje.` });
  }

  const { rows: maxOrder } = await pool.query(
    'SELECT COALESCE(MAX(queue_order), 0) + 1 AS next_order FROM daily_services WHERE date = $1',
    [targetDate]
  );
  const nextOrder = Number(maxOrder[0].next_order) || 1;

  const isTosa = String(serviceName).toLowerCase().includes('tosa');
  const reqVal = requiresValidation !== undefined ? !!requiresValidation : isTosa;
  const valConf = validationConfirmed !== undefined ? !!validationConfirmed : !reqVal;

  const { rows } = await pool.query(
    `INSERT INTO daily_services (
      appointment_id, customer_id, customer_name, phone,
      pet_id, pet_name, pet_breed, pet_weight_kg, pet_size_tier, service_id, service_name,
      selected_extras, date, queue_order, status, health_checklist, notes, tosa_notes,
      estimated_price, cage_number, groomer_name,
      requires_validation, validation_confirmed, estimated_ready_at, checkin_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'aguardando',$15,$16,$17,$18,$19,$20,$21,$22,$23,now())
    RETURNING *`,
    [
      appointmentId || null, customerId || null, String(customerName).trim(), phone || '',
      petId || null, String(petName).trim(), petBreed || '', petWeightKg ? Number(petWeightKg) : null,
      petSizeTier || '', serviceId || null, String(serviceName).trim(),
      JSON.stringify(selectedExtras || []), targetDate, nextOrder,
      JSON.stringify(healthChecklist || {}), notes || '', tosaNotes || '',
      Number(estimatedPrice) || 0, cageNumber || '', groomerName || '',
      reqVal, valConf, estimatedReadyAt || null
    ]
  );

  if (appointmentId) {
    await pool.query("UPDATE appointments SET status = 'confirmado' WHERE id = $1", [appointmentId]);
  }

  audit('daily_services', rows[0].id, 'create_checkin', null, { pet: petName, service: serviceName }, req.user.id);
  res.status(201).json(dailyServiceJson(rows[0]));
});

// Alteração de status da fila
app.patch('/api/daily-services/:id/status', requireAuth, requireStaff, async (req, res) => {
  const { status } = req.body;
  const valid = ['aguardando', 'em_atendimento', 'pronto', 'entregue', 'cancelado'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido' });

  const { rows: oldRows } = await pool.query('SELECT * FROM daily_services WHERE id = $1', [req.params.id]);
  if (!oldRows.length) return res.status(404).json({ error: 'Atendimento não encontrado' });
  const old = oldRows[0];

  // HU-06: Bloqueio estrito — tosa NUNCA avança para pronto ou entregue sem confirmação humana
  if (['pronto', 'entregue'].includes(status) && old.requires_validation && !old.validation_confirmed) {
    return res.status(400).json({
      error: 'Bloqueio de segurança: este procedimento de tosa requer validação humana confirmada com o tutor antes de ser concluído.'
    });
  }

  let setClause = 'status = $2';
  if (status === 'em_atendimento' && !old.started_at) {
    setClause += ', started_at = now()';
  } else if (status === 'pronto' && !old.ready_at) {
    setClause += ', ready_at = now()';
  } else if (status === 'entregue' && !old.delivered_at) {
    setClause += ', delivered_at = now()';
  }

  const { rows } = await pool.query(
    `UPDATE daily_services SET ${setClause} WHERE id = $1 RETURNING *`,
    [req.params.id, status]
  );

  if (status === 'entregue' && old.appointment_id) {
    await pool.query("UPDATE appointments SET status = 'concluido' WHERE id = $1", [old.appointment_id]);
  }

  audit('daily_services', rows[0].id, 'status', { status: old.status }, { status }, req.user.id);
  res.json(dailyServiceJson(rows[0]));
});

// Atualização de detalhes do atendimento
app.put('/api/daily-services/:id', requireAuth, requireStaff, async (req, res) => {
  const {
    cageNumber, groomerName, notes, tosaNotes, finalPrice, estimatedPrice,
    healthChecklist, validationConfirmed, validatedBy, queueOrder,
    petWeightKg, petSizeTier, selectedExtras, estimatedReadyAt,
    paid, paymentMethod
  } = req.body;

  const { rows: oldRows } = await pool.query('SELECT * FROM daily_services WHERE id = $1', [req.params.id]);
  if (!oldRows.length) return res.status(404).json({ error: 'Atendimento não encontrado' });
  const old = oldRows[0];

  const nowValidatedAt = (validationConfirmed && !old.validation_confirmed) ? new Date() : null;

  const { rows } = await pool.query(
    `UPDATE daily_services SET
      cage_number = COALESCE($2, cage_number),
      groomer_name = COALESCE($3, groomer_name),
      notes = COALESCE($4, notes),
      tosa_notes = COALESCE($5, tosa_notes),
      final_price = COALESCE($6, final_price),
      estimated_price = COALESCE($7, estimated_price),
      health_checklist = COALESCE($8, health_checklist),
      validation_confirmed = COALESCE($9, validation_confirmed),
      validated_by = COALESCE($10, validated_by),
      validated_at = COALESCE($11, validated_at),
      queue_order = COALESCE($12, queue_order),
      pet_weight_kg = COALESCE($13, pet_weight_kg),
      pet_size_tier = COALESCE($14, pet_size_tier),
      selected_extras = COALESCE($15, selected_extras),
      estimated_ready_at = COALESCE($16, estimated_ready_at),
      paid = COALESCE($17, paid),
      payment_method = COALESCE($18, payment_method)
     WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      cageNumber !== undefined ? cageNumber : null,
      groomerName !== undefined ? groomerName : null,
      notes !== undefined ? notes : null,
      tosaNotes !== undefined ? tosaNotes : null,
      finalPrice !== undefined ? Number(finalPrice) : null,
      estimatedPrice !== undefined ? Number(estimatedPrice) : null,
      healthChecklist !== undefined ? JSON.stringify(healthChecklist) : null,
      validationConfirmed !== undefined ? !!validationConfirmed : null,
      validatedBy !== undefined ? validatedBy : null,
      nowValidatedAt,
      queueOrder !== undefined ? Number(queueOrder) : null,
      petWeightKg !== undefined ? Number(petWeightKg) : null,
      petSizeTier !== undefined ? petSizeTier : null,
      selectedExtras !== undefined ? JSON.stringify(selectedExtras) : null,
      estimatedReadyAt !== undefined ? estimatedReadyAt : null,
      paid !== undefined ? !!paid : null,
      paymentMethod !== undefined ? paymentMethod : null
    ]
  );

  audit('daily_services', rows[0].id, 'update', null, req.body, req.user.id);
  res.json(dailyServiceJson(rows[0]));
});

// Cancelamento / remoção do atendimento
app.delete('/api/daily-services/:id', requireAuth, requireStaff, async (req, res) => {
  const { rows } = await pool.query('DELETE FROM daily_services WHERE id = $1 RETURNING *', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Atendimento não encontrado' });
  audit('daily_services', req.params.id, 'delete', { pet: rows[0].pet_name }, null, req.user.id);
  res.status(204).end();
});

// ---------- medications ----------

app.get('/api/medications', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM medications ORDER BY name ASC');
    res.json(rows.map(m => ({
      id: m.id,
      name: m.name,
      activePrinciple: m.active_principle,
      category: m.category,
      presentation: m.presentation,
      concentration: m.concentration,
      price: num(m.price),
      stock: m.stock,
      unit: m.unit,
      defaultDosage: m.default_dosage,
      requiresPrescription: !!m.requires_prescription,
      active: !!m.active,
      createdAt: m.created_at,
      updatedAt: m.updated_at
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar medicamentos' });
  }
});

app.post('/api/medications', requireAuth, requireStaff, async (req, res) => {
  const { name, activePrinciple, category, presentation, concentration, price, stock, unit, defaultDosage, requiresPrescription, active } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome do medicamento é obrigatório' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO medications (name, active_principle, category, presentation, concentration, price, stock, unit, default_dosage, requires_prescription, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [name.trim(), activePrinciple || '', category || 'Outros', presentation || 'Comprimido', concentration || '', num(price) || 0, Math.max(0, parseInt(stock) || 0), unit || 'cx', defaultDosage || '', !!requiresPrescription, active !== false]
    );
    const m = rows[0];
    audit('medications', m.id, 'create', { name: m.name }, null, req.user.id);
    res.status(201).json({
      id: m.id,
      name: m.name,
      activePrinciple: m.active_principle,
      category: m.category,
      presentation: m.presentation,
      concentration: m.concentration,
      price: num(m.price),
      stock: m.stock,
      unit: m.unit,
      defaultDosage: m.default_dosage,
      requiresPrescription: !!m.requires_prescription,
      active: !!m.active
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar medicamento' });
  }
});

app.put('/api/medications/:id', requireAuth, requireStaff, async (req, res) => {
  const { name, activePrinciple, category, presentation, concentration, price, stock, unit, defaultDosage, requiresPrescription, active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE medications SET
         name = COALESCE($1, name),
         active_principle = COALESCE($2, active_principle),
         category = COALESCE($3, category),
         presentation = COALESCE($4, presentation),
         concentration = COALESCE($5, concentration),
         price = CASE WHEN $6::numeric IS NOT NULL THEN $6 ELSE price END,
         stock = CASE WHEN $7::integer IS NOT NULL THEN $7 ELSE stock END,
         unit = COALESCE($8, unit),
         default_dosage = COALESCE($9, default_dosage),
         requires_prescription = CASE WHEN $10::boolean IS NOT NULL THEN $10 ELSE requires_prescription END,
         active = CASE WHEN $11::boolean IS NOT NULL THEN $11 ELSE active END,
         updated_at = NOW()
       WHERE id = $12 RETURNING *`,
      [name, activePrinciple, category, presentation, concentration, price !== undefined ? num(price) : null, stock !== undefined ? parseInt(stock) : null, unit, defaultDosage, requiresPrescription !== undefined ? !!requiresPrescription : null, active !== undefined ? !!active : null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Medicamento não encontrado' });
    const m = rows[0];
    audit('medications', m.id, 'update', { name: m.name }, null, req.user.id);
    res.json({
      id: m.id,
      name: m.name,
      activePrinciple: m.active_principle,
      category: m.category,
      presentation: m.presentation,
      concentration: m.concentration,
      price: num(m.price),
      stock: m.stock,
      unit: m.unit,
      defaultDosage: m.default_dosage,
      requiresPrescription: !!m.requires_prescription,
      active: !!m.active
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar medicamento' });
  }
});

app.delete('/api/medications/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM medications WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Medicamento não encontrado' });
    audit('medications', req.params.id, 'delete', { name: rows[0].name }, null, req.user.id);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir medicamento' });
  }
});

// ---------- taxi dog (HU-12, HU-13, HU-15) ----------

app.get('/api/taxi/regions', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM taxi_regions ORDER BY price ASC, name ASC');
    res.json(rows.map(r => ({
      id: String(r.id),
      name: r.name,
      aliases: r.aliases || [],
      price: num(r.price),
      active: !!r.active,
      notes: r.notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar regiões de táxi' });
  }
});

app.post('/api/taxi/regions', requireAuth, requireStaff, async (req, res) => {
  const { name, aliases, price, active, notes } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome da região é obrigatório' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO taxi_regions (name, aliases, price, active, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), aliases || [], num(price) || 0, active !== false, notes || '']
    );
    const r = rows[0];
    audit('taxi_regions', r.id, 'create', { name: r.name, price: r.price }, null, req.user.id);
    res.status(201).json({
      id: String(r.id),
      name: r.name,
      aliases: r.aliases || [],
      price: num(r.price),
      active: !!r.active,
      notes: r.notes || ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar região de táxi' });
  }
});

app.put('/api/taxi/regions/:id', requireAuth, requireStaff, async (req, res) => {
  const { name, aliases, price, active, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE taxi_regions SET
         name = COALESCE($1, name),
         aliases = COALESCE($2, aliases),
         price = CASE WHEN $3::numeric IS NOT NULL THEN $3 ELSE price END,
         active = CASE WHEN $4::boolean IS NOT NULL THEN $4 ELSE active END,
         notes = COALESCE($5, notes),
         updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, aliases, price !== undefined ? num(price) : null, active !== undefined ? !!active : null, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Região não encontrada' });
    const r = rows[0];
    audit('taxi_regions', r.id, 'update', { name: r.name, price: r.price }, null, req.user.id);
    res.json({
      id: String(r.id),
      name: r.name,
      aliases: r.aliases || [],
      price: num(r.price),
      active: !!r.active,
      notes: r.notes || ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar região de táxi' });
  }
});

app.delete('/api/taxi/regions/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM taxi_regions WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Região não encontrada' });
    audit('taxi_regions', req.params.id, 'delete', { name: rows[0].name }, null, req.user.id);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir região' });
  }
});

app.get('/api/taxi/trips', requireAuth, requireStaff, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM taxi_trips ORDER BY created_at DESC');
    res.json(rows.map(t => ({
      id: String(t.id),
      checkinId: t.checkin_id ? String(t.checkin_id) : undefined,
      petId: t.pet_id,
      petName: t.pet_name,
      customerName: t.customer_name,
      customerPhone: t.customer_phone,
      tripType: t.trip_type,
      originAddress: t.origin_address,
      regionId: t.region_id ? String(t.region_id) : '',
      regionName: t.region_name,
      price: num(t.price),
      driverName: t.driver_name,
      status: t.status,
      notes: t.notes || '',
      createdAt: t.created_at,
      updatedAt: t.updated_at
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar corridas de táxi' });
  }
});

app.post('/api/taxi/trips', requireAuth, requireStaff, async (req, res) => {
  const { checkinId, petId, petName, customerName, customerPhone, tripType, originAddress, regionId, regionName, price, driverName, status, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO taxi_trips (checkin_id, pet_id, pet_name, customer_name, customer_phone, trip_type, origin_address, region_id, region_name, price, driver_name, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [checkinId ? parseInt(checkinId) : null, petId || null, petName, customerName, customerPhone || '', tripType || 'ida_e_volta', originAddress, regionId ? parseInt(regionId) : null, regionName || '', num(price) || 0, driverName || 'Lucas (O Rapaz)', status || 'a_caminho_buscar', notes || '']
    );
    const t = rows[0];
    res.status(201).json({
      id: String(t.id),
      checkinId: t.checkin_id ? String(t.checkin_id) : undefined,
      petId: t.pet_id,
      petName: t.pet_name,
      customerName: t.customer_name,
      customerPhone: t.customer_phone,
      tripType: t.trip_type,
      originAddress: t.origin_address,
      regionId: t.region_id ? String(t.region_id) : '',
      regionName: t.region_name,
      price: num(t.price),
      driverName: t.driver_name,
      status: t.status,
      notes: t.notes || '',
      createdAt: t.created_at
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar corrida' });
  }
});

app.patch('/api/taxi/trips/:id/status', requireAuth, requireStaff, async (req, res) => {
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE taxi_trips SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Corrida não encontrada' });
    const t = rows[0];
    res.json({
      id: String(t.id),
      status: t.status,
      updatedAt: t.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status da corrida' });
  }
});

app.delete('/api/taxi/trips/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    await pool.query('DELETE FROM taxi_trips WHERE id = $1', [req.params.id]);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir corrida' });
  }
});

// ---------- groomers / tosadores & comissoes (HU-18 & HU-19) ----------

app.get('/api/groomers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM groomers ORDER BY active DESC, name ASC');
    res.json(rows.map(g => ({
      id: g.id,
      name: g.name,
      phone: g.phone || '',
      commissionRate: num(g.commission_rate) || 15.0,
      active: !!g.active,
      userId: g.user_id,
      createdAt: g.created_at,
      updatedAt: g.updated_at
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar tosadores' });
  }
});

app.post('/api/groomers', requireAuth, requireStaff, async (req, res) => {
  const { name, phone, commissionRate, active, userId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome do tosador é obrigatório' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO groomers (name, phone, commission_rate, active, user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), phone || '', commissionRate !== undefined ? num(commissionRate) : 15.0, active !== false, userId || null]
    );
    const g = rows[0];
    res.status(201).json({
      id: g.id,
      name: g.name,
      phone: g.phone || '',
      commissionRate: num(g.commission_rate),
      active: !!g.active,
      userId: g.user_id
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar tosador' });
  }
});

app.put('/api/groomers/:id', requireAuth, requireStaff, async (req, res) => {
  const { name, phone, commissionRate, active, userId } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE groomers SET
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         commission_rate = CASE WHEN $3::numeric IS NOT NULL THEN $3 ELSE commission_rate END,
         active = CASE WHEN $4::boolean IS NOT NULL THEN $4 ELSE active END,
         user_id = COALESCE($5, user_id),
         updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, phone, commissionRate !== undefined ? num(commissionRate) : null, active !== undefined ? !!active : null, userId || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tosador não encontrado' });
    const g = rows[0];
    res.json({
      id: g.id,
      name: g.name,
      phone: g.phone || '',
      commissionRate: num(g.commission_rate),
      active: !!g.active,
      userId: g.user_id
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar tosador' });
  }
});

app.delete('/api/groomers/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    await pool.query('DELETE FROM groomers WHERE id = $1', [req.params.id]);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir tosador' });
  }
});

// ---------- payables / contas a pagar (HU-23 & HU-24) ----------

app.get('/api/payables', requireAuth, requireStaff, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM payables ORDER BY status ASC, due_date ASC');
    res.json(rows.map(p => ({
      id: p.id,
      description: p.description,
      amount: num(p.amount),
      dueDate: p.due_date ? p.due_date.toISOString().split('T')[0] : '',
      category: p.category,
      supplier: p.supplier || '',
      status: p.status,
      paidAt: p.paid_at,
      paymentMethod: p.payment_method,
      cashMovementId: p.cash_movement_id,
      groomerId: p.groomer_id,
      notes: p.notes || '',
      createdAt: p.created_at,
      updatedAt: p.updated_at
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar contas a pagar' });
  }
});

app.post('/api/payables', requireAuth, requireStaff, async (req, res) => {
  const { description, amount, dueDate, category, supplier, status, notes, groomerId } = req.body;
  if (!description || !amount || !dueDate) return res.status(400).json({ error: 'Descrição, valor e vencimento são obrigatórios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO payables (description, amount, due_date, category, supplier, status, notes, groomer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [description, num(amount), dueDate, category || 'outro', supplier || '', status || 'previsto', notes || '', groomerId || null]
    );
    const p = rows[0];
    res.status(201).json({
      id: p.id,
      description: p.description,
      amount: num(p.amount),
      dueDate: p.due_date ? p.due_date.toISOString().split('T')[0] : '',
      category: p.category,
      supplier: p.supplier || '',
      status: p.status,
      notes: p.notes || ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar conta a pagar' });
  }
});

app.put('/api/payables/:id', requireAuth, requireStaff, async (req, res) => {
  const { description, amount, dueDate, category, supplier, status, paidAt, paymentMethod, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE payables SET
         description = COALESCE($1, description),
         amount = CASE WHEN $2::numeric IS NOT NULL THEN $2 ELSE amount END,
         due_date = CASE WHEN $3::date IS NOT NULL THEN $3 ELSE due_date END,
         category = COALESCE($4, category),
         supplier = COALESCE($5, supplier),
         status = COALESCE($6, status),
         paid_at = CASE WHEN $7::timestamptz IS NOT NULL THEN $7 ELSE paid_at END,
         payment_method = COALESCE($8, payment_method),
         notes = COALESCE($9, notes),
         updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [description, amount !== undefined ? num(amount) : null, dueDate || null, category, supplier, status, paidAt || null, paymentMethod, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Conta a pagar não encontrada' });
    const p = rows[0];
    res.json({
      id: p.id,
      description: p.description,
      amount: num(p.amount),
      dueDate: p.due_date ? p.due_date.toISOString().split('T')[0] : '',
      category: p.category,
      supplier: p.supplier || '',
      status: p.status,
      paidAt: p.paid_at,
      paymentMethod: p.payment_method
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar conta a pagar' });
  }
});

app.delete('/api/payables/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    await pool.query('DELETE FROM payables WHERE id = $1', [req.params.id]);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir conta a pagar' });
  }
});

// ---------- orders ----------

app.get('/api/orders', requireAuth, async (req, res) => {
  const { rows } = isStaff(req.user)
    ? await pool.query('SELECT * FROM orders ORDER BY created_at DESC, id DESC')
    : await pool.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC, id DESC', [req.user.id]);
  res.json(rows.map(o => ({
    id: o.id, orderNumber: o.order_number, userId: o.user_id, customerName: o.customer_name,
    email: o.email, phone: o.phone, address: o.address, paymentMethod: o.payment_method,
    items: o.items, total: num(o.total), status: o.status, createdAt: o.created_at,
    couponCode: o.coupon_code, discount: num(o.discount)
  })));
});

app.post('/api/orders', requireAuth, async (req, res) => {
  const { customerName, email, phone, address, items, paymentMethod, couponCode } = req.body;
  const requested = Array.isArray(items) ? items : [];
  if (!requested.length) return res.status(400).json({ error: 'Carrinho vazio' });

  // Preço e nome validados no servidor
  // Suporta: Produtos, Serviços do Catálogo, Medicamentos da Farmácia, Consultas e Atendimentos da Esteira
  const itemId = i => Number(i && (i.id ?? i.productId));
  const ids = requested.map(itemId).filter(Number.isInteger);

  // 1. Produtos
  const { rows: prods } = await pool.query('SELECT id, name, price, stock FROM products WHERE id = ANY($1)', [ids]);
  const prodsById = new Map(prods.map(p => [p.id, p]));

  // 2. Serviços de catálogo (ids >= 5000 && < 7000)
  const serviceIds = ids.filter(id => id >= 5000 && id < 7000).map(id => id - 5000);
  const { rows: servs } = serviceIds.length
    ? await pool.query('SELECT id, name, price FROM catalog_services WHERE id = ANY($1)', [serviceIds])
    : { rows: [] };
  const servsById = new Map(servs.map(s => [5000 + s.id, s]));

  // 3. Medicamentos (ids >= 8000 && < 9000)
  const medIds = ids.filter(id => id >= 8000 && id < 9000).map(id => id - 8000);
  const { rows: meds } = medIds.length
    ? await pool.query('SELECT id, name, price, stock FROM medications WHERE id = ANY($1)', [medIds])
    : { rows: [] };
  const medsById = new Map(meds.map(m => [8000 + m.id, m]));

  // 4. Atendimentos da fila diária / esteira (ids >= 9000)
  const dailyIds = ids.filter(id => id >= 9000).map(id => id - 9000);
  const { rows: dailyServices } = dailyIds.length
    ? await pool.query('SELECT id, pet_name, service_name, price FROM daily_services WHERE id = ANY($1)', [dailyIds])
    : { rows: [] };
  const dailyById = new Map(dailyServices.map(d => [9000 + d.id, d]));

  const serverItems = [];
  for (const i of requested) {
    const rawId = itemId(i);
    const qty = Math.floor(Number(i && i.quantity));
    if (!qty || qty < 1 || qty > 999) {
      return res.status(400).json({ error: `Quantidade inválida: ${(i && i.name) || rawId}` });
    }

    const prod = prodsById.get(rawId);
    const serv = servsById.get(rawId);
    const med = medsById.get(rawId);
    const daily = dailyById.get(rawId);

    if (prod) {
      if (prod.stock !== null && prod.stock !== undefined && qty > Number(prod.stock)) {
        return res.status(400).json({ error: `Estoque insuficiente: ${prod.name} (disponível: ${prod.stock})` });
      }
      serverItems.push({ id: prod.id, name: prod.name, price: num(prod.price), quantity: qty, isProduct: true });
    } else if (serv) {
      serverItems.push({ id: rawId, name: i.name || `Serviço: ${serv.name}`, price: num(serv.price), quantity: qty });
    } else if (med) {
      if (med.stock !== null && med.stock !== undefined && qty > Number(med.stock)) {
        return res.status(400).json({ error: `Estoque insuficiente: ${med.name} (disponível: ${med.stock})` });
      }
      serverItems.push({ id: rawId, name: i.name || `Medicamento: ${med.name}`, price: num(med.price), quantity: qty, isMedication: true, medId: med.id });
    } else if (daily) {
      const price = daily.price ? num(daily.price) : (Number(i.price) || 79.90);
      serverItems.push({ id: rawId, name: i.name || `${daily.service_name} — Pet ${daily.pet_name}`, price, quantity: qty, dailyId: daily.id });
    } else if ((rawId >= 7000 && rawId < 8000) || (i && i.name && i.name.includes('Consulta'))) {
      // Consulta veterinária
      const price = Number(i && i.price) > 0 ? num(i.price) : 150.00;
      serverItems.push({ id: rawId, name: i.name || 'Consulta Veterinária', price, quantity: qty });
    } else if (i && i.name && Number(i.price) > 0) {
      // Qualquer outro serviço ou item customizado legítimo do sistema
      serverItems.push({ id: rawId || 9999, name: String(i.name), price: num(i.price), quantity: qty });
    } else {
      return res.status(400).json({ error: `Item inválido: ${(i && i.name) || rawId}` });
    }
  }
  const subtotal = serverItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0);

  // M26 cupom: valida e calcula desconto no servidor — nunca confia no valor do front
  let coupon = null, discount = 0, total = subtotal;
  if (couponCode) {
    const { rows: cRows } = await pool.query(
      `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND active
         AND (expires_at IS NULL OR expires_at > now())
         AND (max_uses IS NULL OR used_count < max_uses)`,
      [String(couponCode).trim()]
    );
    coupon = cRows[0] || null;
    if (!coupon) return res.status(400).json({ error: 'Cupom inválido ou expirado' });
    if (subtotal < Number(coupon.min_order_total)) {
      return res.status(400).json({ error: `Pedido mínimo de R$ ${Number(coupon.min_order_total).toFixed(2)} para este cupom` });
    }
    discount = coupon.discount_type === 'percent'
      ? subtotal * Number(coupon.discount_value) / 100
      : Number(coupon.discount_value);
    discount = Math.min(Math.max(0, discount), subtotal);
    total = Math.max(0, subtotal - discount);
  }

  // Dono do pedido é sempre o usuário da sessão; nome do cliente vem do cadastro quando for cliente
  let ownerName = customerName;
  if (!isStaff(req.user)) {
    const { rows: cust } = await pool.query('SELECT name FROM customers WHERE user_id=$1', [req.user.id]);
    if (cust.length) ownerName = cust[0].name;
  }
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: seq } = await client.query(
      `SELECT 'AW-' || LPAD(nextval('orders_id_seq')::text, 4, '0') AS order_number`
    );
    // Incremento atômico do uso do cupom — a cláusula WHERE garante que não estoure max_uses
    if (coupon) {
      const use = await client.query(
        `UPDATE coupons SET used_count = used_count + 1
         WHERE id = $1 AND active
           AND (expires_at IS NULL OR expires_at > now())
           AND (max_uses IS NULL OR used_count < max_uses)`,
        [coupon.id]
      );
      if (!use.rowCount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cupom esgotado' });
      }
    }
    const { rows } = await client.query(
      `INSERT INTO orders (order_number, user_id, customer_name, email, phone, address, payment_method, items, total, coupon_code, discount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [seq[0].order_number, userId, ownerName, email || null, phone || null, address || null,
       paymentMethod || null, JSON.stringify(serverItems), total,
       coupon ? coupon.code : null, discount]
    );
    // Pedido 100% descontado não gera movimento de caixa (CHECK amount > 0)
    if (total > 0) {
      await client.query(
        `INSERT INTO cash_movements (order_id, type, description, amount, payment_method)
         VALUES ($1, 'entrada', $2, $3, $4)`,
        [rows[0].id, `Pedido ${seq[0].order_number}`, total, paymentMethod || null]
      );
    }
    // Baixa de estoque atômica: só decrementa produtos físicos com controle de estoque
    for (const item of serverItems) {
      if (item.isProduct) {
        const dec = await client.query(
          'UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock IS NOT NULL AND stock >= $2',
          [item.id, item.quantity]
        );
        if (dec.rowCount === 0) {
          const chk = await client.query('SELECT stock FROM products WHERE id=$1', [item.id]);
          if (chk.rows.length && chk.rows[0].stock !== null && Number(chk.rows[0].stock) < item.quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Estoque insuficiente: ${item.name}` });
          }
        }
      } else if (item.isMedication && item.medId) {
        await client.query(
          'UPDATE medications SET stock = stock - $2 WHERE id = $1 AND stock IS NOT NULL AND stock >= $2',
          [item.medId, item.quantity]
        );
      }
      if (item.dailyId) {
        await client.query(
          "UPDATE daily_services SET status = 'entregue' WHERE id = $1",
          [item.dailyId]
        );
      }
    }
    await client.query('COMMIT');
    const o = rows[0];
    audit('orders', o.id, 'create', null, { orderNumber: o.order_number, total: num(o.total), status: o.status }, req.user.id);
    res.status(201).json({
      id: o.id, orderNumber: o.order_number, userId: o.user_id, customerName: o.customer_name,
      email: o.email, phone: o.phone, address: o.address, paymentMethod: o.payment_method,
      items: o.items, total: num(o.total), status: o.status, createdAt: o.created_at,
      couponCode: o.coupon_code, discount: num(o.discount)
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// ---------- cash register (caixa) ----------

app.get('/api/cash', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM cash_movements ORDER BY created_at DESC, id DESC');
  res.json(rows.map(m => ({
    id: m.id, orderId: m.order_id, type: m.type, description: m.description,
    amount: num(m.amount), paymentMethod: m.payment_method, createdAt: m.created_at
  })));
});

// Export CSV do extrato de caixa (admin) — pro contador
app.get('/api/cash/export.csv', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM cash_movements ORDER BY created_at, id');
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['id;tipo;descricao;valor;pagamento;pedido;data'];
  for (const m of rows) {
    lines.push([
      m.id, m.type, esc(m.description), Number(m.amount).toFixed(2),
      esc(m.payment_method || ''), m.order_id || '',
      m.created_at ? new Date(m.created_at).toISOString() : ''
    ].join(';'));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="caixa-animal-world.csv"');
  res.send('﻿' + lines.join('\r\n'));
});

app.post('/api/cash', requireAuth, requireAdmin, async (req, res) => {
  const { type, description, amount, paymentMethod } = req.body || {};
  if (!['entrada', 'saida'].includes(type)) return res.status(400).json({ error: 'Tipo deve ser entrada ou saida' });
  if (!description) return res.status(400).json({ error: 'Descrição é obrigatória' });
  const value = Number(amount);
  if (!value || value <= 0) return res.status(400).json({ error: 'Valor deve ser maior que zero' });
  const { rows } = await pool.query(
    `INSERT INTO cash_movements (type, description, amount, payment_method) VALUES ($1,$2,$3,$4) RETURNING *`,
    [type, description, value, paymentMethod || null]
  );
  const m = rows[0];
  res.status(201).json({
    id: m.id, orderId: m.order_id, type: m.type, description: m.description,
    amount: num(m.amount), paymentMethod: m.payment_method, createdAt: m.created_at
  });
});

app.patch('/api/orders/:id/status', requireAuth, requireStaff, async (req, res) => {
  const { status } = req.body;
  const valid = ['pendente', 'pago', 'cancelado', 'entregue'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  const { rows: oldRows } = await pool.query('SELECT id, status FROM orders WHERE id=$1', [req.params.id]);
  if (!oldRows.length) return res.status(404).json({ error: 'Pedido não encontrado' });
  const { rows } = await pool.query(
    'UPDATE orders SET status=$2 WHERE id=$1 RETURNING *',
    [req.params.id, status]
  );
  audit('orders', rows[0].id, 'status', { status: oldRows[0].status }, { status }, req.user.id);
  const o = rows[0];
  res.json({
    id: o.id, orderNumber: o.order_number, userId: o.user_id, customerName: o.customer_name,
    email: o.email, phone: o.phone, address: o.address, paymentMethod: o.payment_method,
    items: o.items, total: num(o.total), status: o.status, createdAt: o.created_at
  });
});

// ---------- upload de imagens (M17) ----------

const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

const uploadLimiter = createRateLimiter(15 * 60 * 1000, 30, 'Limite de uploads excedido. Aguarde alguns minutos.');

const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
app.post('/api/upload', requireAuth, requireProductManager, uploadLimiter, async (req, res) => {
  const { filename, data } = req.body || {};
  const m = /^data:(image\/[a-z]+);base64,(.+)$/is.exec(String(data || ''));
  if (!m || !MIME_EXT[m[1].toLowerCase()]) {
    return res.status(400).json({ error: 'Envie uma imagem (PNG, JPG, WebP ou GIF) em base64' });
  }
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Imagem vazia ou maior que 5MB' });
  }
  // Magic bytes: o MIME do data URL sozinho não prova que o conteúdo é imagem de verdade
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  const isJpg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isGif = buf.slice(0, 3).toString('ascii') === 'GIF';
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  const mime = m[1].toLowerCase();
  const mimeOk =
    (mime === 'image/png' && isPng) ||
    ((mime === 'image/jpeg' || mime === 'image/jpg') && isJpg) ||
    (mime === 'image/gif' && isGif) ||
    (mime === 'image/webp' && isWebp);
  // Trailer da assinatura: PNG termina com IEND, JPEG com FFD9, GIF com 0x3B —
  // impede "PNG válido + HTML anexado" de passar como imagem
  const trailerOk =
    (mime === 'image/png' && buf.slice(-8).equals(Buffer.from([0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82]))) ||
    ((mime === 'image/jpeg' || mime === 'image/jpg') && buf[buf.length - 2] === 0xFF && buf[buf.length - 1] === 0xD9) ||
    (mime === 'image/gif' && buf[buf.length - 1] === 0x3B) ||
    mime === 'image/webp';
  if (!mimeOk || !trailerOk) {
    return res.status(400).json({ error: 'O conteúdo do arquivo não corresponde a uma imagem válida' });
  }
  const base = String(filename || 'foto').replace(/\.[^.]*$/, '').replace(/[^\w\-]/g, '').slice(-40) || 'foto';
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}.${MIME_EXT[m[1].toLowerCase()]}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, name), buf);
  res.status(201).json({ imagePath: `/uploads/${name}` });
});

// ---------- cupons (M26) ----------

const couponJson = c => ({
  id: c.id, code: c.code, discountType: c.discount_type, discountValue: num(c.discount_value),
  minOrderTotal: num(c.min_order_total), active: c.active, maxUses: c.max_uses,
  usedCount: c.used_count, expiresAt: c.expires_at, createdAt: c.created_at
});

app.get('/api/coupons', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM coupons ORDER BY id DESC');
  res.json(rows.map(couponJson));
});

app.post('/api/coupons', requireAuth, requireAdmin, async (req, res) => {
  const { code, discountType, discountValue, minOrderTotal, maxUses, expiresAt, active } = req.body || {};
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(cleanCode)) {
    return res.status(400).json({ error: 'Código deve ter 3-40 caracteres (A-Z, 0-9, _ ou -)' });
  }
  if (!['percent', 'fixed'].includes(discountType)) {
    return res.status(400).json({ error: 'Tipo de desconto deve ser percent ou fixed' });
  }
  const val = Number(discountValue);
  if (!val || val <= 0 || (discountType === 'percent' && val > 100)) {
    return res.status(400).json({ error: discountType === 'percent' ? 'Percentual entre 0 e 100' : 'Valor deve ser maior que zero' });
  }
  if (expiresAt && isNaN(Date.parse(expiresAt))) {
    return res.status(400).json({ error: 'Data de expiração inválida' });
  }
  const { rows } = await pool.query(
    `INSERT INTO coupons (code, discount_type, discount_value, min_order_total, active, max_uses, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [cleanCode, discountType, val, Math.max(0, Number(minOrderTotal) || 0),
     active !== false, maxUses ? Math.floor(Number(maxUses)) : null, expiresAt || null]
  );
  audit('coupons', rows[0].id, 'create', null, { code: cleanCode }, req.user.id);
  res.status(201).json(couponJson(rows[0]));
});

app.put('/api/coupons/:id', requireAuth, requireAdmin, async (req, res) => {
  const { code, discountType, discountValue, minOrderTotal, maxUses, expiresAt, active } = req.body || {};
  const { rows: old } = await pool.query('SELECT * FROM coupons WHERE id=$1', [req.params.id]);
  if (!old.length) return res.status(404).json({ error: 'Cupom não encontrado' });
  const cleanCode = code ? String(code).trim().toUpperCase() : old[0].code;
  const type = discountType || old[0].discount_type;
  const val = discountValue !== undefined ? Number(discountValue) : Number(old[0].discount_value);
  if (!val || val <= 0 || (type === 'percent' && val > 100)) {
    return res.status(400).json({ error: 'Valor de desconto inválido' });
  }
  const expAt = expiresAt !== undefined ? (expiresAt || null) : old[0].expires_at;
  if (expAt && isNaN(Date.parse(expAt))) {
    return res.status(400).json({ error: 'Data de expiração inválida' });
  }
  const { rows } = await pool.query(
    `UPDATE coupons SET code=$2, discount_type=$3, discount_value=$4, min_order_total=$5,
       active=$6, max_uses=$7, expires_at=$8 WHERE id=$1 RETURNING *`,
    [req.params.id, cleanCode, type, val,
     minOrderTotal !== undefined ? Math.max(0, Number(minOrderTotal) || 0) : Number(old[0].min_order_total),
     active !== undefined ? !!active : old[0].active,
     maxUses !== undefined ? (maxUses ? Math.floor(Number(maxUses)) : null) : old[0].max_uses,
     expAt]
  );
  audit('coupons', rows[0].id, 'update', { code: old[0].code }, { code: rows[0].code }, req.user.id);
  res.json(couponJson(rows[0]));
});

app.delete('/api/coupons/:id', requireAuth, requireAdmin, async (req, res) => {
  const { rows: old } = await pool.query('SELECT * FROM coupons WHERE id=$1', [req.params.id]);
  if (!old.length) return res.status(404).json({ error: 'Cupom não encontrado' });
  await pool.query('DELETE FROM coupons WHERE id=$1', [req.params.id]);
  audit('coupons', old[0].id, 'delete', { code: old[0].code }, null, req.user.id);
  res.status(204).end();
});

// Preview do desconto no checkout — mesmo cálculo do POST /orders, sem consumir uso.
// Sempre 200 com {valid:false,message} em erro de negócio: o front trata como feedback, não falha.
app.post('/api/coupons/validate', requireAuth, async (req, res) => {
  const { code, total } = req.body || {};
  const sub = Number(total);
  if (!code || !Number.isFinite(sub) || sub < 0) {
    return res.status(400).json({ error: 'Informe code e total' });
  }
  const { rows } = await pool.query(
    `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND active
       AND (expires_at IS NULL OR expires_at > now())
       AND (max_uses IS NULL OR used_count < max_uses)`,
    [String(code).trim()]
  );
  const c = rows[0];
  if (!c) return res.json({ valid: false, message: 'Cupom inválido ou expirado' });
  if (sub < Number(c.min_order_total)) {
    return res.json({ valid: false, message: `Pedido mínimo de R$ ${Number(c.min_order_total).toFixed(2)}` });
  }
  const discount = Math.min(
    c.discount_type === 'percent' ? sub * Number(c.discount_value) / 100 : Number(c.discount_value),
    sub
  );
  const rounded = Math.round(discount * 100) / 100;
  res.json({
    valid: true, code: c.code, type: c.discount_type, value: num(c.discount_value),
    discount: rounded, finalTotal: Math.round((sub - rounded) * 100) / 100
  });
});

// ---------- auditoria (M23) ----------

app.get('/api/audit', requireAuth, requireAdmin, async (req, res) => {
  const { entity, entityId } = req.query;
  const params = [];
  let where = '';
  if (entity) { params.push(String(entity).slice(0, 60)); where += ` AND a.entity = $${params.length}`; }
  if (entityId) {
    if (!/^\d+$/.test(String(entityId))) return res.status(400).json({ error: 'entityId inválido' });
    params.push(Number(entityId)); where += ` AND a.entity_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT a.id, a.entity, a.entity_id, a.action, a.old_data, a.new_data, a.created_at,
            u.name AS user_name, u.email AS user_email
     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     WHERE 1=1 ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT 200`,
    params
  );
  res.json(rows.map(r => ({
    id: r.id, entity: r.entity, entityId: r.entity_id, action: r.action,
    oldData: r.old_data, newData: r.new_data, createdAt: r.created_at,
    userName: r.user_name, userEmail: r.user_email
  })));
});

// ---------- LGPD (M25): exportar e excluir dados do titular ----------

app.get('/api/me/export', requireAuth, async (req, res) => {
  const uid = req.user.id;
  const [user, customers, pets, orders, appointments, consultations] = await Promise.all([
    pool.query('SELECT id, name, email, role, consent_lgpd_at, consent_version FROM users WHERE id=$1', [uid]),
    pool.query('SELECT * FROM customers WHERE user_id=$1', [uid]),
    pool.query(
      `SELECT p.* FROM pets p JOIN customers c ON c.id = p.customer_id WHERE c.user_id=$1`, [uid]),
    pool.query('SELECT * FROM orders WHERE user_id=$1', [uid]),
    pool.query(
      `SELECT a.* FROM appointments a JOIN customers c ON c.id = a.customer_id WHERE c.user_id=$1`, [uid]),
    pool.query(
      `SELECT con.*, pr.notes as prescription_notes
       FROM consultations con
       JOIN pets p ON p.id = con.pet_id
       JOIN customers c ON c.id = p.customer_id
       LEFT JOIN prescriptions pr ON pr.consultation_id = con.id
       WHERE c.user_id=$1`, [uid])
  ]);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="meus-dados-animal-world.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    user: user.rows[0] || null,
    customers: customers.rows,
    pets: pets.rows,
    orders: orders.rows,
    appointments: appointments.rows,
    consultations: consultations.rows
  });
});

// Exclusão = anonimização (pedido de titular LGPD): PII some, histórico financeiro e clínico preservados sem identificação
app.delete('/api/me', requireAuth, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Apenas clientes podem excluir a própria conta por aqui' });
  }
  // Re-autenticação: excluir conta é irreversível — exige a senha atual
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Informe sua senha para confirmar a exclusão' });
  const { rows: uRows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  const stored = uRows[0] && uRows[0].password_hash;
  const ok = stored && (isBcrypt(stored)
    ? await bcrypt.compare(String(password), stored)
    : crypto.createHash('sha256').update(String(password)).digest('hex') === stored);
  if (!ok) return res.status(403).json({ error: 'Senha incorreta' });
  const uid = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: custs } = await client.query('SELECT id FROM customers WHERE user_id=$1', [uid]);
    const custIds = custs.map(c => c.id);
    if (custIds.length) {
      await client.query(
        `UPDATE appointments SET customer_name='Titular Anonimizado', pet_name='Pet Anonimizado'
         WHERE customer_id = ANY($1) OR user_id = $2`, [custIds, uid]);
      // Anonimização LGPD compatível com CFMV Res. 1321/2020:
      // Preserva prontuários e receitas (guarda obrigatória de 5 anos) removendo dados pessoais
      await client.query(
        `UPDATE pets SET name='Pet Anonimizado', breed=NULL, age=NULL, image_path=NULL
         WHERE customer_id = ANY($1)`, [custIds]);
      await client.query(
        `UPDATE customers SET name='Titular Anonimizado', email='anonimizado-' || id || '@lgpd.invalid', phone='', status='inactive', user_id=NULL
         WHERE user_id=$1`, [uid]);
    }
    await client.query(
      `UPDATE orders SET customer_name='Excluído', email=NULL, phone=NULL, address=NULL
       WHERE user_id=$1`, [uid]);
    await client.query('DELETE FROM sessions WHERE user_id=$1', [uid]);
    await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1', [uid]);
    await client.query(
      `UPDATE users SET name='Conta excluída',
         email='deleted-' || id || '-' || floor(extract(epoch from now())) || '@anonymized.invalid',
         password_hash=$2, consent_lgpd_at=NULL, consent_version=NULL
       WHERE id=$1`,
      [uid, await hashPassword(crypto.randomBytes(24).toString('hex'))]
    );
    await client.query('COMMIT');
    audit('users', uid, 'delete-account', null, { anonymized: true }, null);
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// ---------- M30 consultório veterinário ----------

const vetJson = v => ({
  id: v.id, userId: v.user_id, name: v.name, crmv: v.crmv,
  specialty: v.specialty, phone: v.phone, active: v.active, createdAt: v.created_at
});

//JOIN pet+tutor+vet para resposta rica da consulta
const CONSULT_SELECT = `
  SELECT c.*, p.name AS pet_name, p.type AS pet_type, p.breed AS pet_breed,
         cu.name AS customer_name, cu.id AS customer_id,
         v.name AS vet_name, v.crmv AS vet_crmv, v.specialty AS vet_specialty,
         rx.id AS prescription_id
  FROM consultations c
  JOIN pets p ON p.id = c.pet_id
  JOIN customers cu ON cu.id = p.customer_id
  LEFT JOIN vets v ON v.id = c.vet_id
  LEFT JOIN prescriptions rx ON rx.consultation_id = c.id`;

const consultJson = r => ({
  id: r.id, petId: r.pet_id, petName: r.pet_name, petType: r.pet_type, petBreed: r.pet_breed,
  customerId: r.customer_id, customerName: r.customer_name,
  vetId: r.vet_id, vetName: r.vet_name, vetCrmv: r.vet_crmv, vetSpecialty: r.vet_specialty,
  scheduledDate: r.scheduled_date instanceof Date ? r.scheduled_date.toISOString().split('T')[0] : r.scheduled_date,
  scheduledTime: r.scheduled_time, status: r.status, reason: r.reason,
  weight: r.weight == null ? null : Math.round(Number(r.weight) * 100) / 100,
  temperature: r.temperature == null ? null : Math.round(Number(r.temperature) * 10) / 10,
  diagnosis: r.diagnosis, notes: r.notes,
  createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  prescriptionId: r.prescription_id || null
});

// customer só enxerga consultas dos próprios pets
async function ownsConsultation(req, id) {
  if (isStaff(req.user)) return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM consultations c JOIN pets p ON p.id = c.pet_id
     JOIN customers cu ON cu.id = p.customer_id
     WHERE c.id=$1 AND cu.user_id=$2`,
    [id, req.user.id]
  );
  return rows.length > 0;
}

// ---------- veterinários ----------

app.get('/api/vets', requireAuth, requireStaff, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM vets ORDER BY active DESC, name');
  res.json(rows.map(vetJson));
});

app.post('/api/vets', requireAuth, requireStaff, async (req, res) => {
  const { userId, name, crmv, specialty, phone, active } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
  const { rows } = await pool.query(
    'INSERT INTO vets (user_id, name, crmv, specialty, phone, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [userId || null, String(name).trim(), crmv || '', specialty || '', phone || '', active !== false]
  );
  audit('vets', rows[0].id, 'create', null, vetJson(rows[0]), req.user.id);
  res.status(201).json(vetJson(rows[0]));
});

app.put('/api/vets/:id', requireAuth, requireStaff, async (req, res) => {
  const { userId, name, crmv, specialty, phone, active } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
  const { rows } = await pool.query(
    'UPDATE vets SET user_id=$2, name=$3, crmv=$4, specialty=$5, phone=$6, active=$7 WHERE id=$1 RETURNING *',
    [req.params.id, userId || null, String(name).trim(), crmv || '', specialty || '', phone || '', active !== false]
  );
  if (!rows.length) return res.status(404).json({ error: 'Veterinário não encontrado' });
  audit('vets', rows[0].id, 'update', null, vetJson(rows[0]), req.user.id);
  res.json(vetJson(rows[0]));
});

app.delete('/api/vets/:id', requireAuth, requireAdmin, async (req, res) => {
  const { rows: old } = await pool.query('SELECT * FROM vets WHERE id=$1', [req.params.id]);
  if (!old.length) return res.status(404).json({ error: 'Veterinário não encontrado' });
  // consultas referenciam vet_id com ON DELETE SET NULL — histórico preservado
  await pool.query('DELETE FROM vets WHERE id=$1', [req.params.id]);
  audit('vets', old[0].id, 'delete', vetJson(old[0]), null, req.user.id);
  res.status(204).end();
});

// ---------- consultas ----------

app.get('/api/consultations', requireAuth, async (req, res) => {
  const { rows } = isStaff(req.user)
    ? await pool.query(`${CONSULT_SELECT} ORDER BY c.scheduled_date DESC, c.scheduled_time, c.id DESC`)
    : await pool.query(
        `${CONSULT_SELECT} WHERE cu.user_id=$1 ORDER BY c.scheduled_date DESC, c.scheduled_time, c.id DESC`,
        [req.user.id]
      );
  res.json(rows.map(consultJson));
});

app.get('/api/consultations/:id', requireAuth, async (req, res) => {
  if (!(await ownsConsultation(req, req.params.id))) {
    return res.status(403).json({ error: 'Consulta não encontrada ou sem permissão' });
  }
  const { rows } = await pool.query(`${CONSULT_SELECT} WHERE c.id=$1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Consulta não encontrada' });
  res.json(consultJson(rows[0]));
});

app.post('/api/consultations', requireAuth, requireStaff, async (req, res) => {
  const { petId, vetId, scheduledDate, scheduledTime, reason } = req.body;
  if (!Number.isInteger(Number(petId)) || !scheduledDate) {
    return res.status(400).json({ error: 'Pet e data são obrigatórios' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(scheduledDate)) || isNaN(new Date(scheduledDate).getTime())) {
    return res.status(400).json({ error: 'Data inválida (use AAAA-MM-DD)' });
  }
  if (vetId && !Number.isInteger(Number(vetId))) {
    return res.status(400).json({ error: 'Veterinário inválido' });
  }
  const { rows: pet } = await pool.query('SELECT id FROM pets WHERE id=$1', [petId]);
  if (!pet.length) return res.status(400).json({ error: 'Pet não encontrado' });
  if (vetId) {
    const { rows: vet } = await pool.query('SELECT id FROM vets WHERE id=$1 AND active=true', [vetId]);
    if (!vet.length) return res.status(400).json({ error: 'Veterinário não encontrado ou inativo' });
  }
  const { rows } = await pool.query(
    `INSERT INTO consultations (pet_id, vet_id, scheduled_date, scheduled_time, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [petId, vetId || null, scheduledDate, scheduledTime || '', reason || '', req.user.id]
  );
  audit('consultations', rows[0].id, 'create', null, { petId, vetId, scheduledDate }, req.user.id);
  const { rows: full } = await pool.query(`${CONSULT_SELECT} WHERE c.id=$1`, [rows[0].id]);
  res.status(201).json(consultJson(full[0]));
});

app.patch('/api/consultations/:id', requireAuth, requireStaff, async (req, res) => {
  const { status, vetId, reason, weight, temperature, diagnosis, notes, scheduledDate, scheduledTime } = req.body;
  const validStatus = ['agendado', 'em_atendimento', 'concluido', 'cancelado'];
  if (status && !validStatus.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  if (weight !== undefined && weight !== null && weight !== '' && !Number.isFinite(Number(weight))) {
    return res.status(400).json({ error: 'Peso inválido' });
  }
  if (temperature !== undefined && temperature !== null && temperature !== '' && !Number.isFinite(Number(temperature))) {
    return res.status(400).json({ error: 'Temperatura inválida' });
  }
  if (scheduledDate && (!/^\d{4}-\d{2}-\d{2}$/.test(String(scheduledDate)) || isNaN(new Date(scheduledDate).getTime()))) {
    return res.status(400).json({ error: 'Data inválida (use AAAA-MM-DD)' });
  }
  if (vetId !== undefined && vetId !== null && vetId !== '' && !Number.isInteger(Number(vetId))) {
    return res.status(400).json({ error: 'Veterinário inválido' });
  }
  const { rows: old } = await pool.query('SELECT * FROM consultations WHERE id=$1', [req.params.id]);
  if (!old.length) return res.status(404).json({ error: 'Consulta não encontrada' });
  const o = old[0];
  const { rows } = await pool.query(
    `UPDATE consultations SET
       status=$2, vet_id=$3, reason=$4, weight=$5, temperature=$6,
       diagnosis=$7, notes=$8, scheduled_date=$9, scheduled_time=$10, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      req.params.id,
      status || o.status,
      vetId !== undefined ? (vetId || null) : o.vet_id,
      reason !== undefined ? reason : o.reason,
      weight !== undefined ? weight : o.weight,
      temperature !== undefined ? temperature : o.temperature,
      diagnosis !== undefined ? diagnosis : o.diagnosis,
      notes !== undefined ? notes : o.notes,
      scheduledDate || o.scheduled_date,
      scheduledTime !== undefined ? scheduledTime : o.scheduled_time
    ]
  );
  audit('consultations', rows[0].id, 'update',
    { status: o.status, diagnosis: o.diagnosis },
    { status: rows[0].status, diagnosis: rows[0].diagnosis }, req.user.id);
  const { rows: full } = await pool.query(`${CONSULT_SELECT} WHERE c.id=$1`, [rows[0].id]);
  res.json(consultJson(full[0]));
});

// ---------- receitas ----------

const PRESCRIPTION_SELECT = `
  SELECT pr.*, c.id AS consultation_id, v.name AS vet_name, v.crmv AS vet_crmv,
         p.name AS pet_name, cu.name AS customer_name
  FROM prescriptions pr
  JOIN consultations c ON c.id = pr.consultation_id
  JOIN pets p ON p.id = c.pet_id
  JOIN customers cu ON cu.id = p.customer_id
  LEFT JOIN vets v ON v.id = pr.vet_id`;

const prescriptionJson = async r => {
  const { rows: items } = await pool.query(
    'SELECT * FROM prescription_items WHERE prescription_id=$1 ORDER BY sort_order, id', [r.id]);
  return {
    id: r.id, consultationId: r.consultation_id,
    vetId: r.vet_id, vetName: r.vet_name, vetCrmv: r.vet_crmv,
    petName: r.pet_name, customerName: r.customer_name,
    issuedAt: r.issued_at, notes: r.notes,
    items: items.map(i => ({
      id: i.id, medication: i.medication, dosage: i.dosage,
      frequency: i.frequency, duration: i.duration, instructions: i.instructions
    }))
  };
};

app.post('/api/prescriptions', requireAuth, requireStaff, async (req, res) => {
  const { consultationId, vetId, notes, items } = req.body;
  if (!consultationId) return res.status(400).json({ error: 'Consulta é obrigatória' });
  const { rows: cons } = await pool.query('SELECT id, status, vet_id FROM consultations WHERE id=$1', [consultationId]);
  if (!cons.length) return res.status(404).json({ error: 'Consulta não encontrada' });
  const list = Array.isArray(items) ? items.filter(i => i.medication && String(i.medication).trim()) : [];
  if (!list.length) return res.status(400).json({ error: 'Receita precisa de ao menos um medicamento' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: pr } = await client.query(
      `INSERT INTO prescriptions (consultation_id, vet_id, notes) VALUES ($1,$2,$3)
       ON CONFLICT (consultation_id) DO UPDATE SET vet_id=$2, notes=$3, issued_at=now()
       RETURNING *`,
      [consultationId, vetId || cons[0].vet_id || null, notes || '']
    );
    // reemissão: limpa itens antigos e reinsere (upsert simples e idempotente)
    await client.query('DELETE FROM prescription_items WHERE prescription_id=$1', [pr[0].id]);
    for (let idx = 0; idx < list.length; idx++) {
      const i = list[idx];
      await client.query(
        `INSERT INTO prescription_items (prescription_id, medication, dosage, frequency, duration, instructions, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [pr[0].id, String(i.medication).trim(), i.dosage || '', i.frequency || '', i.duration || '', i.instructions || '', idx]
      );
    }
    await client.query('COMMIT');
    audit('prescriptions', pr[0].id, 'save', null, { consultationId, items: list.length }, req.user.id);
    const { rows: full } = await pool.query(`${PRESCRIPTION_SELECT} WHERE pr.id=$1`, [pr[0].id]);
    res.status(201).json(await prescriptionJson(full[0]));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

app.get('/api/prescriptions/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(`${PRESCRIPTION_SELECT} WHERE pr.id=$1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Receita não encontrada' });
  const r = rows[0];
  if (!isStaff(req.user)) {
    const { rows: own } = await pool.query(
      `SELECT 1 FROM consultations c JOIN pets p ON p.id=c.pet_id
       JOIN customers cu ON cu.id=p.customer_id WHERE c.id=$1 AND cu.user_id=$2`,
      [r.consultation_id, req.user.id]);
    if (!own.length) return res.status(403).json({ error: 'Receita sem permissão' });
  }
  res.json(await prescriptionJson(r));
});

// PDF da receita: texto puro via pdfkit (sem HTML externo — seguro contra injeção)
app.get('/api/prescriptions/:id/pdf', requireAuth, async (req, res) => {
  const PDFDocument = require('pdfkit');
  const { rows } = await pool.query(`${PRESCRIPTION_SELECT} WHERE pr.id=$1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Receita não encontrada' });
  const r = rows[0];
  if (!isStaff(req.user)) {
    const { rows: own } = await pool.query(
      `SELECT 1 FROM consultations c JOIN pets p ON p.id=c.pet_id
       JOIN customers cu ON cu.id=p.customer_id WHERE c.id=$1 AND cu.user_id=$2`,
      [r.consultation_id, req.user.id]);
    if (!own.length) return res.status(403).json({ error: 'Receita sem permissão' });
  }
  const rx = await prescriptionJson(r);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="receita-${rx.id}.pdf"`);
  doc.pipe(res);
  doc.fontSize(20).fillColor('#2a9d8f').text('Animal World', { align: 'center' });
  doc.fontSize(14).fillColor('#333').text('Receituário Veterinário', { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).fillColor('#555')
    .text(`Paciente: ${rx.petName}`)
    .text(`Tutor: ${rx.customerName}`)
    .text(`Veterinário: ${rx.vetName || '—'}${rx.vetCrmv ? ` — CRMV ${rx.vetCrmv}` : ''}`)
    .text(`Emitida em: ${new Date(rx.issuedAt).toLocaleString('pt-BR')}`);
  doc.moveDown();
  doc.fontSize(12).fillColor('#333').text('Prescrição:', { underline: true });
  rx.items.forEach((i, idx) => {
    doc.moveDown(0.5).fontSize(11);
    doc.text(`${idx + 1}. ${i.medication}`);
    const parts = [i.dosage && `Dose: ${i.dosage}`, i.frequency && `Frequência: ${i.frequency}`,
      i.duration && `Duração: ${i.duration}`, i.instructions && `Instruções: ${i.instructions}`]
      .filter(Boolean).join('  |  ');
    if (parts) doc.fillColor('#555').text(`   ${parts}`);
    doc.fillColor('#333');
  });
  if (rx.notes) doc.moveDown().fontSize(10).fillColor('#555').text(`Observações: ${rx.notes}`);
  doc.moveDown(2).fontSize(10).fillColor('#888').text('Documento gerado pelo sistema Animal World.', { align: 'center' });
  doc.end();
});

// ---------- WhatsApp / Evolution API proxy ----------

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'syspet-evolution-key-2026';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'syspet-oficial';

async function evolutionFetch(endpoint, options = {}) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  const headers = {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

// 1. Status da conexão
app.get('/api/whatsapp/status', async (req, res) => {
  try {
    const { status, data } = await evolutionFetch(`/instance/connectionState/${EVOLUTION_INSTANCE}`);
    if (status >= 200 && status < 300) {
      const state = data?.instance?.state || 'close';
      return res.json({ connected: state === 'open', state, instance: EVOLUTION_INSTANCE });
    }
    // Se a instância ainda não existe, tenta criar
    if (status === 404) {
      await evolutionFetch('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName: EVOLUTION_INSTANCE,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });
      return res.json({ connected: false, state: 'connecting', instance: EVOLUTION_INSTANCE });
    }
    return res.json({ connected: false, state: 'close', instance: EVOLUTION_INSTANCE });
  } catch (err) {
    return res.json({ connected: false, state: 'offline', error: err.message, instance: EVOLUTION_INSTANCE });
  }
});

// 2. Obter QR Code
app.get('/api/whatsapp/qrcode', async (req, res) => {
  try {
    let { status, data } = await evolutionFetch(`/instance/connect/${EVOLUTION_INSTANCE}`);
    if (status === 404) {
      // Cria a instância caso ainda não exista
      await evolutionFetch('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName: EVOLUTION_INSTANCE,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });
      // Tenta conectar novamente
      const retry = await evolutionFetch(`/instance/connect/${EVOLUTION_INSTANCE}`);
      status = retry.status;
      data = retry.data;
    }

    if (data && (data.base64 || data.code)) {
      return res.json({
        pairingCode: data.pairingCode || null,
        code: data.code || null,
        base64: data.base64 || null,
        count: data.count || 1,
        instance: EVOLUTION_INSTANCE
      });
    }

    return res.status(status || 500).json(data || { error: 'Não foi possível gerar QR Code' });
  } catch (err) {
    return res.status(503).json({ error: 'Evolution API indisponível', details: err.message });
  }
});

// 3. Desconectar / Logout
app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    const { status, data } = await evolutionFetch(`/instance/logout/${EVOLUTION_INSTANCE}`, {
      method: 'DELETE'
    });
    return res.json({ success: status < 400, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Envio de mensagem
app.post('/api/whatsapp/send', async (req, res) => {
  const { number, text } = req.body || {};
  if (!number || !text) {
    return res.status(400).json({ error: 'Número e texto são obrigatórios' });
  }
  const cleanNumber = String(number).replace(/\D/g, '');
  try {
    const { status, data } = await evolutionFetch(`/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({
        number: cleanNumber,
        text: String(text).trim()
      })
    });
    if (status >= 200 && status < 300) {
      return res.json({ success: true, data });
    }
    return res.status(status).json({ success: false, error: data });
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }
});

// ---------- health & static ----------

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

const candidateDirs = [
  process.env.DOCS_DIR,
  path.join(__dirname, '..', 'docs'),
  '/docs',
  path.join(__dirname, 'docs')
].filter(Boolean);
const docsDir = candidateDirs.find(d => fs.existsSync(d)) || path.join(__dirname, '..', 'docs');
app.use(express.static(docsDir));

// Fallback SPA para carregar o frontend em qualquer rota
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(docsDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

app.listen(PORT, () => {
  console.log(`Animal World API em http://localhost:${PORT}`);
  console.log(`Session secret: ${process.env.SESSION_SECRET ? 'SESSION_SECRET (env)' : 'server/.session-secret (arquivo local)'}`);
});

// Limpeza diária de sessões e tokens de reset expirados/revogados
setInterval(() => {
  pool.query(`DELETE FROM sessions WHERE expires_at < now() - interval '7 days'`)
    .then(() => pool.query(`DELETE FROM sessions WHERE revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days'`))
    .then(() => pool.query(`DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '1 day'`))
    .catch(() => {});
}, 24 * 60 * 60 * 1000).unref();

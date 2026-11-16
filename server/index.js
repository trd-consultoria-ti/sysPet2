const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3100;

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
const hashPassword = pw => bcrypt.hashSync(String(pw), BCRYPT_ROUNDS);
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
  customerId: p.customer_id,
  image: p.image_path ? `/uploads/${p.image_path}` : (p.image || '')
});

async function getCustomersWithPets(userId = null) {
  const { rows: customers } = userId
    ? await pool.query('SELECT * FROM customers WHERE user_id=$1 ORDER BY id', [userId])
    : await pool.query('SELECT * FROM customers ORDER BY id');
  const { rows: pets } = await pool.query('SELECT * FROM pets ORDER BY id');
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
    await pool.query('UPDATE users SET password_hash=$2 WHERE id=$1', [u.id, hashPassword(password)]);
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
    // TODO(M6): entregar por e-mail quando houver SMTP; por ora o link sai no log da API (dev)
    console.log(`[password-reset] ${email}: /#/reset-password?token=${token}`);
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
    await client.query('UPDATE users SET password_hash=$2 WHERE id=$1', [rows[0].user_id, hashPassword(newPassword)]);
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
  const pwErr = passwordError(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  const hash = hashPassword(password);
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
    // Vincula a um cadastro de cliente existente com o mesmo email, ou cria um novo
    const { rows: custRows } = await client.query(
      'UPDATE customers SET user_id=$1 WHERE email=$2 RETURNING id',
      [user.id, email]
    );
    if (!custRows.length) {
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
  const hash = hashPassword(password);
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
  await pool.query('UPDATE users SET password_hash=$2 WHERE id=$1', [req.params.id, hashPassword(newPassword)]);
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
  const { customerId, name, type, breed, age, image } = req.body;
  if (!isStaff(req.user)) {
    const { rows: own } = await pool.query('SELECT id FROM customers WHERE id=$1 AND user_id=$2', [customerId, req.user.id]);
    if (!own.length) return res.status(403).json({ error: 'Cliente não pode cadastrar pet para outro cliente' });
  }
  const { rows } = await pool.query(
    'INSERT INTO pets (customer_id, name, type, breed, age, image_path) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [customerId, name, type, breed || null, age || null, imagePathOf(image)]
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
  const { name, type, breed, age, image } = req.body;
  const { rows } = await pool.query(
    'UPDATE pets SET name=$2, type=$3, breed=$4, age=$5, image_path=$6 WHERE id=$1 RETURNING *',
    [req.params.id, name, type, breed || null, age || null, imagePathOf(image)]
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
  const { rows } = isStaff(req.user)
    ? await pool.query('SELECT * FROM appointments ORDER BY date, time, id')
    : await pool.query(
        `SELECT * FROM appointments
         WHERE customer_id IN (SELECT id FROM customers WHERE user_id=$1)
         ORDER BY date, time, id`,
        [req.user.id]
      );
  res.json(rows.map(a => ({
    ...a,
    customerId: a.customer_id,
    serviceId: a.service_id,
    date: a.date instanceof Date ? a.date.toISOString().split('T')[0] : a.date,
    createdAt: a.created_at
  })));
});

app.post('/api/appointments', requireAuth, async (req, res) => {
  let { customerId, customerName, petName, serviceId, serviceName, date, time, notes } = req.body;
  if (!isStaff(req.user)) {
    const { rows: cust } = await pool.query('SELECT id, name FROM customers WHERE user_id=$1', [req.user.id]);
    if (!cust.length) return res.status(400).json({ error: 'Perfil de cliente não encontrado' });
    customerId = cust[0].id;
    customerName = cust[0].name;
    const { rows: pet } = await pool.query('SELECT id FROM pets WHERE customer_id=$1 AND name=$2', [customerId, petName]);
    if (!pet.length) return res.status(400).json({ error: 'Pet não encontrado no seu cadastro' });
  }
  const { rows } = await pool.query(
    `INSERT INTO appointments (customer_id, customer_name, pet_name, service_id, service_name, date, time, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [customerId || null, customerName || null, petName, serviceId || null, serviceName || null, date, time, notes || null]
  );
  const a = rows[0];
  res.status(201).json({
    id: a.id, customerId: a.customer_id, customerName: a.customer_name,
    petName: a.pet_name, serviceId: a.service_id, serviceName: a.service_name,
    date: a.date instanceof Date ? a.date.toISOString().split('T')[0] : a.date,
    time: a.time, notes: a.notes, status: a.status, createdAt: a.created_at
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

  // Preço e nome vêm do banco — nunca do body do cliente
  const ids = requested.map(i => Number(i && i.id)).filter(Number.isInteger);
  const { rows: prods } = await pool.query('SELECT id, name, price, stock FROM products WHERE id = ANY($1)', [ids]);
  const byId = new Map(prods.map(p => [p.id, p]));
  const serverItems = [];
  for (const i of requested) {
    const p = byId.get(Number(i && i.id));
    const qty = Math.floor(Number(i && i.quantity));
    if (!p || !qty || qty < 1 || qty > 999) {
      return res.status(400).json({ error: `Item inválido: ${(i && i.name) || (i && i.id)}` });
    }
    if (p.stock !== null && p.stock !== undefined && qty > Number(p.stock)) {
      return res.status(400).json({ error: `Estoque insuficiente: ${p.name} (disponível: ${p.stock})` });
    }
    serverItems.push({ id: p.id, name: p.name, price: num(p.price), quantity: qty });
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
    await client.query(
      `INSERT INTO cash_movements (order_id, type, description, amount, payment_method)
       VALUES ($1, 'entrada', $2, $3, $4)`,
      [rows[0].id, `Pedido ${seq[0].order_number}`, total, paymentMethod || null]
    );
    // Baixa de estoque atômica: só decrementa onde há saldo suficiente (NULL = sem controle)
    for (const item of serverItems) {
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
app.use('/uploads', express.static(UPLOAD_DIR));

const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
app.post('/api/upload', requireAuth, async (req, res) => {
  const { filename, data } = req.body || {};
  const m = /^data:(image\/[a-z]+);base64,(.+)$/is.exec(String(data || ''));
  if (!m || !MIME_EXT[m[1].toLowerCase()]) {
    return res.status(400).json({ error: 'Envie uma imagem (PNG, JPG, WebP ou GIF) em base64' });
  }
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Imagem vazia ou maior que 5MB' });
  }
  const base = String(filename || 'foto').replace(/\.[^.]*$/, '').replace(/[^\w\-]/g, '').slice(-40) || 'foto';
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}.${MIME_EXT[m[1].toLowerCase()]}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
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
  const { rows } = await pool.query(
    `UPDATE coupons SET code=$2, discount_type=$3, discount_value=$4, min_order_total=$5,
       active=$6, max_uses=$7, expires_at=$8 WHERE id=$1 RETURNING *`,
    [req.params.id, cleanCode, type, val,
     minOrderTotal !== undefined ? Math.max(0, Number(minOrderTotal) || 0) : Number(old[0].min_order_total),
     active !== undefined ? !!active : old[0].active,
     maxUses !== undefined ? (maxUses ? Math.floor(Number(maxUses)) : null) : old[0].max_uses,
     expiresAt !== undefined ? (expiresAt || null) : old[0].expires_at]
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

// Preview do desconto no checkout — mesmo cálculo do POST /orders, sem consumir uso
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
  if (!c) return res.status(404).json({ error: 'Cupom inválido ou expirado' });
  if (sub < Number(c.min_order_total)) {
    return res.status(400).json({ error: `Pedido mínimo de R$ ${Number(c.min_order_total).toFixed(2)}` });
  }
  const discount = Math.min(
    c.discount_type === 'percent' ? sub * Number(c.discount_value) / 100 : Number(c.discount_value),
    sub
  );
  res.json({ code: c.code, discount: Math.round(discount * 100) / 100, finalTotal: Math.round((sub - discount) * 100) / 100 });
});

// ---------- auditoria (M23) ----------

app.get('/api/audit', requireAuth, requireStaff, async (req, res) => {
  const { entity, entityId } = req.query;
  const params = [];
  let where = '';
  if (entity) { params.push(String(entity).slice(0, 60)); where += ` AND a.entity = $${params.length}`; }
  if (entityId) { params.push(Number(entityId)); where += ` AND a.entity_id = $${params.length}`; }
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
  const [user, customers, pets, orders, appointments] = await Promise.all([
    pool.query('SELECT id, name, email, role, consent_lgpd_at, consent_version FROM users WHERE id=$1', [uid]),
    pool.query('SELECT * FROM customers WHERE user_id=$1', [uid]),
    pool.query(
      `SELECT p.* FROM pets p JOIN customers c ON c.id = p.customer_id WHERE c.user_id=$1`, [uid]),
    pool.query('SELECT * FROM orders WHERE user_id=$1', [uid]),
    pool.query(
      `SELECT a.* FROM appointments a JOIN customers c ON c.id = a.customer_id WHERE c.user_id=$1`, [uid])
  ]);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="meus-dados-animal-world.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    user: user.rows[0] || null,
    customers: customers.rows,
    pets: pets.rows,
    orders: orders.rows,
    appointments: appointments.rows
  });
});

// Exclusão = anonimização (pedido de titular LGPD): PII some, histórico financeiro é preservado sem identificação
app.delete('/api/me', requireAuth, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Apenas clientes podem excluir a própria conta por aqui' });
  }
  const uid = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: custs } = await client.query('SELECT id FROM customers WHERE user_id=$1', [uid]);
    const custIds = custs.map(c => c.id);
    if (custIds.length) {
      await client.query(
        `UPDATE appointments SET customer_name='Excluído', pet_name='Pet'
         WHERE customer_id = ANY($1)`, [custIds]);
      await client.query('DELETE FROM pets WHERE customer_id = ANY($1)', [custIds]);
      await client.query('DELETE FROM customers WHERE user_id=$1', [uid]);
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
      [uid, hashPassword(crypto.randomBytes(24).toString('hex'))]
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

// ---------- health & static ----------

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

const docsDir = path.join(__dirname, '..', 'docs');
app.use(express.static(docsDir));

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

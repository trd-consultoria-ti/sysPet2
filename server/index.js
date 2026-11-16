const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3100;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DB_USER || 'animalworld',
  password: process.env.DB_PASSWORD || 'animalworld',
  database: process.env.DB_NAME || 'animalworld'
});

app.use(cors());
app.use(express.json());

const num = v => (v === null || v === undefined ? null : Number(v));

// ---------- helpers ----------

async function getCustomersWithPets(userId = null) {
  const { rows: customers } = userId
    ? await pool.query('SELECT * FROM customers WHERE user_id=$1 ORDER BY id', [userId])
    : await pool.query('SELECT * FROM customers ORDER BY id');
  const { rows: pets } = await pool.query('SELECT * FROM pets ORDER BY id');
  return customers.map(c => ({
    ...c,
    userId: c.user_id,
    pets: pets.filter(p => p.customer_id === c.id).map(p => ({
      id: p.id, name: p.name, type: p.type, breed: p.breed, age: p.age, customerId: p.customer_id
    }))
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

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    uid: user.id, exp: Date.now() + TOKEN_TTL
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

// Carrega o usuário fresco do banco a cada request (role/permissão nunca ficam velhas no token)
async function loadUser(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Não autenticado' });
  const { rows } = await pool.query(
    'SELECT id, name, email, role, can_manage_products FROM users WHERE id=$1', [data.uid]
  );
  if (!rows.length) return res.status(401).json({ error: 'Usuário não encontrado' });
  req.user = rows[0];
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

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });
  const hash = crypto.createHash('sha256').update(String(password)).digest('hex');
  const { rows } = await pool.query(
    'SELECT id, name, email, role, can_manage_products FROM users WHERE email = $1 AND password_hash = $2',
    [email, hash]
  );
  if (!rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });
  const u = rows[0];
  res.json({
    id: u.id, name: u.name, email: u.email, role: u.role,
    canManageProducts: u.can_manage_products, token: signToken(u)
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
  }
  const hash = crypto.createHash('sha256').update(String(password)).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    const { rows: userRows } = await client.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, can_manage_products',
      [name, email, hash, 'customer']
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
    await client.query('COMMIT');
    res.status(201).json({
      ...user,
      canManageProducts: user.can_manage_products,
      token: signToken(user)
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
  const validRoles = ['admin', 'collaborator', 'customer'];
  const userRole = validRoles.includes(role) ? role : 'collaborator';
  const hash = crypto.createHash('sha256').update(String(password)).digest('hex');
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
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Nova senha deve ter ao menos 6 caracteres' });
  }
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
  // Admin redefine senha sem conhecer a atual; usuário comum precisa provar a senha atual
  if (!isAdmin) {
    const currentHash = crypto.createHash('sha256').update(String(currentPassword || '')).digest('hex');
    if (rows[0].password_hash !== currentHash) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
  }
  const newHash = crypto.createHash('sha256').update(String(newPassword)).digest('hex');
  await pool.query('UPDATE users SET password_hash=$2 WHERE id=$1', [req.params.id, newHash]);
  res.json({ ok: true });
});

// ---------- products ----------

app.get('/api/products', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
  res.json(rows.map(p => ({ ...p, price: num(p.price), rating: num(p.rating) })));
});

app.put('/api/products/:id', requireAuth, requireProductManager, async (req, res) => {
  const { name, price, rating, reviews, image, category, description } = req.body;
  const { rows } = await pool.query(
    `UPDATE products SET name=$2, price=$3, rating=$4, reviews=$5, image=$6, category=$7, description=$8
     WHERE id=$1 RETURNING *`,
    [req.params.id, name, price, rating, reviews, image, category, description]
  );
  if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json({ ...rows[0], price: num(rows[0].price), rating: num(rows[0].rating) });
});

app.post('/api/products', requireAuth, requireProductManager, async (req, res) => {
  const { name, price, rating, reviews, image, category, description } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
  const { rows } = await pool.query(
    `INSERT INTO products (name, price, rating, reviews, image, category, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, price, rating || 0, reviews || 0, image || '', category || '', description || '']
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
    `INSERT INTO catalog_services (name, price, rating, reviews, image, category, duration, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, price, rating || 0, reviews || 0, image || '', category || '', duration || '', description || '']
  );
  res.status(201).json({ ...rows[0], price: num(rows[0].price), rating: num(rows[0].rating) });
});

app.put('/api/services/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, price, rating, reviews, image, category, duration, description } = req.body;
  const { rows } = await pool.query(
    `UPDATE catalog_services SET name=$2, price=$3, rating=$4, reviews=$5, image=$6, category=$7, duration=$8, description=$9
     WHERE id=$1 RETURNING *`,
    [req.params.id, name, price, rating, reviews, image, category, duration, description]
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
  const { customerId, name, type, breed, age } = req.body;
  if (!isStaff(req.user)) {
    const { rows: own } = await pool.query('SELECT id FROM customers WHERE id=$1 AND user_id=$2', [customerId, req.user.id]);
    if (!own.length) return res.status(403).json({ error: 'Cliente não pode cadastrar pet para outro cliente' });
  }
  const { rows } = await pool.query(
    'INSERT INTO pets (customer_id, name, type, breed, age) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [customerId, name, type, breed || null, age || null]
  );
  res.status(201).json({
    id: rows[0].id, name: rows[0].name, type: rows[0].type,
    breed: rows[0].breed, age: rows[0].age, customerId: rows[0].customer_id
  });
});

app.put('/api/pets/:id', requireAuth, requireStaff, async (req, res) => {
  const { name, type, breed, age } = req.body;
  const { rows } = await pool.query(
    'UPDATE pets SET name=$2, type=$3, breed=$4, age=$5 WHERE id=$1 RETURNING *',
    [req.params.id, name, type, breed || null, age || null]
  );
  if (!rows.length) return res.status(404).json({ error: 'Pet não encontrado' });
  res.json(rows[0]);
});

app.delete('/api/pets/:id', requireAuth, requireStaff, async (req, res) => {
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
  const { rows } = await pool.query(
    'UPDATE appointments SET status=$2 WHERE id=$1 RETURNING *',
    [req.params.id, status]
  );
  if (!rows.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
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
    items: o.items, total: num(o.total), status: o.status, createdAt: o.created_at
  })));
});

app.post('/api/orders', requireAuth, async (req, res) => {
  const { customerName, email, phone, address, items, paymentMethod } = req.body;
  const requested = Array.isArray(items) ? items : [];
  if (!requested.length) return res.status(400).json({ error: 'Carrinho vazio' });

  // Preço e nome vêm do banco — nunca do body do cliente
  const ids = requested.map(i => Number(i && i.id)).filter(Number.isInteger);
  const { rows: prods } = await pool.query('SELECT id, name, price FROM products WHERE id = ANY($1)', [ids]);
  const byId = new Map(prods.map(p => [p.id, p]));
  const serverItems = [];
  for (const i of requested) {
    const p = byId.get(Number(i && i.id));
    const qty = Math.floor(Number(i && i.quantity));
    if (!p || !qty || qty < 1 || qty > 999) {
      return res.status(400).json({ error: `Item inválido: ${(i && i.name) || (i && i.id)}` });
    }
    serverItems.push({ id: p.id, name: p.name, price: num(p.price), quantity: qty });
  }
  const total = serverItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0);

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
    const { rows } = await client.query(
      `INSERT INTO orders (order_number, user_id, customer_name, email, phone, address, payment_method, items, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [seq[0].order_number, userId, ownerName, email || null, phone || null, address || null,
       paymentMethod || null, JSON.stringify(serverItems), total]
    );
    await client.query(
      `INSERT INTO cash_movements (order_id, type, description, amount, payment_method)
       VALUES ($1, 'entrada', $2, $3, $4)`,
      [rows[0].id, `Pedido ${seq[0].order_number}`, total, paymentMethod || null]
    );
    await client.query('COMMIT');
    const o = rows[0];
    res.status(201).json({
      id: o.id, orderNumber: o.order_number, userId: o.user_id, customerName: o.customer_name,
      email: o.email, phone: o.phone, address: o.address, paymentMethod: o.payment_method,
      items: o.items, total: num(o.total), status: o.status, createdAt: o.created_at
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
  const { rows } = await pool.query(
    'UPDATE orders SET status=$2 WHERE id=$1 RETURNING *',
    [req.params.id, status]
  );
  if (!rows.length) return res.status(404).json({ error: 'Pedido não encontrado' });
  const o = rows[0];
  res.json({
    id: o.id, orderNumber: o.order_number, userId: o.user_id, customerName: o.customer_name,
    email: o.email, phone: o.phone, address: o.address, paymentMethod: o.payment_method,
    items: o.items, total: num(o.total), status: o.status, createdAt: o.created_at
  });
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
});

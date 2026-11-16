-- Animal World — schema Postgres (MVP)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'collaborator', 'customer')),
  -- permissão concedida pelo admin para o funcionário gerenciar estoque
  can_manage_products BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  rating NUMERIC(3,1) NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0,
  image TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS catalog_services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  rating NUMERIC(3,1) NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0,
  image TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pets (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  breed TEXT,
  age INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pets_customer ON pets(customer_id);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  pet_name TEXT NOT NULL,
  service_id INTEGER REFERENCES catalog_services(id) ON DELETE SET NULL,
  service_name TEXT,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'solicitado'
    CHECK (status IN ('solicitado', 'confirmado', 'concluido', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  payment_method TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'pago', 'cancelado', 'entregue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ SEED ============

INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin Animal World', 'admin@animalworld.com', '$2b$10$ZVsN2xSC817qcewi104eb.IiuVpWK.vnV11xWLiWgEcuU8K3CaQuu', 'admin')
ON CONFLICT (email) DO NOTHING;
-- senha do usuário seed: "animal123" (bcrypt)
-- hashes sha256 legados são migrados para bcrypt automaticamente no próximo login
-- funcionários e clientes são cadastrados em runtime pelo admin (/dashboard/users) ou pelo auto-cadastro (/login)

INSERT INTO products (id, name, price, rating, reviews, image, category, description) VALUES
  (1, 'Ração Premium para Cães', 89.90, 4.8, 124, 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&q=80', 'Alimentos', 'Ração premium para cães adultos de todas as raças. Rica em nutrientes essenciais.'),
  (2, 'Brinquedo Interativo para Gatos', 49.90, 4.6, 87, 'https://images.unsplash.com/photo-1545249390-6bdfa286032f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1374&q=80', 'Brinquedos', 'Brinquedo interativo que estimula o instinto de caça dos felinos.'),
  (3, 'Coleira Ajustável com GPS', 129.90, 4.9, 56, 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1364&q=80', 'Acessórios', 'Coleira ajustável com GPS integrado para monitorar a localização do seu pet.'),
  (4, 'Shampoo Hipoalergênico', 39.90, 4.7, 92, 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1498&q=80', 'Higiene', 'Shampoo hipoalergênico para pets com pele sensível. Fórmula suave e sem parabenos.'),
  (5, 'Casaco de Inverno para Cães', 79.90, 4.5, 45, 'https://images.unsplash.com/photo-1583337426008-2fef51aa872e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1364&q=80', 'Roupas', 'Casaco térmico para cães, ideal para dias frios. Material impermeável e confortável.'),
  (6, 'Cama Ortopédica para Pets', 159.90, 4.8, 78, 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1460&q=80', 'Camas', 'Cama ortopédica que proporciona suporte adequado para pets de todas as idades.'),
  (7, 'Suplemento Vitamínico', 69.90, 4.6, 63, 'https://images.unsplash.com/photo-1606585302006-b880b4f3b5b3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80', 'Medicamentos', 'Suplemento vitamínico para fortalecer o sistema imunológico do seu pet.'),
  (8, 'Escova Removedora de Pelos', 45.90, 4.4, 52, 'https://images.unsplash.com/photo-1560743641-3914f2c45636?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1587&q=80', 'Acessórios', 'Escova eficiente para remover pelos soltos e reduzir a queda de pelos em casa.')
ON CONFLICT (id) DO NOTHING;
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

INSERT INTO catalog_services (id, name, price, rating, reviews, image, category, duration, description) VALUES
  (1, 'Banho Completo', 79.90, 4.9, 154, 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&q=80', 'Banho e Tosa', '1 hora', 'Banho completo com shampoo especial, secagem, escovação e perfume.'),
  (2, 'Tosa Higiênica', 59.90, 4.7, 98, 'https://images.unsplash.com/photo-1541364983171-a8ba01e95cfc?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1587&q=80', 'Banho e Tosa', '45 min', 'Tosa das regiões íntimas, patas e face do animal para maior higiene e conforto.'),
  (3, 'Consulta Veterinária', 129.90, 4.8, 112, 'https://images.unsplash.com/photo-1603123853880-a92fafb7809f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1587&q=80', 'Veterinário', '30 min', 'Consulta com veterinário para avaliar a saúde geral do seu pet.'),
  (4, 'Taxi Dog', 49.90, 4.6, 89, 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1586&q=80', 'Taxi Dog', 'Variável', 'Transporte seguro e confortável para seu pet para qualquer lugar da cidade.'),
  (5, 'Hospedagem Pet', 89.90, 4.9, 76, 'https://images.unsplash.com/photo-1596854273338-cbf078ec7071?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1480&q=80', 'Hospedagem', 'Diária', 'Acomodação confortável para seu pet com monitoramento 24 horas.'),
  (6, 'Adestramento Básico', 149.90, 4.7, 62, 'https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80', 'Adestramento', '1 hora', 'Sessão de adestramento para ensinar comandos básicos de obediência.'),
  (7, 'Spa Pet', 119.90, 4.8, 45, 'https://images.unsplash.com/photo-1596206186161-0f0bb130a55c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80', 'Spa', '2 horas', 'Tratamento completo de relaxamento com massagem, aromaterapia e hidratação.'),
  (8, 'Creche Diária', 69.90, 4.6, 58, 'https://images.unsplash.com/photo-1599839619722-39751411ea63?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1523&q=80', 'Creche', 'Diária', 'Um dia inteiro de diversão e socialização para seu pet enquanto você trabalha.')
ON CONFLICT (id) DO NOTHING;
SELECT setval('catalog_services_id_seq', (SELECT MAX(id) FROM catalog_services));

INSERT INTO customers (id, name, email, phone, status) VALUES
  (1, 'Maria Silva', 'maria.silva@example.com', '+55 11 98765-4321', 'active'),
  (2, 'João Santos', 'joao.santos@example.com', '+55 11 91234-5678', 'active'),
  (3, 'Ana Oliveira', 'ana.oliveira@example.com', '+55 11 99876-5432', 'active'),
  (4, 'Carlos Mendes', 'carlos.mendes@example.com', '+55 11 97654-3210', 'inactive'),
  (5, 'Lucia Ferreira', 'lucia.ferreira@example.com', '+55 11 95432-1098', 'active')
ON CONFLICT (id) DO NOTHING;
SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));

INSERT INTO pets (customer_id, name, type, breed, age) VALUES
  (1, 'Rex', 'Cachorro', 'Labrador', NULL),
  (1, 'Luna', 'Cachorro', 'Poodle', NULL),
  (2, 'Mia', 'Gato', 'Siamês', NULL),
  (3, 'Bob', 'Cachorro', 'Golden Retriever', NULL),
  (3, 'Nina', 'Gato', 'Persa', NULL),
  (3, 'Toby', 'Cachorro', 'Bulldog', NULL),
  (4, 'Thor', 'Cachorro', 'Rottweiler', NULL),
  (5, 'Mel', 'Cachorro', 'Shih Tzu', NULL),
  (5, 'Simba', 'Gato', 'Maine Coon', NULL)
ON CONFLICT DO NOTHING;

-- Caixa: todo movimento financeiro fica registrado (sem integração bancária)
CREATE TABLE IF NOT EXISTS cash_movements (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('entrada', 'saida')),
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessões server-side: todo token carrega um sid; logout revoga e troca de senha derruba as demais
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Tokens de recuperação de senha (hash sha256 do token; expira em 1h, uso único)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);

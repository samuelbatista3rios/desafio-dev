-- Script de criação manual do banco de dados
-- Obs: em modo desenvolvimento, o TypeORM cria as tabelas automaticamente (synchronize: true)
-- Este script é fornecido como referência e para ambientes de produção.

CREATE DATABASE financas;
\c financas;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  description VARCHAR(255),
  "userId"    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TYPE transaction_type AS ENUM ('income', 'expense');

CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description  VARCHAR(255) NOT NULL,
  amount       NUMERIC(12, 2) NOT NULL,
  type         transaction_type NOT NULL,
  date         DATE NOT NULL,
  notes        VARCHAR(500),
  "userId"     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "categoryId" UUID REFERENCES categories(id) ON DELETE SET NULL,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user ON transactions("userId");
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_categories_user ON categories("userId");

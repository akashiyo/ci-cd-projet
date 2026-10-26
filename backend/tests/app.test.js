const request = require('supertest');
const app = require('../src/index');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bookdb'
});

beforeAll(async () => {
  await pool.query('CREATE TABLE IF NOT EXISTS books (id SERIAL PRIMARY KEY, title TEXT, author TEXT, description TEXT)');
  await pool.query('CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, book_id INTEGER REFERENCES books(id), text TEXT)');
});

afterAll(async () => {
  await pool.end();
});

describe('Book API', () => {
  it('should create a book', async () => {
    const res = await request(app)
      .post('/books')
      .send({ title: 'Test Book', author: 'Author', description: 'Desc' });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
  });

  it('should get books', async () => {
    const res = await request(app).get('/books');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

const request = require('supertest');
const app = require('../src/index');
const { Pool } = require('pg');

// Mock the pg Pool
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    end: jest.fn(),
    connect: jest.fn().mockReturnValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  };
  return { Pool: jest.fn(() => mPool) };
});

const pool = new Pool();

beforeAll(async () => {
  // The pool.query is now a mock, so this won't try to connect to a real DB
  await pool.query('CREATE TABLE IF NOT EXISTS books (id SERIAL PRIMARY KEY, title TEXT, author TEXT, description TEXT)');
  await pool.query('CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, book_id INTEGER REFERENCES books(id), text TEXT)');
});

afterAll(async () => {
  await pool.end();
});

describe('Book API', () => {
  it('should create a book', async () => {
    // Mock response for creating a book
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app)
      .post('/books')
      .send({ title: 'Test Book', author: 'Author', description: 'Desc' });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
  });

  it('should get books', async () => {
    // Mock response for getting books
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, title: 'Test Book', author: 'Author', description: 'Desc' }] });

    const res = await request(app).get('/books');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

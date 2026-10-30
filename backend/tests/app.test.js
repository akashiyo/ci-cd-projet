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

beforeEach(() => {
  pool.query.mockReset();
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

  it('should report a healthy database', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const res = await request(app).get('/api/health');

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('should report an unavailable database', async () => {
    pool.query.mockRejectedValueOnce(new Error('database unavailable'));

    const res = await request(app).get('/api/health');

    expect(res.statusCode).toEqual(503);
    expect(res.body).toEqual({ status: 'error', database: 'unavailable' });
  });

  it('should search books by title or author', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/books')
      .query({ search: 'tolkien', author: 'J.R.R. Tolkien' });

    expect(res.statusCode).toEqual(200);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM books WHERE (title ILIKE $1 OR author ILIKE $1) AND author = $2',
      ['%tolkien%', 'J.R.R. Tolkien']
    );
  });
});

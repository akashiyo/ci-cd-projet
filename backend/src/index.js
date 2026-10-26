const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@db:5432/bookdb"
});

// Database Initialization
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
      text TEXT NOT NULL
    );
  `);
};

initDb().catch(err => console.error("DB Init Error:", err));

// Routes
app.get("/books", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM books");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/books", async (req, res) => {
  const { title, author, description } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO books (title, author, description) VALUES ($1, $2, $3) RETURNING *",
      [title, author, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/books/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const bookResult = await pool.query("SELECT * FROM books WHERE id = $1", [id]);
    if (bookResult.rows.length === 0) return res.status(404).json({ error: "Book not found" });

    const commentsResult = await pool.query("SELECT * FROM comments WHERE book_id = $1", [id]);
    res.json({
      book: bookResult.rows[0],
      comments: commentsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/books/:id/comments", async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO comments (book_id, text) VALUES ($1, $2) RETURNING *",
      [id, text]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

module.exports = app; // Export for testing

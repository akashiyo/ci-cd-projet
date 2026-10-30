import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = window.__APP_CONFIG__?.apiUrl || process.env.REACT_APP_API_URL || "http://localhost:5000";

function App() {
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [error, setError] = useState("");
  const [newBook, setNewBook] = useState({ title: "", author: "", description: "" });
  const [selectedBook, setSelectedBook] = useState(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const res = await axios.get(`${API_URL}/books`);
      setBooks(res.data);
      setError("");
    } catch (e) {
      setError("Unable to load books.");
      console.error("Error fetching books", e);
    }
  };

  const authors = [...new Set(books.map(book => book.author))].sort();
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredBooks = books.filter(book => {
    const matchesSearch = !normalizedSearch ||
      book.title.toLowerCase().includes(normalizedSearch) ||
      book.author.toLowerCase().includes(normalizedSearch);
    const matchesAuthor = !authorFilter || book.author === authorFilter;
    return matchesSearch && matchesAuthor;
  });

  const addBook = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/books`, newBook);
      setNewBook({ title: "", author: "", description: "" });
      fetchBooks();
    } catch (e) {
      console.error("Error adding book", e);
    }
  };

  const viewBook = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/books/${id}`);
      setSelectedBook(res.data.book);
      setComments(res.data.comments);
    } catch (e) {
      console.error("Error viewing book", e);
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/books/${selectedBook.id}/comments`, { text: comment });
      setComment("");
      viewBook(selectedBook.id);
    } catch (e) {
      console.error("Error adding comment", e);
    }
  };

  if (selectedBook) {
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
        <button onClick={() => setSelectedBook(null)}>← Back to Catalog</button>
        <h1 style={{marginTop: "20px"}}>{selectedBook.title}</h1>
        <h3>{selectedBook.author}</h3>
        <p>{selectedBook.description}</p>
        <hr />
        <h4>Comments</h4>
        <ul>
          {comments.map((c, i) => <li key={i}>{c.text}</li>)}
        </ul>
        <form onSubmit={addComment}>
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..." required />
          <button type="submit">Send</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>📚 Book Catalog</h1>

      <section>
        <h2>Add a New Book</h2>
        <form onSubmit={addBook}>
          <label htmlFor="book-title">Title</label>
          <input id="book-title" placeholder="Title" value={newBook.title} onChange={e => setNewBook({...newBook, title: e.target.value})} required />
          <label htmlFor="book-author">Author</label>
          <input id="book-author" placeholder="Author" value={newBook.author} onChange={e => setNewBook({...newBook, author: e.target.value})} required />
          <label htmlFor="book-description">Description</label>
          <input id="book-description" placeholder="Description" value={newBook.description} onChange={e => setNewBook({...newBook, description: e.target.value})} />
          <button type="submit">Add Book</button>
        </form>
      </section>

      <hr />

      <section>
        <h2>Catalog</h2>
        <div>
          <label htmlFor="book-search">Search by title or author</label>
          <input
            id="book-search"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search books"
          />
          <label htmlFor="author-filter">Filter by author</label>
          <select id="author-filter" value={authorFilter} onChange={e => setAuthorFilter(e.target.value)}>
            <option value="">All authors</option>
            {authors.map(author => <option key={author} value={author}>{author}</option>)}
          </select>
        </div>
        {error && <p role="alert">{error}</p>}
        <div style={{ display: "grid", gap: "10px" }}>
          {filteredBooks.map(book => (
            <div key={book.id} style={{ border: "1px solid #ccc", padding: "10px", borderRadius: "5px", cursor: "pointer" }} onClick={() => viewBook(book.id)}>
              <strong>{book.title}</strong> - {book.author}
            </div>
          ))}
          {!error && filteredBooks.length === 0 && <p role="status">No books match your search.</p>}
        </div>
      </section>
    </div>
  );
}

export default App;

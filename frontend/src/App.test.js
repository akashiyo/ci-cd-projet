import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import App from './App';

jest.mock('axios');

const books = [
  { id: 1, title: 'The Hobbit', author: 'J.R.R. Tolkien', description: 'A fantasy novel' },
  { id: 2, title: 'Clean Code', author: 'Robert C. Martin', description: 'A software book' },
];

beforeEach(() => {
  axios.get.mockResolvedValue({ data: books });
});

test('renders book catalog title', () => {
  render(<App />);
  const linkElement = screen.getByText(/Book Catalog/i);
  expect(linkElement).toBeInTheDocument();
});

test('filters books by title or author', async () => {
  render(<App />);

  expect(await screen.findByText('The Hobbit')).toBeInTheDocument();
  expect(screen.getByText('Clean Code')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Search by title or author'), {
    target: { value: 'hobbit' },
  });

  expect(screen.getByText('The Hobbit')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText('Clean Code')).not.toBeInTheDocument());
});

test('filters books by author', async () => {
  render(<App />);

  await screen.findByText('The Hobbit');
  fireEvent.change(screen.getByLabelText('Filter by author'), {
    target: { value: 'Robert C. Martin' },
  });

  expect(screen.getByText('Clean Code')).toBeInTheDocument();
  expect(screen.queryByText('The Hobbit')).not.toBeInTheDocument();
});

test('opens a book and adds a comment', async () => {
  axios.get
    .mockResolvedValueOnce({ data: books })
    .mockResolvedValueOnce({ data: { book: books[0], comments: [] } })
    .mockResolvedValueOnce({ data: { book: books[0], comments: [{ text: 'Great book' }] } });
  axios.post.mockResolvedValueOnce({ data: { id: 1, text: 'Great book' } });

  render(<App />);
  await screen.findByText('The Hobbit');
  fireEvent.click(screen.getByRole('button', { name: /The Hobbit/ }));

  expect(await screen.findByText('Comments')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Add a comment...'), {
    target: { value: 'Great book' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/books/1/comments', { text: 'Great book' }));
  expect(await screen.findByText('Great book')).toBeInTheDocument();
});

test('adds a book and refreshes the catalog', async () => {
  axios.post.mockResolvedValueOnce({ data: { id: 3 } });
  axios.get.mockResolvedValueOnce({ data: books }).mockResolvedValueOnce({ data: books });

  render(<App />);
  await screen.findByText('The Hobbit');
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Book' } });
  fireEvent.change(screen.getByLabelText('Author'), { target: { value: 'New Author' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Book' }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/books', {
    title: 'New Book',
    author: 'New Author',
    description: '',
  }));
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
});

test('shows an error when books cannot be loaded', async () => {
  axios.get.mockRejectedValueOnce(new Error('network error'));

  render(<App />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load books.');
});

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

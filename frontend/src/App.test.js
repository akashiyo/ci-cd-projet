import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

test('renders book catalog title', () => {
  render(<App />);
  const linkElement = screen.getByText(/Book Catalog/i);
  expect(linkElement).toBeInTheDocument();
});

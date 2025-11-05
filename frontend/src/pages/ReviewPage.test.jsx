// frontend/src/pages/ReviewPage.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext } from '../App'; // Assuming AuthContext is exported from App.jsx
import ReviewPage from './ReviewPage';

// Mock dependencies
const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
};

const mockNavigate = vi.fn();

// Mock react-router-dom hooks
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useParams: () => ({ projectId: '1' }),
    useNavigate: () => mockNavigate,
  };
});

// A custom render function to wrap component in providers
const renderWithProviders = (ui, { providerProps, ...renderOptions }) => {
  return render(
    <MemoryRouter initialEntries={['/review/1']}>
      <AuthContext.Provider value={providerProps}>
        <Routes>
          <Route path="/review/:projectId" element={ui} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
    renderOptions
  );
};

describe('ReviewPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.post.mockReset();
    mockNavigate.mockReset();

    // Default happy path mocks
    mockAxiosInstance.get.mockImplementation((url) => {
      if (url.includes('/projects/')) {
        return Promise.resolve({ data: { title: 'Test Project' } });
      }
      if (url.includes('/reviews/')) {
        return Promise.resolve({ data: [] }); // No reviews initially
      }
      return Promise.reject(new Error(`Unhandled GET: ${url}`));
    });
  });

  it('renders the review form and project title', async () => {
    const providerProps = { user: { username: 'testclient' }, axiosInstance: mockAxiosInstance };

    renderWithProviders(<ReviewPage />, { providerProps });

    // Wait for project title to load
    expect(await screen.findByText('Leave a Review for "Test Project"')).toBeInTheDocument();

    // Check if form elements are present
    expect(screen.getByLabelText('Rating')).toBeInTheDocument();
    expect(screen.getByLabelText('Comment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Review' })).toBeInTheDocument();
  });

  it('submits a review successfully and navigates', async () => {
    // Mock a successful post
    mockAxiosInstance.post.mockResolvedValue({ data: { id: 1, comment: 'Great!' } });

    // Mock window.alert
    global.alert = vi.fn();

    const providerProps = { user: { username: 'testclient' }, axiosInstance: mockAxiosInstance };
    renderWithProviders(<ReviewPage />, { providerProps });

    // Wait for page to load
    await screen.findByText('Leave a Review for "Test Project"');

    // Fill out the form
    fireEvent.change(screen.getByLabelText('Rating'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Very good work!' } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Submit Review' }));

    // Wait for async operations to complete
    await waitFor(() => {
      // Check if POST was called correctly
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/reviews/', {
        project: '1',
        rating: 4,
        comment: 'Very good work!',
      });
    });

    // Check if alert was shown and user was navigated
    expect(global.alert).toHaveBeenCalledWith('Review submitted successfully!');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
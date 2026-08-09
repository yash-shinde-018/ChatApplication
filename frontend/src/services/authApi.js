const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Register a new user
 * @param {string} username - Username
 * @param {string} email - Email address
 * @param {string} password - Password
 * @param {string} confirmPassword - Confirm password
 */
export const register = async (username, email, password, confirmPassword) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        email,
        password,
        confirmPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

/**
 * Login user
 * @param {string} email - Email address
 * @param {string} password - Password
 */
export const login = async (email, password) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Get current authenticated user
 * @param {string} token - JWT token
 */
export const getCurrentUser = async (token) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch user');
    }

    return data;
  } catch (error) {
    console.error('Get current user error:', error);
    throw error;
  }
};

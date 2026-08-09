const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Get authorization header with JWT token
 */
const getAuthHeader = () => {
  const token = localStorage.getItem('chat_auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Generic fetch wrapper with error handling
 */
const fetchWithAuth = async (endpoint, options = {}) => {
  try {
    // Check if token exists before making request
    const token = localStorage.getItem('chat_auth_token');
    if (!token) {
      throw { status: 401, message: 'No authentication token found - please login' };
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: getAuthHeader(),
      ...options,
    });

    // Get response data first to check the message
    const data = await response.json();

    if (response.status === 401) {
      // Only redirect to login if it's an authentication error (bad token)
      // Not if it's an authorization error (wrong password, etc)
      if (data.message && (data.message.includes('Invalid password') || data.message.includes('Already a member'))) {
        throw { status: 401, message: data.message };
      }
      // Real authentication failure - redirect to login
      localStorage.removeItem('chat_auth_token');
      window.location.href = '/login';
      throw { status: 401, message: 'Unauthorized - please login again' };
    }

    if (response.status === 404) {
      throw { status: 404, message: data.message || 'Not found' };
    }

    if (response.status === 500) {
      throw { status: 500, message: data.message || 'Server error' };
    }

    if (!response.ok) {
      throw { status: response.status, message: data.message || response.statusText };
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

/**
 * API service object with all endpoints
 */
const api = {
  // Room endpoints
  get: (endpoint) => fetchWithAuth(endpoint, { method: 'GET' }),
  post: (endpoint, body) => fetchWithAuth(endpoint, { 
    method: 'POST', 
    body: JSON.stringify(body) 
  }),
  put: (endpoint, body) => fetchWithAuth(endpoint, { 
    method: 'PUT', 
    body: JSON.stringify(body) 
  }),
  delete: (endpoint) => fetchWithAuth(endpoint, { method: 'DELETE' }),
};

export default api;

/**
 * Legacy exports for backward compatibility
 */
export const getMessages = async () => {
  try {
    const data = await fetchWithAuth('/api/messages');
    return data.data || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
};

export const sendMessage = async (message) => {
  try {
    const data = await fetchWithAuth('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ message: message.trim() }),
    });
    return data.data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

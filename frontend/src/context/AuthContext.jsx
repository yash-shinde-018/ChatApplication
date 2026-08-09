import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { getCurrentUser } from '../services/authApi';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Restore authentication on mount
  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const storedToken = localStorage.getItem('chat_auth_token');
        
        if (storedToken) {
          setToken(storedToken);
          
          // Verify token by fetching current user
          const response = await getCurrentUser(storedToken);
          if (response.success) {
            setUser(response.data.user);
            setIsAuthenticated(true);
          } else {
            // Token invalid or expired
            localStorage.removeItem('chat_auth_token');
            setToken(null);
            setIsAuthenticated(false);
          }
        }
      } catch (error) {
        console.error('Error restoring authentication:', error);
        localStorage.removeItem('chat_auth_token');
        setToken(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    restoreAuth();
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem('chat_auth_token', token);
    setToken(token);
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('chat_auth_token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use AuthContext
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

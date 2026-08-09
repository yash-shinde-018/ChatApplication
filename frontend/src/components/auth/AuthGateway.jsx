import { useState } from 'react';
import Login from './Login';
import Register from './Register';

function AuthGateway() {
  const [isLoginMode, setIsLoginMode] = useState(true);

  return (
    <>
      {isLoginMode ? (
        <Login onSwitchToRegister={() => setIsLoginMode(false)} />
      ) : (
        <Register onSwitchToLogin={() => setIsLoginMode(true)} />
      )}
    </>
  );
}

export default AuthGateway;

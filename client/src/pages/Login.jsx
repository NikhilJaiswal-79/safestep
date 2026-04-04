import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function Login() {
  const [error, setError] = useState('');
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setError('');
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Failed to login with Google.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <div className="flex items-center gap-3 mb-10 text-primary">
        <ShieldAlert size={48} className="text-primary animate-pulse" />
        <h1 className="text-4xl font-bold">Nirbhaya Nari</h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-secondary mb-2">Welcome Back</h2>
        <p className="text-sm text-gray-500 mb-6">Sign in to access your safety dashboard</p>

        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold py-4 rounded-xl shadow-sm hover:bg-gray-50 active:scale-95 transition mb-6"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          Continue with Google
        </button>

        <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
          <button 
            onClick={() => navigate('/landing')}
            className="text-sm font-bold text-gray-400 hover:text-primary transition"
          >
            Discover SafeStep <span className="ml-1">→</span>
          </button>
        </div>
      </div>
      
      <p className="mt-8 text-xs text-gray-400 font-medium tracking-wide text-center max-w-xs">
        By continuing, you agree to our <span className="underline">Terms of Service</span> and <span className="underline">Privacy Policy</span>.
      </p>
    </div>
  );
}

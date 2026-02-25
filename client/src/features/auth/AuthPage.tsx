import { FormEvent, useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';

export const AuthPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const setUser = useAppStore((s) => s.setUser);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      await api.post('/auth/register', { email, username, password });
    }
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('foxcord_access_token', data.accessToken);
    localStorage.setItem('foxcord_refresh_token', data.refreshToken);
    setUser(data.user);
  };

  return (
    <div className="min-h-screen bg-panel flex items-center justify-center">
      <form className="bg-panelAlt p-6 rounded-xl w-[360px] space-y-3" onSubmit={submit}>
        <h1 className="text-2xl font-semibold">{isRegister ? 'Create FoxCord account' : 'Welcome back'}</h1>
        <input className="w-full p-2 bg-panel rounded" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {isRegister && <input className="w-full p-2 bg-panel rounded" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />}
        <input className="w-full p-2 bg-panel rounded" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full bg-accent rounded p-2">{isRegister ? 'Register' : 'Login'}</button>
        <button className="text-sm text-slate-300" type="button" onClick={() => setIsRegister((v) => !v)}>
          {isRegister ? 'Already have an account?' : 'Need an account?'}
        </button>
      </form>
    </div>
  );
};

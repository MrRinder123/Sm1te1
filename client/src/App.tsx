import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { AuthPage } from './features/auth/AuthPage';
import { ServerRail } from './features/servers/ServerRail';
import { ChannelSidebar } from './features/chat/ChannelSidebar';
import { ChatView } from './features/chat/ChatView';
import { VoicePanel } from './features/chat/VoicePanel';
import { api } from './lib/api';
import { useAppStore } from './store/useAppStore';

function App() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const servers = useAppStore((s) => s.servers);
  const setServers = useAppStore((s) => s.setServers);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const setChannels = useAppStore((s) => s.setChannels);

  useEffect(() => {
    const hydrate = async () => {
      const token = localStorage.getItem('foxcord_access_token');
      if (!token) return;
      const me = await api.get('/users/me');
      setUser(me.data);
      const guilds = await api.get('/servers');
      setServers(guilds.data);
    };

    hydrate().catch(() => {
      localStorage.removeItem('foxcord_access_token');
      setUser(null);
    });
  }, [setServers, setUser]);

  useEffect(() => {
    if (!activeServerId) return;
    api.get(`/channels/server/${activeServerId}`).then(({ data }) => setChannels(data));
  }, [activeServerId, setChannels]);

  if (!user) return <AuthPage />;

  return (
    <AppShell
      servers={<ServerRail />}
      channels={<><ChannelSidebar /><div className="mt-6"><VoicePanel /></div></>}
      top={<div className="flex justify-between w-full"><span>FoxCord</span><span className="text-sm text-slate-400">{user.username}</span></div>}
      members={<div><h2 className="text-xs uppercase text-slate-400 mb-2">Members</h2><p className="text-sm">Member list coming from presence + server roster.</p></div>}
    >
      <ChatView />
      {servers.length === 0 && <p className="text-slate-400 mt-4">Create or join a server to begin chatting.</p>}
    </AppShell>
  );
}

export default App;

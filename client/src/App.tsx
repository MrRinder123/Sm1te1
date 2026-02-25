import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { ToastStack } from './components/ToastStack';
import { FoxtroCenter } from './components/FoxtroCenter';
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
  const members = useAppStore((s) => s.members);
  const setMembers = useAppStore((s) => s.setMembers);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const setChannels = useAppStore((s) => s.setChannels);
  const setUnread = useAppStore((s) => s.setUnread);

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

    Promise.all([
      api.get(`/channels/server/${activeServerId}`),
      api.get(`/servers/${activeServerId}/members`),
      api.get(`/channels/server/${activeServerId}/unread`)
    ]).then(([channelsResponse, membersResponse, unreadResponse]) => {
      setChannels(channelsResponse.data);
      setMembers(membersResponse.data.map((item: any) => ({ ...item.user, role: item.role })));
      setUnread(Object.fromEntries(unreadResponse.data.map((entry: { channelId: string; count: number }) => [entry.channelId, entry.count])));
    });
  }, [activeServerId, setChannels, setMembers, setUnread]);

  if (!user) return <AuthPage />;

  return (
    <>
      <AppShell
        servers={<ServerRail />}
        channels={<><ChannelSidebar /><div className="mt-6"><VoicePanel /></div></>}
        top={<div className="flex justify-between w-full"><span>FoxCord</span><span className="text-sm text-slate-400">{user.username}</span></div>}
        members={<div><h2 className="text-xs uppercase text-slate-400 mb-2">Members</h2><div className="space-y-1">{members.map((m) => <div key={m.id} className="flex items-center justify-between rounded px-2 py-1 bg-panelAlt/40"><span className="text-sm">{m.username}</span><span className="text-[10px] text-slate-400">{m.role}</span></div>)}</div></div>}
      >
        <div className="space-y-3"><FoxtroCenter /><ChatView /></div>
        {servers.length === 0 && <p className="text-slate-400 mt-4">Create or join a server to begin chatting.</p>}
      </AppShell>
      <ToastStack />
    </>
  );
}

export default App;

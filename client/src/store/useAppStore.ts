import { create } from 'zustand';

type User = { id: string; username: string; email: string; avatarUrl?: string | null };
type Server = { id: string; name: string; role: 'ADMIN' | 'MODERATOR' | 'MEMBER' };
type Channel = { id: string; name: string; type: 'TEXT' | 'VOICE'; category?: string };

type AppStore = {
  user: User | null;
  servers: Server[];
  channels: Channel[];
  activeServerId?: string;
  activeChannelId?: string;
  setUser: (user: User | null) => void;
  setServers: (servers: Server[]) => void;
  setChannels: (channels: Channel[]) => void;
  setActiveServer: (id: string) => void;
  setActiveChannel: (id: string) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  servers: [],
  channels: [],
  setUser: (user) => set({ user }),
  setServers: (servers) => set({ servers }),
  setChannels: (channels) => set({ channels }),
  setActiveServer: (activeServerId) => set({ activeServerId }),
  setActiveChannel: (activeChannelId) => set({ activeChannelId })
}));

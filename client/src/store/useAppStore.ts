import { create } from 'zustand';

type User = { id: string; username: string; email: string; avatarUrl?: string | null };
type Server = { id: string; name: string; role: 'ADMIN' | 'MODERATOR' | 'MEMBER' };
type Channel = { id: string; name: string; type: 'TEXT' | 'VOICE'; category?: string };
type Member = { id: string; username: string; avatarUrl?: string | null; role: 'ADMIN' | 'MODERATOR' | 'MEMBER' };

type Toast = { id: string; message: string };

type AppStore = {
  user: User | null;
  servers: Server[];
  channels: Channel[];
  members: Member[];
  unreadByChannel: Record<string, number>;
  toasts: Toast[];
  activeServerId?: string;
  activeChannelId?: string;
  setUser: (user: User | null) => void;
  setServers: (servers: Server[]) => void;
  setChannels: (channels: Channel[]) => void;
  setMembers: (members: Member[]) => void;
  setUnread: (unreadByChannel: Record<string, number>) => void;
  setActiveServer: (id: string) => void;
  setActiveChannel: (id: string) => void;
  pushToast: (message: string) => void;
  removeToast: (id: string) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  servers: [],
  channels: [],
  members: [],
  unreadByChannel: {},
  toasts: [],
  setUser: (user) => set({ user }),
  setServers: (servers) => set({ servers }),
  setChannels: (channels) => set({ channels }),
  setMembers: (members) => set({ members }),
  setUnread: (unreadByChannel) => set({ unreadByChannel }),
  setActiveServer: (activeServerId) => set({ activeServerId }),
  setActiveChannel: (activeChannelId) => set((state) => ({
    activeChannelId,
    unreadByChannel: { ...state.unreadByChannel, [activeChannelId]: 0 }
  })),
  pushToast: (message) => set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), message }] })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}));

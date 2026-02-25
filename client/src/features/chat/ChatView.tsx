import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { socket } from '../../lib/socket';
import { useAppStore } from '../../store/useAppStore';

type Message = {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  readBy?: string[];
};

export const ChatView = () => {
  const user = useAppStore((s) => s.user);
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!activeChannelId) return;
    api.get(`/messages/channel/${activeChannelId}`).then(({ data }) => setMessages(data));
    socket.emit('room:join', { channelId: activeChannelId });
  }, [activeChannelId]);

  useEffect(() => {
    socket.connect();
    const onMessage = (msg: Message) => setMessages((prev) => [...prev, msg]);
    const onTyping = ({ userId }: { userId: string }) => {
      if (userId === user?.id) return;
      setTypingUsers((prev) => Array.from(new Set([...prev, userId])));
      setTimeout(() => setTypingUsers((prev) => prev.filter((id) => id !== userId)), 1500);
    };
    socket.on('message:new', onMessage);
    socket.on('message:typing', onTyping);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:typing', onTyping);
    };
  }, [user?.id]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activeChannelId || !user) return;
    const payload = { channelId: activeChannelId, content: draft, authorId: user.id };
    await api.post('/messages', payload);
    socket.emit('message:new', payload);
    setDraft('');
  };

  const onTyping = () => {
    if (!activeChannelId || !user) return;
    socket.emit('message:typing', { channelId: activeChannelId, userId: user.id });
  };

  const grouped = useMemo(() => messages, [messages]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 space-y-2 overflow-auto">
        {grouped.map((m) => (
          <div key={m.id} className="p-2 rounded hover:bg-panelAlt/50">
            <p className="text-sm">{m.content}</p>
            <p className="text-[11px] text-slate-400">{new Date(m.createdAt).toLocaleTimeString()} · {m.readBy?.length ?? 0} seen</p>
          </div>
        ))}
      </div>
      {typingUsers.length > 0 && <p className="text-xs text-slate-400 py-1">Someone is typing...</p>}
      <form onSubmit={send} className="pt-2">
        <input className="w-full bg-panelAlt rounded px-3 py-2" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onTyping} placeholder="Message channel" />
      </form>
    </div>
  );
};

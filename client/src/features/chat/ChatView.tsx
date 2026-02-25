import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { socket } from '../../lib/socket';
import { useAppStore } from '../../store/useAppStore';

type Message = {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  pinned?: boolean;
  readBy?: string[];
};

export const ChatView = () => {
  const user = useAppStore((s) => s.user);
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const pushToast = useAppStore((s) => s.pushToast);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [pins, setPins] = useState<Message[]>([]);

  const loadPins = async (channelId: string) => {
    const { data } = await api.get(`/messages/channel/${channelId}/pins`);
    setPins(data);
  };

  useEffect(() => {
    if (!activeChannelId) return;

    api.get(`/messages/channel/${activeChannelId}`).then(({ data }) => {
      setMessages(data);
      api.post(`/messages/channel/${activeChannelId}/read`).catch(() => null);
    });

    loadPins(activeChannelId).catch(() => null);
    socket.emit('room:join', { channelId: activeChannelId });
  }, [activeChannelId]);

  useEffect(() => {
    socket.connect();

    const onMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);

      if (user && msg.content.includes(`@${user.username}`) && msg.authorId !== user.id) {
        pushToast(`Mentioned in channel: ${msg.content.slice(0, 60)}`);
      }
    };

    const onTyping = ({ userId }: { userId: string }) => {
      if (userId === user?.id) return;
      setTypingUsers((prev) => Array.from(new Set([...prev, userId])));
      setTimeout(() => setTypingUsers((prev) => prev.filter((id) => id !== userId)), 1500);
    };

    const onEdit = ({ messageId, content }: { messageId: string; content: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content } : m)));
    };

    const onDelete = ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setPins((prev) => prev.filter((m) => m.id !== messageId));
    };

    socket.on('message:new', onMessage);
    socket.on('message:typing', onTyping);
    socket.on('message:edit', onEdit);
    socket.on('message:delete', onDelete);

    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:typing', onTyping);
      socket.off('message:edit', onEdit);
      socket.off('message:delete', onDelete);
    };
  }, [user, pushToast]);

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

  const runSearch = async () => {
    if (!activeChannelId || !search.trim()) return setSearchResults([]);
    const { data } = await api.get(`/messages/channel/${activeChannelId}/search?q=${encodeURIComponent(search.trim())}`);
    setSearchResults(data);
  };

  const togglePin = async (message: Message) => {
    if (message.pinned) {
      await api.post(`/messages/${message.id}/unpin`);
      setPins((prev) => prev.filter((item) => item.id !== message.id));
    } else {
      await api.post(`/messages/${message.id}/pin`);
      setPins((prev) => [message, ...prev.filter((item) => item.id !== message.id)]);
    }

    setMessages((prev) => prev.map((item) => item.id === message.id ? { ...item, pinned: !item.pinned } : item));
  };

  const renderedMessages = useMemo(() => {
    if (!search.trim()) return messages;
    const ids = new Set(searchResults.map((m) => m.id));
    return messages.filter((m) => ids.has(m.id));
  }, [messages, searchResults, search]);

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          className="bg-panelAlt rounded px-3 py-2 text-sm flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search in channel"
        />
        <button className="bg-panelAlt rounded px-3 py-2 text-sm" onClick={runSearch}>Search</button>
        <button className="bg-panelAlt rounded px-3 py-2 text-sm" onClick={() => setPinsOpen((v) => !v)}>
          Pins ({pins.length})
        </button>
      </div>

      {pinsOpen && (
        <div className="bg-panelAlt/50 border border-panelAlt rounded p-2 max-h-32 overflow-auto space-y-1">
          {pins.length === 0 && <p className="text-xs text-slate-400">No pinned messages</p>}
          {pins.map((pin) => (
            <div key={pin.id} className="text-xs p-1 rounded bg-panel/50">📌 {pin.content}</div>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-auto">
        {renderedMessages.map((m) => {
          const mentioned = user ? m.content.includes(`@${user.username}`) : false;
          return (
            <div key={m.id} className={`p-2 rounded hover:bg-panelAlt/50 ${mentioned ? 'border border-amber-400/50 bg-amber-400/10' : ''}`}>
              <div className="flex justify-between gap-2">
                <p className="text-sm">{m.pinned && '📌 '}{m.content}</p>
                <button className="text-[11px] text-slate-400 hover:text-slate-200" onClick={() => togglePin(m)}>
                  {m.pinned ? 'Unpin' : 'Pin'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">{new Date(m.createdAt).toLocaleTimeString()} · {m.readBy?.length ?? 0} seen</p>
            </div>
          );
        })}
      </div>

      {typingUsers.length > 0 && <p className="text-xs text-slate-400 py-1">Someone is typing...</p>}
      <form onSubmit={send} className="pt-2">
        <input className="w-full bg-panelAlt rounded px-3 py-2" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onTyping} placeholder="Message channel" />
      </form>
    </div>
  );
};

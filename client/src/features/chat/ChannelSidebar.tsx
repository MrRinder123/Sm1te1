import { useAppStore } from '../../store/useAppStore';

export const ChannelSidebar = () => {
  const channels = useAppStore((s) => s.channels);
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const setActiveChannel = useAppStore((s) => s.setActiveChannel);

  return (
    <div>
      <h2 className="text-xs uppercase tracking-wide text-slate-400 mb-2">Channels</h2>
      <div className="space-y-1">
        {channels.map((channel) => (
          <button
            key={channel.id}
            className={`w-full text-left px-2 py-1 rounded ${activeChannelId === channel.id ? 'bg-panel' : 'hover:bg-panel'}`}
            onClick={() => setActiveChannel(channel.id)}
          >
            {channel.type === 'TEXT' ? '# ' : '🔊 '}
            {channel.name}
          </button>
        ))}
      </div>
    </div>
  );
};

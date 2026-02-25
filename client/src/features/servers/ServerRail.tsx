import { useAppStore } from '../../store/useAppStore';

export const ServerRail = () => {
  const servers = useAppStore((s) => s.servers);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const setActiveServer = useAppStore((s) => s.setActiveServer);

  return (
    <div className="space-y-2">
      {servers.map((server) => (
        <button
          key={server.id}
          className={`w-12 h-12 rounded-2xl text-sm font-semibold ${activeServerId === server.id ? 'bg-accent' : 'bg-panelAlt'}`}
          onClick={() => setActiveServer(server.id)}
          title={server.name}
        >
          {server.name.slice(0, 2).toUpperCase()}
        </button>
      ))}
    </div>
  );
};

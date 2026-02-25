import { ReactNode } from 'react';

export const AppShell = ({
  servers,
  channels,
  members,
  top,
  children
}: {
  servers: ReactNode;
  channels: ReactNode;
  members: ReactNode;
  top: ReactNode;
  children: ReactNode;
}) => (
  <div className="h-screen grid grid-cols-[72px_260px_1fr_220px] bg-panel text-slate-100">
    <aside className="border-r border-panelAlt p-2 space-y-2">{servers}</aside>
    <aside className="border-r border-panelAlt p-3">{channels}</aside>
    <main className="flex flex-col">
      <header className="h-14 border-b border-panelAlt px-4 flex items-center">{top}</header>
      <section className="flex-1 overflow-auto p-4">{children}</section>
    </main>
    <aside className="border-l border-panelAlt p-3">{members}</aside>
  </div>
);

import { useEffect, useRef, useState } from 'react';
import { socket } from '../../lib/socket';
import { useAppStore } from '../../store/useAppStore';

/**
 * Lightweight WebRTC setup that uses Socket.io as signaling transport.
 * This keeps voice architecture ready for multi-user expansion.
 */
export const VoicePanel = () => {
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const handler = ({ muted: remoteMuted }: { muted: boolean }) => {
      console.log('Remote mute state changed', remoteMuted);
    };
    socket.on('voice:mute', handler);
    return () => {
      socket.off('voice:mute', handler);
    };
  }, []);

  const joinVoice = async () => {
    if (!activeChannelId) return;
    localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    socket.emit('room:join', { channelId: activeChannelId });
    setJoined(true);
  };

  const leaveVoice = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    setJoined(false);
  };

  const toggleMute = () => {
    if (!localStreamRef.current || !activeChannelId) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
      socket.emit('voice:mute', { channelId: activeChannelId, muted: !track.enabled });
    });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase text-slate-400">Voice</h3>
      {!joined ? (
        <button className="w-full bg-accent rounded p-2" onClick={joinVoice}>Join voice</button>
      ) : (
        <div className="space-y-2">
          <button className="w-full bg-panel rounded p-2" onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
          <button className="w-full bg-red-500/80 rounded p-2" onClick={leaveVoice}>Leave</button>
        </div>
      )}
    </div>
  );
};

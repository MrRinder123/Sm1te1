import { useEffect, useRef, useState } from 'react';
import { socket } from '../../lib/socket';
import { useAppStore } from '../../store/useAppStore';

type SignalPayload = {
  type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

/**
 * Mesh voice implementation: each peer holds direct RTCPeerConnections to others.
 * Socket.io is used only for signaling and participant presence.
 */
export const VoicePanel = () => {
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [remoteMuteState, setRemoteMuteState] = useState<Record<string, boolean>>({});

  const joinedChannelRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});

  const ensurePeerConnection = (targetSocketId: string, channelId: string) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      return peerConnectionsRef.current[targetSocketId];
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current[targetSocketId] = pc;

    localStreamRef.current?.getTracks().forEach((track) => {
      if (!localStreamRef.current) return;
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit('voice:signal', {
        channelId,
        targetSocketId,
        signal: { type: 'ice-candidate', candidate: event.candidate.toJSON() }
      });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      remoteStreamsRef.current[targetSocketId] = stream;

      const audioId = `voice-audio-${targetSocketId}`;
      let audio = document.getElementById(audioId) as HTMLAudioElement | null;
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = audioId;
        audio.autoplay = true;
        audio.controls = false;
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }

      audio.srcObject = stream;
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        pc.close();
        delete peerConnectionsRef.current[targetSocketId];
        delete remoteStreamsRef.current[targetSocketId];
        const audio = document.getElementById(`voice-audio-${targetSocketId}`);
        if (audio) audio.remove();
      }
    };

    return pc;
  };

  const createOfferForPeer = async (targetSocketId: string, channelId: string) => {
    const pc = ensurePeerConnection(targetSocketId, channelId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('voice:signal', {
      channelId,
      targetSocketId,
      signal: { type: 'offer', sdp: offer }
    });
  };

  const cleanupVoice = () => {
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    remoteStreamsRef.current = {};

    document.querySelectorAll('[id^="voice-audio-"]').forEach((el) => el.remove());

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setParticipants([]);
    setRemoteMuteState({});
    setJoined(false);
    setMuted(false);
  };

  useEffect(() => {
    const onParticipants = async ({ channelId, participants: existingParticipants }: { channelId: string; participants: string[] }) => {
      if (joinedChannelRef.current !== channelId) return;
      setParticipants(existingParticipants);

      for (const peerSocketId of existingParticipants) {
        await createOfferForPeer(peerSocketId, channelId);
      }
    };

    const onUserJoined = ({ channelId, socketId }: { channelId: string; socketId: string }) => {
      if (joinedChannelRef.current !== channelId) return;
      setParticipants((prev) => Array.from(new Set([...prev, socketId])));
    };

    const onUserLeft = ({ channelId, socketId }: { channelId: string; socketId: string }) => {
      if (joinedChannelRef.current !== channelId) return;

      setParticipants((prev) => prev.filter((id) => id !== socketId));
      setRemoteMuteState((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });

      const pc = peerConnectionsRef.current[socketId];
      if (pc) {
        pc.close();
        delete peerConnectionsRef.current[socketId];
      }

      const audio = document.getElementById(`voice-audio-${socketId}`);
      if (audio) audio.remove();
    };

    const onSignal = async ({ channelId, signal, from }: { channelId: string; signal: SignalPayload; from: string }) => {
      if (joinedChannelRef.current !== channelId) return;

      const pc = ensurePeerConnection(from, channelId);

      if (signal.type === 'offer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice:signal', {
          channelId,
          targetSocketId: from,
          signal: { type: 'answer', sdp: answer }
        });
      }

      if (signal.type === 'answer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      }

      if (signal.type === 'ice-candidate' && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    };

    const onVoiceMute = ({ userSocketId, muted: isMuted }: { userSocketId: string; muted: boolean }) => {
      setRemoteMuteState((prev) => ({ ...prev, [userSocketId]: isMuted }));
    };

    socket.on('voice:participants', onParticipants);
    socket.on('voice:user-joined', onUserJoined);
    socket.on('voice:user-left', onUserLeft);
    socket.on('voice:signal', onSignal);
    socket.on('voice:mute', onVoiceMute);

    return () => {
      socket.off('voice:participants', onParticipants);
      socket.off('voice:user-joined', onUserJoined);
      socket.off('voice:user-left', onUserLeft);
      socket.off('voice:signal', onSignal);
      socket.off('voice:mute', onVoiceMute);
    };
  }, []);

  useEffect(() => {
    if (!joined) return;

    if (activeChannelId && joinedChannelRef.current && activeChannelId !== joinedChannelRef.current) {
      socket.emit('voice:leave', { channelId: joinedChannelRef.current });
      joinedChannelRef.current = null;
      cleanupVoice();
    }
  }, [activeChannelId, joined]);


  useEffect(() => {
    return () => {
      if (joinedChannelRef.current) {
        socket.emit('voice:leave', { channelId: joinedChannelRef.current });
      }
      joinedChannelRef.current = null;
      cleanupVoice();
    };
  }, []);

  const joinVoice = async () => {
    if (!activeChannelId) return;
    if (!socket.connected) socket.connect();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;

    joinedChannelRef.current = activeChannelId;
    socket.emit('voice:join', { channelId: activeChannelId });
    setJoined(true);
  };

  const leaveVoice = () => {
    if (joinedChannelRef.current) {
      socket.emit('voice:leave', { channelId: joinedChannelRef.current });
    }

    joinedChannelRef.current = null;
    cleanupVoice();
  };

  const toggleMute = () => {
    if (!localStreamRef.current || !joinedChannelRef.current) return;

    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      const nextMuted = !track.enabled;
      setMuted(nextMuted);
      socket.emit('voice:mute', { channelId: joinedChannelRef.current, muted: nextMuted });
    });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase text-slate-400">Voice</h3>
      {!joined ? (
        <button className="w-full bg-accent rounded p-2" onClick={joinVoice}>Join voice</button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Connected: {participants.length + 1}</p>
          {participants.map((id) => (
            <div key={id} className="text-xs bg-panelAlt/60 rounded px-2 py-1 flex justify-between">
              <span>{id.slice(0, 8)}</span>
              <span>{remoteMuteState[id] ? 'muted' : 'live'}</span>
            </div>
          ))}
          <button className="w-full bg-panel rounded p-2" onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
          <button className="w-full bg-red-500/80 rounded p-2" onClick={leaveVoice}>Leave</button>
        </div>
      )}
    </div>
  );
};

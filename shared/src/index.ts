export type Role = 'ADMIN' | 'MODERATOR' | 'MEMBER';

export interface JwtPayload {
  userId: string;
  email: string;
}

export type ChannelType = 'TEXT' | 'VOICE';

export interface SocketEvents {
  'message:new': {
    channelId: string;
    content: string;
  };
  'message:typing': {
    channelId: string;
    userId: string;
  };
}

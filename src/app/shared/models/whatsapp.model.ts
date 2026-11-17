export interface WaMessage {
  id: string;
  remoteJid: string; // ex: 5561999998888@s.whatsapp.net
  customerName?: string;
  customerPhone: string;
  fromMe: boolean;
  body: string;
  mediaUrl?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  attendantName?: string;
  timestamp: string;
}

export interface WaConversation {
  id: string;
  remoteJid: string;
  customerName: string;
  customerPhone: string;
  petName?: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount: number;
  assignedTo?: string;
  suggestedReply?: string;
  suggestedIntent?: 'cotacao' | 'endereco_taxi' | 'status_fila' | 'motorista_buscar' | 'motorista_devolver' | 'geral';
}

export interface QuickSuggestionTemplate {
  id: string;
  title: string;
  category: 'taxi' | 'fila' | 'cotacao' | 'atendimento';
  textTemplate: string;
  variables: string[]; // e.g., ['tutor', 'pet', 'motorista', 'preco']
}

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

export interface EvolutionConnectionState {
  connected: boolean;
  state: 'open' | 'connecting' | 'close' | 'offline';
  instanceName: string;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
}

export interface EvolutionQrCodeResponse {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
}

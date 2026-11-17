import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { WaConversation, WaMessage, QuickSuggestionTemplate } from '../models/whatsapp.model';

const STORAGE_CONVERSATIONS_KEY = 'syspet_wa_conversations_v1';
const STORAGE_MESSAGES_KEY = 'syspet_wa_messages_v1';

const DEFAULT_CONVERSATIONS: WaConversation[] = [
  {
    id: 'conv-1',
    remoteJid: '5561991234567@s.whatsapp.net',
    customerName: 'Mariana Silva',
    customerPhone: '(61) 99123-4567',
    petName: 'Thor (Golden Retriever)',
    lastMessage: 'Oi boa tarde! Quanto fica o banho com tosa higiênica pro Thor? Ele pesa uns 32kg.',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    unreadCount: 1,
    suggestedIntent: 'cotacao',
    suggestedReply: 'Olá Mariana! 🐾 Para o Thor (Golden Retriever, porte Grande), o Banho Completo com Tosa Higiênica fica em R$ 140,00. Temos vaga disponível hoje! Posso garantir a vaga dele?'
  },
  {
    id: 'conv-2',
    remoteJid: '5561988887777@s.whatsapp.net',
    customerName: 'Carlos Eduardo',
    customerPhone: '(61) 98888-7777',
    petName: 'Mel (Spitz Alemão)',
    lastMessage: 'Vocês buscam aqui no condomínio no Park Way?',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    unreadCount: 1,
    suggestedIntent: 'endereco_taxi',
    suggestedReply: 'Olá Carlos! 🚗 Sim, atendemos o Park Way e condomínios com nosso Táxi Dog (taxa de R$ 20,00 a R$ 25,00 ida e volta). Qual a quadra ou conjunto certinho para agendarmos a busca da Mel?'
  },
  {
    id: 'conv-3',
    remoteJid: '5561999990000@s.whatsapp.net',
    customerName: 'Fernanda Lima',
    customerPhone: '(61) 99999-0000',
    petName: 'Pipoca (Shih Tzu)',
    lastMessage: 'A Pipoca já está pronta? Que horas posso buscar?',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    unreadCount: 0,
    suggestedIntent: 'status_fila',
    suggestedReply: 'Olá Fernanda! A Pipoca já está na fase final de secagem e perfume. A estimativa de saída é daqui a 20 minutos!'
  }
];

const INITIAL_MESSAGES: Record<string, WaMessage[]> = {
  'conv-1': [
    {
      id: 'msg-1',
      remoteJid: '5561991234567@s.whatsapp.net',
      customerName: 'Mariana Silva',
      customerPhone: '(61) 99123-4567',
      fromMe: false,
      body: 'Oi boa tarde! Quanto fica o banho com tosa higiênica pro Thor? Ele pesa uns 32kg.',
      status: 'read',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString()
    }
  ],
  'conv-2': [
    {
      id: 'msg-2',
      remoteJid: '5561988887777@s.whatsapp.net',
      customerName: 'Carlos Eduardo',
      customerPhone: '(61) 98888-7777',
      fromMe: false,
      body: 'Vocês buscam aqui no condomínio no Park Way?',
      status: 'read',
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString()
    }
  ],
  'conv-3': [
    {
      id: 'msg-3',
      remoteJid: '5561999990000@s.whatsapp.net',
      customerName: 'Fernanda Lima',
      customerPhone: '(61) 99999-0000',
      fromMe: false,
      body: 'A Pipoca já está pronta? Que horas posso buscar?',
      status: 'read',
      timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString()
    }
  ]
};

@Injectable({
  providedIn: 'root'
})
export class WhatsappService {
  private conversations$ = new BehaviorSubject<WaConversation[]>(this.loadConversations());
  private activeMessages$ = new BehaviorSubject<WaMessage[]>([]);
  private selectedConversation$ = new BehaviorSubject<WaConversation | null>(null);

  constructor(private http: HttpClient) {}

  private loadConversations(): WaConversation[] {
    try {
      const stored = localStorage.getItem(STORAGE_CONVERSATIONS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Erro ao carregar conversas do storage', e);
    }
    this.saveConversations(DEFAULT_CONVERSATIONS);
    return DEFAULT_CONVERSATIONS;
  }

  private saveConversations(convs: WaConversation[]): void {
    try {
      localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(convs));
      this.conversations$.next(convs);
    } catch (e) {
      console.warn('Erro ao salvar conversas no storage', e);
    }
  }

  getConversations(): Observable<WaConversation[]> {
    return this.conversations$.asObservable();
  }

  getSelectedConversation(): Observable<WaConversation | null> {
    return this.selectedConversation$.asObservable();
  }

  selectConversation(conv: WaConversation): void {
    this.selectedConversation$.next(conv);
    this.loadMessagesForConversation(conv.id);
    if (conv.unreadCount > 0) {
      conv.unreadCount = 0;
      this.saveConversations([...this.conversations$.getValue()]);
    }
  }

  loadMessagesForConversation(convId: string): Observable<WaMessage[]> {
    let msgs: WaMessage[] = [];
    try {
      const raw = localStorage.getItem(`${STORAGE_MESSAGES_KEY}_${convId}`);
      if (raw) {
        msgs = JSON.parse(raw);
      } else if (INITIAL_MESSAGES[convId]) {
        msgs = INITIAL_MESSAGES[convId];
      }
    } catch (e) {
      msgs = INITIAL_MESSAGES[convId] || [];
    }
    this.activeMessages$.next(msgs);
    return of(msgs);
  }

  getActiveMessages(): Observable<WaMessage[]> {
    return this.activeMessages$.asObservable();
  }

  /**
   * Envia mensagem (HU-17 + Evolution API)
   */
  sendMessage(convId: string, text: string, attendantName = 'Recepção'): Observable<WaMessage> {
    const conv = this.conversations$.getValue().find(c => c.id === convId);
    const newMsg: WaMessage = {
      id: 'msg-' + Date.now(),
      remoteJid: conv ? conv.remoteJid : '',
      customerName: conv ? conv.customerName : '',
      customerPhone: conv ? conv.customerPhone : '',
      fromMe: true,
      body: text,
      status: 'delivered',
      attendantName,
      timestamp: new Date().toISOString()
    };

    // Update active messages
    const current = this.activeMessages$.getValue();
    const updated = [...current, newMsg];
    this.activeMessages$.next(updated);
    try {
      localStorage.setItem(`${STORAGE_MESSAGES_KEY}_${convId}`, JSON.stringify(updated));
    } catch (e) {}

    // Update conversation last message
    if (conv) {
      conv.lastMessage = text;
      conv.lastMessageAt = new Date().toISOString();
      conv.suggestedReply = '';
      this.saveConversations([...this.conversations$.getValue()]);
    }

    return of(newMsg);
  }

  /**
   * Motorista a Caminho - Buscar (HU-15)
   */
  buildDriverSeekingMessage(tutor: string, pet: string, driver: string, originAddress: string): string {
    const tutorGreeting = tutor ? `Olá ${tutor}!` : 'Olá!';
    const driverRef = driver || 'nosso motorista';
    const addressRef = originAddress ? ` em ${originAddress}` : '';
    return `${tutorGreeting} 🚗 ${driverRef} do Animal World acabou de sair e está a caminho para buscar o pet ${pet}${addressRef}. Por favor, deixe-o pronto para o embarque! 🐾`;
  }

  /**
   * Motorista a Caminho - Devolver (HU-15)
   */
  buildDriverReturningMessage(tutor: string, pet: string, driver: string): string {
    const tutorGreeting = tutor ? `Olá ${tutor}!` : 'Olá!';
    const driverRef = driver || 'nosso motorista';
    return `${tutorGreeting} ✨ O atendimento do ${pet} foi finalizado com muito carinho! Ele já está cheirosinho e ${driverRef} está a caminho para levá-lo de volta para casa. 🚗🐾`;
  }

  /**
   * Pet Pronto (HU-14)
   */
  buildPetReadyMessage(tutor: string, pet: string): string {
    const tutorGreeting = tutor ? `Olá ${tutor}!` : 'Olá!';
    return `${tutorGreeting} 🐾 O ${pet} já terminou o banho/tosa e está pronto e perfumado para ser retirado no Animal World!`;
  }

  /**
   * Cotação inteligente (HU-16)
   */
  buildSmartQuoteMessage(
    tutor: string,
    pet: string,
    breed: string,
    sizeTierLabel: string,
    services: string,
    priceTotal: number,
    extrasSummary = ''
  ): string {
    const greeting = tutor ? `Olá ${tutor}!` : 'Olá!';
    const petDesc = breed ? `${pet} (${breed}, porte ${sizeTierLabel})` : `${pet} (porte ${sizeTierLabel})`;
    let text = `${greeting} 🐾 Para o ${petDesc}, o valor do atendimento (${services}) fica em R$ ${priceTotal.toFixed(2).replace('.', ',')}.`;
    if (extrasSummary) {
      text += `\nIncluso/Adicionais: ${extrasSummary}.`;
    }
    text += `\nTemos vaga aberta na esteira de hoje! Deseja que eu reserve o horário para vocês?`;
    return text;
  }

  /**
   * Abre link wa.me direto no navegador / WhatsApp Web
   */
  openWhatsAppDirect(phone: string, text: string): void {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const encoded = encodeURIComponent(text);
    const url = `https://wa.me/${fullPhone}?text=${encoded}`;
    window.open(url, '_blank');
  }
}

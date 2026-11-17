import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WhatsappService } from '../../../shared/services/whatsapp.service';
import { PricingService } from '../../../shared/services/pricing.service';
import { TaxiService } from '../../../shared/services/taxi.service';
import { WaConversation, WaMessage } from '../../../shared/models/whatsapp.model';

@Component({
  selector: 'app-admin-whatsapp',
  templateUrl: './admin-whatsapp.component.html',
  styleUrls: ['./admin-whatsapp.component.scss']
})
export class AdminWhatsappComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  conversations: WaConversation[] = [];
  selectedConversation: WaConversation | null = null;
  messages: WaMessage[] = [];

  // Atendente Ativa
  currentAttendant = 'Recepção (Thaina)';
  attendants = ['Recepção (Thaina)', 'Lucas (Motorista)', 'Atendimento Balcão'];

  // Input de Mensagem
  messageInput = '';

  // Gerador de Cotação Inteligente (HU-16)
  showQuoteHelper = false;
  quotePetName = 'Thor';
  quoteBreed = 'Golden Retriever';
  quoteWeightKg = 30;
  quoteService = 'Banho Completo';
  quoteSelectedExtras: string[] = ['desembolo'];
  quoteIncludeTaxi = true;
  quoteTaxiRegion = 'Condomínios Riacho Fundo / SMPW';

  // Evolution API Status
  evolutionConnected = true;
  evolutionInstance = 'animalworld-central';

  toastMessage = '';
  toastType: 'success' | 'danger' = 'success';

  constructor(
    private waService: WhatsappService,
    public pricingService: PricingService,
    private taxiService: TaxiService
  ) {}

  ngOnInit(): void {
    this.waService.getConversations().pipe(takeUntil(this.destroy$)).subscribe(convs => {
      this.conversations = convs;
      if (!this.selectedConversation && convs.length > 0) {
        this.selectConversation(convs[0]);
      }
    });

    this.waService.getActiveMessages().pipe(takeUntil(this.destroy$)).subscribe(msgs => {
      this.messages = msgs;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectConversation(conv: WaConversation): void {
    this.selectedConversation = conv;
    this.waService.selectConversation(conv);
  }

  // --- SUGESTÃO INTELIGENTE (HU-16) ---
  applySuggestedReply(): void {
    if (this.selectedConversation && this.selectedConversation.suggestedReply) {
      this.messageInput = this.selectedConversation.suggestedReply;
      this.showToast('Sugestão aplicada no campo de texto para sua revisão!', 'success');
    }
  }

  // --- ENVIO DE MENSAGENS (HU-17 & Evolution API) ---
  sendMessage(): void {
    if (!this.selectedConversation || !this.messageInput.trim()) return;

    const text = this.messageInput.trim();
    this.waService.sendMessage(this.selectedConversation.id, text, this.currentAttendant).subscribe(() => {
      this.messageInput = '';
      this.showToast('Mensagem enviada com sucesso!', 'success');
    });
  }

  openInWhatsAppWeb(): void {
    if (!this.selectedConversation || !this.messageInput.trim()) return;
    this.waService.openWhatsAppDirect(this.selectedConversation.customerPhone, this.messageInput.trim());
    this.showToast('Abrindo WhatsApp Web...', 'success');
  }

  // --- GERADOR DE COTAÇÃO RÁPIDA (HU-16) ---
  openQuoteHelper(): void {
    this.showQuoteHelper = true;
  }

  closeQuoteHelper(): void {
    this.showQuoteHelper = false;
  }

  generateAndInsertQuote(): void {
    const reg = this.quoteIncludeTaxi ? this.taxiService.findRegionByQuery(this.quoteTaxiRegion) : null;
    const taxiPrice = reg ? reg.price : (this.quoteIncludeTaxi ? 20 : 0);

    const quote = this.pricingService.calculateQuote(
      this.quoteService,
      this.quoteWeightKg,
      this.quoteBreed,
      this.quoteSelectedExtras,
      taxiPrice,
      reg ? reg.name : undefined
    );

    const extrasText = quote.extras.map(e => `${e.name} (+R$ ${e.price})`).join(', ') +
      (quote.taxiPrice ? `, Táxi Dog ${quote.taxiRegionName || ''} (+R$ ${quote.taxiPrice})` : '');

    const text = this.waService.buildSmartQuoteMessage(
      this.selectedConversation ? this.selectedConversation.customerName : 'Cliente',
      this.quotePetName,
      this.quoteBreed,
      quote.sizeLabel,
      this.quoteService,
      quote.totalPrice,
      extrasText
    );

    this.messageInput = text;
    this.closeQuoteHelper();
    this.showToast('Cotação detalhada inserida no campo de resposta!', 'success');
  }

  toggleExtraInHelper(id: string): void {
    const idx = this.quoteSelectedExtras.indexOf(id);
    if (idx !== -1) {
      this.quoteSelectedExtras.splice(idx, 1);
    } else {
      this.quoteSelectedExtras.push(id);
    }
  }

  isExtraSelectedInHelper(id: string): boolean {
    return this.quoteSelectedExtras.includes(id);
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  private showToast(msg: string, type: 'success' | 'danger'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = '';
    }, 4000);
  }
}

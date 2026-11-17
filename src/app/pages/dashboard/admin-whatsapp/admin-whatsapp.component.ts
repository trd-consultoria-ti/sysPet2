import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WhatsappService } from '../../../shared/services/whatsapp.service';
import { PricingService } from '../../../shared/services/pricing.service';
import { TaxiService } from '../../../shared/services/taxi.service';
import {
  WaConversation,
  WaMessage,
  EvolutionConfig,
  EvolutionConnectionState
} from '../../../shared/models/whatsapp.model';

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
  mobileView: 'list' | 'chat' = 'list';

  @HostListener('window:keydown.escape')
  handleEscapeKey(): void {
    if (this.showQrModal) this.closeQrModal();
    if (this.showQuoteHelper) this.closeQuoteHelper();
  }

  backToConversationsList(): void {
    this.mobileView = 'list';
  }

  // Atendente Ativa
  currentAttendant = 'Recepção (Thaina)';
  attendants = ['Recepção (Thaina)', 'Lucas (Motorista)', 'Atendimento Balcão'];

  // Input de Mensagem
  messageInput = '';

  // Gerador de Cotação Inteligente
  showQuoteHelper = false;
  quotePetName = 'Thor';
  quoteBreed = 'Golden Retriever';
  quoteWeightKg = 30;
  quoteService = 'Banho Completo';
  quoteSelectedExtras: string[] = ['desembolo'];
  quoteIncludeTaxi = true;
  quoteTaxiRegion = 'Condomínios Riacho Fundo / SMPW';

  // Evolution API: Conexão Real & QR Code
  evolutionConfig: EvolutionConfig;
  connectionState: EvolutionConnectionState = {
    connected: false,
    state: 'close',
    instanceName: 'syspet-oficial'
  };

  showQrModal = false;
  qrCodeBase64 = '';
  pairingCode = '';
  qrLoading = false;
  qrSecondsLeft = 45;
  qrCountdownTimer: any = null;
  pollStatusTimer: any = null;

  showConfigSettings = false;
  cfgApiUrl = '';
  cfgApiKey = '';
  cfgInstanceName = '';

  toastMessage = '';
  toastType: 'success' | 'danger' = 'success';

  constructor(
    private waService: WhatsappService,
    public pricingService: PricingService,
    private taxiService: TaxiService
  ) {
    this.evolutionConfig = this.waService.getConfig();
    this.cfgApiUrl = this.evolutionConfig.apiUrl;
    this.cfgApiKey = this.evolutionConfig.apiKey;
    this.cfgInstanceName = this.evolutionConfig.instanceName;
  }

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

    this.refreshConnectionState();
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private clearTimers(): void {
    if (this.qrCountdownTimer) {
      clearInterval(this.qrCountdownTimer);
      this.qrCountdownTimer = null;
    }
    if (this.pollStatusTimer) {
      clearInterval(this.pollStatusTimer);
      this.pollStatusTimer = null;
    }
  }

  refreshConnectionState(): void {
    this.waService.checkConnectionState().pipe(takeUntil(this.destroy$)).subscribe(state => {
      this.connectionState = state;
    });
  }

  // --- MODAL DE CONEXÃO & QR CODE EM TEMPO REAL ---

  openQrModal(): void {
    this.showQrModal = true;
    this.showConfigSettings = false;
    this.fetchQrCode();
    this.startConnectionPolling();
  }

  closeQrModal(): void {
    this.showQrModal = false;
    this.clearTimers();
  }

  fetchQrCode(): void {
    this.qrLoading = true;
    this.qrCodeBase64 = '';
    this.pairingCode = '';

    if (this.qrCountdownTimer) {
      clearInterval(this.qrCountdownTimer);
      this.qrCountdownTimer = null;
    }

    this.waService.getOrGenerateQrCode().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.qrLoading = false;
        if (res.base64) {
          this.qrCodeBase64 = res.base64;
          this.pairingCode = res.pairingCode || '';
          this.startQrCountdown();
        } else {
          // Pode já estar conectado
          this.refreshConnectionState();
        }
      },
      error: () => {
        this.qrLoading = false;
        this.showToast('Não foi possível conectar ao servidor Evolution API. Verifique a URL e chave.', 'danger');
      }
    });
  }

  private startQrCountdown(): void {
    this.qrSecondsLeft = 45;
    this.qrCountdownTimer = setInterval(() => {
      this.qrSecondsLeft--;
      if (this.qrSecondsLeft <= 0) {
        clearInterval(this.qrCountdownTimer);
        this.qrCountdownTimer = null;
        // Recarrega um QR Code fresco
        this.fetchQrCode();
      }
    }, 1000);
  }

  private startConnectionPolling(): void {
    if (this.pollStatusTimer) clearInterval(this.pollStatusTimer);

    // Consulta a cada 3 segundos se o aparelho foi escaneado
    this.pollStatusTimer = setInterval(() => {
      this.waService.checkConnectionState().pipe(takeUntil(this.destroy$)).subscribe(state => {
        this.connectionState = state;
        if (state.connected) {
          this.clearTimers();
          this.showToast('🎉 WhatsApp Comercial conectado com sucesso!', 'success');
          setTimeout(() => {
            this.closeQrModal();
          }, 1800);
        }
      });
    }, 3000);
  }

  disconnectWhatsapp(): void {
    if (!confirm('Deseja realmente desconectar o WhatsApp do pet shop? Será necessário escanear o QR Code novamente para reconectar.')) {
      return;
    }

    this.waService.disconnectInstance().pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.refreshConnectionState();
      this.showToast('WhatsApp desconectado. Gere um novo QR Code para parear outro aparelho.', 'success');
    });
  }

  saveCustomEvolutionSettings(): void {
    if (!this.cfgApiUrl || !this.cfgApiKey || !this.cfgInstanceName) {
      this.showToast('Preencha todos os campos de configuração da API.', 'danger');
      return;
    }

    const newConfig: EvolutionConfig = {
      apiUrl: this.cfgApiUrl.trim(),
      apiKey: this.cfgApiKey.trim(),
      instanceName: this.cfgInstanceName.trim()
    };

    this.waService.saveConfig(newConfig);
    this.evolutionConfig = newConfig;
    this.showConfigSettings = false;
    this.showToast('Configurações da Evolution API salvas com sucesso!', 'success');
    this.refreshConnectionState();
    this.fetchQrCode();
  }

  selectConversation(conv: WaConversation): void {
    this.selectedConversation = conv;
    this.waService.selectConversation(conv);
    this.mobileView = 'chat';
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

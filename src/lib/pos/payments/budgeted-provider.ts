import type { PaymentProvider } from './provider.ts';

// Charge the committed budget immediately before outbound work. Local reads,
// receipt recovery and finalization of confirmed payments remain available.
export function budgetedProvider(provider: PaymentProvider, consume: () => Promise<void>): PaymentProvider {
  return {
    id: provider.id,
    capabilities: provider.capabilities,
    createPayment: async id => { await consume(); return provider.createPayment(id); },
    getPayment: async id => { await consume(); return provider.getPayment(id); },
    ...(provider.cancelPayment ? { cancelPayment: async (id: string) => { await consume(); return provider.cancelPayment!(id); } } : {}),
    ...(provider.refundPayment ? { refundPayment: async (id: string) => { await consume(); return provider.refundPayment!(id); } } : {}),
    ...(provider.getRefund ? { getRefund: async (id: string) => { await consume(); return provider.getRefund!(id); } } : {}),
    ...(provider.verifyEvent ? { verifyEvent: provider.verifyEvent.bind(provider) } : {}),
  };
}

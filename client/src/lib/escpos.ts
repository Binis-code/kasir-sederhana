// ESC/POS peripheral integration & Customer Facing Display broadcast helpers

export type CustomerDisplayPayload = {
  storeName?: string;
  items: Array<{ name: string; qty: number; price: number; lineTotal: number }>;
  subtotal: number;
  discountTotal: number;
  total: number;
  paymentMethod?: string;
  isSuccess?: boolean;
  invoiceNo?: string;
  changeAmount?: number;
};

let displayChannel: BroadcastChannel | null = null;

export function getDisplayChannel(): BroadcastChannel {
  if (!displayChannel && typeof BroadcastChannel !== "undefined") {
    displayChannel = new BroadcastChannel("kiosnusa-customer-display");
  }
  return displayChannel!;
}

export function broadcastCustomerDisplay(payload: CustomerDisplayPayload) {
  try {
    const ch = getDisplayChannel();
    ch?.postMessage(payload);
  } catch {
    // ignore if broadcast not supported
  }
}

/**
 * Returns raw bytes to trigger standard RJ11 cash drawer kick pulse via thermal printer (ESC p 0 25 250)
 */
export function getCashDrawerKickCommand(): Uint8Array {
  return new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
}

class TradingDocksDOMException extends Error {
  public code = 0;

  constructor(message = '', name = 'Error') {
    super(message);
    this.name = name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function ensureRuntimeGlobals() {
  if (typeof globalThis.DOMException === 'undefined') {
    Object.defineProperty(globalThis, 'DOMException', {
      value: TradingDocksDOMException,
      writable: true,
      configurable: true,
    });
  }
}

ensureRuntimeGlobals();

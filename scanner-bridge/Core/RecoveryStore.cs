namespace TradingDocks.ScannerBridge;

// Implementations must atomically replace encrypted records and fail closed on
// corruption. Recovery metadata is temporary transport state, never inventory.
public interface IRecoveryStore
{
    byte[]? Read(string key);
    void Write(string key, byte[] value);
}

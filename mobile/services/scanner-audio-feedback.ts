export type ScannerAudioFeedbackOutcome = 'success' | 'review' | 'duplicate' | 'error';

export type ScannerAudioPlayer = {
  seekTo(seconds: number, toleranceMillisBefore?: number, toleranceMillisAfter?: number): Promise<void>;
  play(): void;
};

export type ScannerAudioFeedbackGate = {
  outcome: ScannerAudioFeedbackOutcome;
  audioConfirmation: boolean;
  audioEventKey: string | null;
  lastPlayedAudioEventKey: string | null;
};

export function shouldPlayScannerSuccessTone(input: ScannerAudioFeedbackGate): boolean {
  return input.audioConfirmation
    && input.outcome === 'success'
    && Boolean(input.audioEventKey)
    && input.audioEventKey !== input.lastPlayedAudioEventKey;
}

export async function playScannerSuccessTone(player: ScannerAudioPlayer | null | undefined): Promise<void> {
  if (!player) return;
  try {
    await player.seekTo(0, 0, 0);
  } catch {
    // The player is already preloaded by the production scanner; if seek fails,
    // we still try to play so the ding remains best-effort and low-latency.
  }
  player.play();
}

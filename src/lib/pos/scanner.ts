// Timing is a heuristic; the dedicated scan field also accepts slower scanners.
export function createScanner(onScan: (value: string) => void) {
  let buffer = ''; let last = 0;
  return (event: { key: string; timeStamp: number; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; isComposing?: boolean }, editing: boolean) => {
    if (editing || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) { buffer = ''; return; }
    if (event.key === 'Escape' || event.timeStamp - last > 80) buffer = '';
    last = event.timeStamp;
    if (event.key === 'Enter') {
      const value = buffer; buffer = '';
      if (value.length >= 4) onScan(value);
    } else if (event.key.length === 1) {
      buffer = (buffer + event.key).slice(-160);
    } else if (event.key === 'Backspace') buffer = buffer.slice(0, -1);
  };
}

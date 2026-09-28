"use client";

import { useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { TDButton } from "@/components/design-system/td-primitives";
import { cn } from "@/lib/utils";

export function UploadCardIntake({ disabled, disabledReason, onFiles, cards, staged, identified, processing, review }: {
  disabled: boolean;
  disabledReason?: string;
  onFiles: (files: File[]) => void;
  cards: number;
  staged: number;
  identified: number;
  processing: number;
  review: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return <section aria-label="Upload card scans" className="space-y-3">
    <div
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? "none" : "copy"; if (!disabled) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) onFiles(Array.from(event.dataTransfer.files)); }}
      className={cn("rounded-2xl border-2 border-dashed p-5 transition sm:p-6", dragging && !disabled ? "border-td-accent bg-td-accent/10" : "border-td-accent/30 bg-td-accent/[0.035]")}
      data-testid="card-image-dropzone"
    >
      <input ref={input} aria-label="Card front images" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} className="hidden" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) onFiles(files); }} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <CloudUpload aria-hidden="true" className="h-6 w-6 text-td-accent-text" />
          <h3 className="text-lg font-semibold text-td-primary"><span className="hidden sm:inline">Drop scanned card images here</span><span className="sm:hidden">Select card photos</span></h3>
          <p className="hidden text-sm text-td-secondary sm:block">or choose images from your computer</p>
          <p className="text-sm text-td-secondary">Upload the <strong>front</strong> of each card. One image = one physical card.</p>
          <p className="text-xs text-td-muted">JPG, JPEG, PNG or WebP · Up to 100 cards per batch · 3.9 MB per image</p>
        </div>
        <TDButton variant="secondary" disabled={disabled} className="w-full shrink-0 sm:w-auto" onClick={() => input.current?.click()}>Choose Card Images</TDButton>
      </div>
      {disabledReason && <p role="status" className="mt-3 text-sm text-td-secondary">{disabledReason}</p>}
    </div>
    <ol aria-label="Chaos Sort workflow" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-td-secondary">
      {["Upload", "Identify", "Review", "Add to Inventory"].map((step, index) => <li key={step}><span className="mr-1 text-td-accent-text">{index + 1}.</span>{step}</li>)}
    </ol>
    {(cards > 0 || staged > 0) && <p role="status" className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-td-secondary"><span>{cards + staged} cards</span>{staged > 0 && <span>{staged} awaiting identification</span>}<span>{identified} identified</span><span>{processing} processing</span><span>{review} need review</span></p>}
  </section>;
}

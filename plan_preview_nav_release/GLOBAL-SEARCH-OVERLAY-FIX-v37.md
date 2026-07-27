# Global Search Overlay Fix — v37

- Renders the global search overlay at the document root instead of inside the fixed dashboard header.
- Prevents the header border, blur, and stacking context from cutting through the open search panel.
- Uses an opaque page backdrop so dashboard content cannot visually bleed through the search experience.
- Raises the overlay above all dashboard navigation and workspace content.
- Keeps the search input, filters, sorting, and results inside one self-contained panel.
- Retains click-to-open, Ctrl/Cmd+K, Escape-to-close, autofocus, and background scroll locking.

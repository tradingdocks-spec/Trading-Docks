# Put-Away Queue Polish v31

- Added permanent delete controls to every queued inventory row.
- Reused the protected inventory-deletion confirmation flow.
- Kept filing as the primary row action and visually separated deletion.
- Improved drawer text contrast, spacing, and target sizes.
- Renamed the row action from `File` to `Choose location`.
- Added responsive row actions for narrower screens.
- Added accessible labels, focus treatment, and hover help for deletion.

Deleting is permanent and removes the complete inventory record. Choosing a
location keeps the record and files it into a binder, box, or other destination.

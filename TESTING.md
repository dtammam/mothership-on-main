# Testing

This project is a simple, self-contained web extension, so I have not set up a formal test framework. If it continues to expand, I will likely add unit tests and functional or integration tests. For now, there is not much to integrate beyond the browser environment itself.

Checklist

- Load the extension as unpacked and open a new tab; confirm the page renders without errors.
- Search: submit a query and verify it opens in the same tab.
- Links: click a link and verify it opens in the same tab; switch to Rearrange and move links/sections, then Finish.
- Customize: add a link, category, and search engine from the top pills; reorder links inside Customize.
- Import/export: export config, then import it; import quotes and confirm they replace existing lines.
- Backgrounds: switch between gradients, uploaded images, and blurred images; upload an image and confirm the dropdown switches to Uploaded images.

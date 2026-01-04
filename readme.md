# Mothership on Main

A Chromium-enabled home and new tab replacement with a built-in Customize panel for links, backgrounds, quotes, and search engines.

<table>
    <tr>
        <td align="center">
            <img src="images/Example.png" alt="Mothership on Main overview" width="520">
        </td>
        <td align="center">
            <img src="images/Customize.png" alt="Customize panel" width="520">
        </td>
    </tr>
</table>

The screenshots show the default starter links and layout shipped in the extension (not my personal URLs).

This repository started as a class project where I learned HTML, CSS, and JavaScript by building a basic version of this page. I asked Codex to refactor and modernize it, and I guided the structure, intent, and overall direction based on my prior iteration. I spent about an hour to an hour and a half tinkering with it, mostly through voice dictation in the terminal, and it was a blast. I didn't write any of the code directly; I reviewed and directed the changes and the agent implemented them.

The original inspiration came from a coworker pointing out that my clerical workflow was notably inefficient. I was inspired by [Toby](https://www.gettoby.com/) and [Momentum](https://chrome.google.com/webstore/detail/momentum/laookkfknpbbblfpciffpaejjkokdgca) for the literal functionality and took the opportunity to learn and see if I could make something like this for myself as a mini-project.

## Highlights

- New tab + home replacement with sections and rich link cards
- Built-in Customize panel for config, backgrounds, search engines, and quotes
- Favicon caching with overrides and a dynamic gradient background
- Drag to reorder sections and links, including cross-section moves

## Installation

1. Download this project in a location of your choosing

2. Open the extension and click `Customize` to manage links, images, quotes, and search engines.
    - Text config (links/quotes/search/sections) syncs via `chrome.storage.sync` across devices when available
    - Uploaded images and favicon overrides stay local, but export/import includes them
    - The default config lives in `config.json`

4. In Edge/Chrome, go to `Settings`, `Manage Extensions`, `Load Unpacked` and select the folder you downloaded
    - Once selected, you'll see it pop up in the list of extensions, enabled
    - Open a new tab to confirm that it worked

5. To modify in the future, open a new tab and click `Customize`. A store-published version for Chrome and Edge is coming soon.

## Usage

This extension does the following:
- Replaces your home page and new tab page
- Provides a config-backed multi-search window
- Displays feedback/motivational text/notes/etc. on page load
- Changes the background image on page load (including uploads)
- Allows for efficient web browser usage with custom links and favicon caching/overrides

## License

[MIT](license)

## Credits

Thank you Coursera, Dr. Chuck, Dr. van Lent and JMK for teaching me enough about HTML, CSS and JavaScript to be able to even consider trying to make something like this.
Thank you OpenAI for providing ChatGPT and thank you ChatGPT for being an amazing tutor with unlimited patience. 
Thanks JV for the feedback on my workflow and for triggering the idea.


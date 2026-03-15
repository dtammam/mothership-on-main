// "What's New" dialog — shows release highlights after an upgrade.
// Depends on: constants.js, storage.js, whats-new-content.js

// Checks whether the user has seen the current version's highlights.
// If not, shows the What's New dialog automatically after page load.
async function checkWhatsNew() {
    try {
        const version = await getManifestVersion();
        if (!version) return;

        const stored = await storageLocal.get(WHATS_NEW_LAST_SEEN_KEY);
        const lastSeen = stored[WHATS_NEW_LAST_SEEN_KEY];

        if (lastSeen !== version) {
            showWhatsNewDialog(version);
        }
    } catch (error) {
        // Fail closed — don't annoy the user if storage is unavailable.
        console.error("What's New check failed", error);
    }
}

// Reads the extension version from manifest.json.
async function getManifestVersion() {
    try {
        const res = await fetch("manifest.json");
        const manifest = await res.json();
        return manifest.version || null;
    } catch (error) {
        console.error("Failed to read manifest for What's New", error);
        return null;
    }
}

// Builds and displays the What's New modal dialog.
function showWhatsNewDialog(currentVersion) {
    // Don't stack if another overlay (bookmark picker, etc.) is already open.
    if (document.querySelector(".whats-new-overlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "whats-new-overlay";

    const dialog = document.createElement("div");
    dialog.className = "whats-new-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "Mothership Status Update");

    // Header
    const header = document.createElement("div");
    header.className = "whats-new-header";

    const title = document.createElement("h3");
    title.textContent = "Mothership Status Update";

    const closeBtn = document.createElement("button");
    closeBtn.className = "whats-new-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", () => dismissWhatsNew(overlay, currentVersion));

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Body — scrollable list of releases
    const body = document.createElement("div");
    body.className = "whats-new-body";

    for (let i = 0; i < WHATS_NEW_RELEASES.length; i++) {
        const release = WHATS_NEW_RELEASES[i];
        const isCurrentRelease = i === 0;

        const section = document.createElement("div");
        section.className = "whats-new-release";

        const versionHeader = document.createElement("button");
        versionHeader.type = "button";
        versionHeader.className = "whats-new-version";
        if (isCurrentRelease) versionHeader.classList.add("current");
        versionHeader.innerHTML = `<span>v${release.version} &mdash; ${release.date}</span><span class="whats-new-chevron">${isCurrentRelease ? "\u25B2" : "\u25BC"}</span>`;

        const items = document.createElement("div");
        items.className = "whats-new-items";
        if (!isCurrentRelease) items.classList.add("collapsed");

        for (const highlight of release.highlights) {
            const item = document.createElement("div");
            item.className = "whats-new-item";

            const itemTitle = document.createElement("strong");
            itemTitle.textContent = highlight.title;

            const itemDesc = document.createElement("span");
            itemDesc.textContent = ` \u2014 ${highlight.description}`;

            item.appendChild(itemTitle);
            item.appendChild(itemDesc);
            items.appendChild(item);
        }

        // Accordion toggle for non-current versions
        versionHeader.addEventListener("click", () => {
            const isCollapsed = items.classList.toggle("collapsed");
            versionHeader.querySelector(".whats-new-chevron").textContent = isCollapsed ? "\u25BC" : "\u25B2";
        });

        // Optional per-release footer note
        if (release.footer) {
            const note = document.createElement("p");
            note.className = "whats-new-release-note";
            note.textContent = release.footer;
            items.appendChild(note);
        }

        section.appendChild(versionHeader);
        section.appendChild(items);
        body.appendChild(section);
    }

    // Footer — feedback line + dismiss button
    const footer = document.createElement("div");
    footer.className = "whats-new-footer";

    const feedback = document.createElement("p");
    feedback.className = "whats-new-feedback";
    feedback.textContent = "Questions? Feedback? Comments? Reach out to Dean!";

    const gotItBtn = document.createElement("button");
    gotItBtn.type = "button";
    gotItBtn.className = "whats-new-got-it";
    gotItBtn.textContent = "Got it";
    gotItBtn.addEventListener("click", () => dismissWhatsNew(overlay, currentVersion));

    footer.appendChild(feedback);
    footer.appendChild(gotItBtn);

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);

    // Close on overlay click (outside the dialog)
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) dismissWhatsNew(overlay, currentVersion);
    });

    // Close on Escape key
    const escHandler = (e) => {
        if (e.key === "Escape") {
            dismissWhatsNew(overlay, currentVersion);
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);

    document.body.appendChild(overlay);
}

// Removes the dialog and records the version as seen.
async function dismissWhatsNew(overlay, version) {
    overlay.remove();
    try {
        await storageLocal.set({ [WHATS_NEW_LAST_SEEN_KEY]: version });
    } catch (error) {
        console.error("Failed to save What's New last-seen version", error);
    }
}

// Opens the What's New dialog on demand (e.g., from settings menu).
async function openWhatsNew() {
    const version = await getManifestVersion();
    showWhatsNewDialog(version || "unknown");
}

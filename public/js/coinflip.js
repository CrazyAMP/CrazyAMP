(() => {
        /* ==========================================
           COINFLIP ELEMENTS
        =========================================== */

        const siteToastRegion = document.getElementById("siteToastRegion");

        function showToast(message, type = "success") {
            if (!siteToastRegion) return;

            const toast = document.createElement("div");
            toast.className = `site-toast ${type}`;
            toast.innerHTML = `<span>${type === "error" ? "!" : "✓"}</span><p>${escapeHtml(message)}</p>`;
            siteToastRegion.appendChild(toast);

            window.setTimeout(() => {
                toast.classList.add("leaving");
                window.setTimeout(() => toast.remove(), 220);
            }, 3600);
        }


        const coinflipModal =
            document.getElementById("coinflipModal");

        const coinflipModalOverlay =
            document.getElementById("coinflipModalOverlay");

        const coinflipModalClose =
            document.getElementById("coinflipModalClose");

        const createMatchButton =
            document.getElementById("createMatchButton");

        const coinflipCancelButton =
            document.getElementById("coinflipCancelButton");

        const coinflipConfirmButton =
            document.getElementById("coinflipConfirmButton");

        const emptyCreateMatchButton =
            document.getElementById("emptyCreateMatchButton");

        const coinflipInventory =
            document.getElementById("coinflipInventory");

        const coinflipSelectAll =
            document.getElementById("coinflipSelectAll");

        const coinflipSelectedCount =
            document.getElementById("coinflipSelectedCount");

        const coinflipSelectedValue =
            document.getElementById("coinflipSelectedValue");

        const coinflipJoinRange =
            document.getElementById("coinflipJoinRange");

        const coinflipHeadsButton =
            document.getElementById("coinflipHeadsButton");

        const coinflipTailsButton =
            document.getElementById("coinflipTailsButton");

        const coinflipMaxJoinPets =
            document.getElementById("coinflipMaxJoinPets");

        const openMatchesCount =
            document.getElementById("openMatchesCount");

        const totalWageredValue =
            document.getElementById("totalWageredValue");

        const coinflipMatches =
            document.getElementById("coinflipMatches");

        const navbarInventoryValue =
            document.getElementById("navbarInventoryValue");

        const coinflipGameModal =
            document.getElementById("coinflipGameModal");

        const coinflipGameModalOverlay =
            document.getElementById("coinflipGameModalOverlay");

        const coinflipGameClose =
            document.getElementById("coinflipGameClose");

        const coinflipGameDetails =
            document.getElementById("coinflipGameDetails");

        const coinflipJoinModal =
            document.getElementById("coinflipJoinModal");

        const coinflipJoinModalOverlay =
            document.getElementById("coinflipJoinModalOverlay");

        const coinflipJoinClose =
            document.getElementById("coinflipJoinClose");

        const coinflipJoinInventory =
            document.getElementById("coinflipJoinInventory");

        const coinflipJoinRangeText =
            document.getElementById("coinflipJoinRangeText");

        const coinflipJoinValue =
            document.getElementById("coinflipJoinValue");

        const coinflipJoinPayout =
            document.getElementById("coinflipJoinPayout");

        const coinflipJoinConfirm =
            document.getElementById("coinflipJoinConfirm");

        const coinflipJoinSelectAll =
            document.getElementById("coinflipJoinSelectAll");


        let coinflipInventoryItems = [];

        let coinflipSelectedItems =
            new Set();

        let coinflipSelectedQuantities =
            new Map();

        let coinflipSelectedSide = null;

        let loadedCoinflipMatches = [];

        let joiningMatch = null;
        let joinInventoryItems = [];
        let selectedJoinItems = new Map();

        const currentViewer = window.CrazyAMPCoinflipViewer || {
            username: "You",
            avatar: ""
        };


        /* ==========================================
           HELPERS
        =========================================== */

        function formatValue(value) {

            const number =
                Number(value) || 0;

            return number.toLocaleString("en-US");

        }


        function getInventoryId(item, index) {

            return (
                item.inventory_id ||
                item.inventoryId ||
                item.id ||
                `inventory-${index}`
            );

        }


        function getItemValue(item) {

            return Number(item.value) || 0;

        }


        function getItemQuantity(item) {

            return Math.max(
                1,
                Number(item.quantity) || 1
            );

        }


        function escapeHtml(value) {

            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

        }


        function escapeAttribute(value) {

            return escapeHtml(value);

        }


        /* ==========================================
           OPEN / CLOSE CREATE MODAL
        =========================================== */

        function openCoinflipModal() {

            if (!coinflipModal) {
                return;
            }

            coinflipSelectedItems =
                new Set();

            coinflipSelectedQuantities =
                new Map();

            coinflipSelectedSide =
                null;

            if (coinflipMaxJoinPets) coinflipMaxJoinPets.value = "3";

            updateSideSelection();

            updateCoinflipSummary();

            coinflipModal.classList.add("open");

            document.body.classList.add(
                "coinflip-modal-open"
            );

            loadCoinflipInventory();

        }


        function closeCoinflipModal() {

            if (!coinflipModal) {
                return;
            }

            coinflipModal.classList.remove("open");

            document.body.classList.remove(
                "coinflip-modal-open"
            );

        }


        if (createMatchButton) {

            createMatchButton.addEventListener(
                "click",
                openCoinflipModal
            );

        }


        if (emptyCreateMatchButton) {

            emptyCreateMatchButton.addEventListener(
                "click",
                openCoinflipModal
            );

        }


        if (coinflipModalClose) {

            coinflipModalClose.addEventListener(
                "click",
                closeCoinflipModal
            );

        }


        if (coinflipCancelButton) {

            coinflipCancelButton.addEventListener(
                "click",
                closeCoinflipModal
            );

        }


        if (coinflipModalOverlay) {

            coinflipModalOverlay.addEventListener(
                "click",
                closeCoinflipModal
            );

        }


        document.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Escape" &&
                    coinflipModal &&
                    coinflipModal.classList.contains("open")
                ) {

                    closeCoinflipModal();

                }

            }
        );


        /* ==========================================
           SIDE SELECTION
        =========================================== */

        function updateSideSelection() {

            if (coinflipHeadsButton) {

                coinflipHeadsButton.classList.toggle(
                    "selected",
                    coinflipSelectedSide === "heads"
                );

            }


            if (coinflipTailsButton) {

                coinflipTailsButton.classList.toggle(
                    "selected",
                    coinflipSelectedSide === "tails"
                );

            }

        }


        if (coinflipHeadsButton) {

            coinflipHeadsButton.addEventListener(
                "click",
                () => {

                    coinflipSelectedSide =
                        "heads";

                    updateSideSelection();

                    updateCoinflipSummary();

                }
            );

        }


        if (coinflipTailsButton) {

            coinflipTailsButton.addEventListener(
                "click",
                () => {

                    coinflipSelectedSide =
                        "tails";

                    updateSideSelection();

                    updateCoinflipSummary();

                }
            );

        }


        /* ==========================================
           LOAD COINFLIP INVENTORY
        =========================================== */

        async function loadCoinflipInventory() {

            if (!coinflipInventory) {
                return;
            }

            coinflipInventory.innerHTML = `
                <div class="coinflip-inventory-loading">

                    <div class="coinflip-loading-spinner"></div>

                    Loading inventory...

                </div>
            `;


            try {

                const response =
                    await fetch(
                        "/api/inventory/"
                    );


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.error ||
                        "Failed to load inventory."
                    );

                }


                coinflipInventoryItems =
                    Array.isArray(
                        data.inventory?.items
                    )
                        ? data.inventory.items
                        : [];


                if (navbarInventoryValue) {

                    navbarInventoryValue.textContent =
                        formatValue(
                            data.inventory?.totalValue || 0
                        );

                }


                renderCoinflipInventory();

            } catch (error) {

                console.error(
                    "Coinflip inventory error:",
                    error
                );


                coinflipInventory.innerHTML = `
                    <div class="coinflip-inventory-empty">

                        <div class="coinflip-inventory-empty-icon">
                            ⚠️
                        </div>

                        <strong>
                            Unable to load inventory
                        </strong>

                        <span>
                            Please close this window and try again.
                        </span>

                    </div>
                `;

            }

        }


        /* ==========================================
           RENDER COINFLIP INVENTORY
        =========================================== */

        function renderCoinflipInventory() {
            if (!coinflipInventory) return;

            if (!coinflipInventoryItems.length) {
                coinflipInventory.innerHTML = `
                    <div class="coinflip-inventory-empty">
                        <div class="coinflip-inventory-empty-icon">🐾</div>
                        <strong>Your inventory is empty</strong>
                        <span>Deposit Adopt Me pets before creating a Coinflip match.</span>
                    </div>`;
                updateCoinflipSummary();
                return;
            }

            const cards = [];
            coinflipInventoryItems.forEach((item, index) => {
                const inventoryId = getInventoryId(item, index);
                const quantity = getItemQuantity(item);
                const value = getItemValue(item);
                const selectedQuantity = Number(coinflipSelectedQuantities.get(inventoryId)) || 0;

                for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
                    const selected = selectedQuantity > unitIndex;
                    const unitLabel = quantity > 1 ? ` #${unitIndex + 1}` : "";
                    cards.push(`
                        <button type="button"
                            class="coinflip-inventory-item coinflip-individual-pet ${selected ? "selected" : ""}"
                            data-inventory-id="${escapeAttribute(inventoryId)}"
                            data-unit-index="${unitIndex}"
                            aria-pressed="${selected}"
                            title="${escapeAttribute(item.name || "Pet")}${unitLabel} — click to ${selected ? "remove" : "add"}">
                            <span class="coinflip-item-check">${selected ? "✓" : "+"}</span>
                            <span class="coinflip-item-quantity">${unitLabel || "Individual"}</span>
                            <span class="coinflip-item-image-wrap">
                                ${item.image ? `<img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.name || "Pet")}" class="coinflip-item-image" onerror="this.style.visibility='hidden';">` : "🐾"}
                            </span>
                            <span class="coinflip-item-name">${escapeHtml(item.name || "Unknown Pet")}</span>
                            <span class="coinflip-item-value">💎 ${formatValue(value)}</span>
                        </button>`);
                }
            });

            coinflipInventory.innerHTML = cards.join("");
            coinflipInventory.querySelectorAll(".coinflip-individual-pet").forEach((element) => {
                element.addEventListener("click", () => {
                    const id = element.dataset.inventoryId;
                    const unitIndex = Number(element.dataset.unitIndex) || 0;
                    const current = Number(coinflipSelectedQuantities.get(id)) || 0;
                    coinflipSelectedQuantities.set(id, current > unitIndex ? unitIndex : unitIndex + 1);
                    renderCoinflipInventory();
                    updateCoinflipSummary();
                });
            });
        }


        /* ==========================================
           MATCH CARD
        =========================================== */

        function getSelectedInventoryItems() {

            return coinflipInventoryItems
                .map((item, index) => ({
                    ...item,
                    quantity: Number(coinflipSelectedQuantities.get(getInventoryId(item, index))) || 0
                }))
                .filter((item) => item.quantity > 0);

        }


        function getSelectedWagerValue() {

            return getSelectedInventoryItems()
                .reduce(
                    (total, item) => {

                        const quantity =
                            getItemQuantity(item);

                        const value =
                            getItemValue(item);

                        return total +
                            (value * quantity);

                    },
                    0
                );

        }


        /* ==========================================
           UPDATE SUMMARY
        =========================================== */

        function updateCoinflipSummary() {

            const selectedItems =
                getSelectedInventoryItems();


            const selectedValue =
                getSelectedWagerValue();


            const selectedCount =
                selectedItems.reduce(
                    (total, item) =>
                        total +
                        getItemQuantity(item),
                    0
                );


            if (coinflipSelectedCount) {

                coinflipSelectedCount.textContent =
                    formatValue(selectedCount);

            }


            if (coinflipSelectedValue) {

                coinflipSelectedValue.textContent =
                    `💎 ${formatValue(selectedValue)}`;

            }


            if (coinflipJoinRange) {

                if (selectedValue > 0) {

                    const minimum =
                        Math.floor(
                            selectedValue * 0.95
                        );


                    const maximum =
                        Math.ceil(
                            selectedValue * 1.05
                        );


                    coinflipJoinRange.textContent =
                        `💎 ${formatValue(minimum)} - 💎 ${formatValue(maximum)}`;

                } else {

                    coinflipJoinRange.textContent =
                        "💎 0 - 💎 0";

                }

            }


            if (coinflipConfirmButton) {

                coinflipConfirmButton.disabled =
                    selectedItems.length === 0 ||
                    !coinflipSelectedSide;

            }

        }


        /* ==========================================
           CREATE MATCH
        =========================================== */

        if (coinflipConfirmButton) {

            coinflipConfirmButton.addEventListener(
                "click",
                async () => {

                    const selectedItems =
                        getSelectedInventoryItems();


                    if (!selectedItems.length) {

                        showToast("Please select at least one pet.", "error");

                        return;

                    }


                    if (!coinflipSelectedSide) {

                        showToast("Please choose Heads or Tails.", "error");

                        return;

                    }


                    const maxJoinPets = Number(coinflipMaxJoinPets?.value);

                    if (!Number.isInteger(maxJoinPets) || maxJoinPets < 1 || maxJoinPets > 100) {
                        showToast("Choose a maximum of 1 to 100 pets.", "error");
                        return;
                    }


                    coinflipConfirmButton.disabled =
                        true;

                    coinflipConfirmButton.textContent =
                        "Creating...";


                    try {

                        const items =
                            selectedItems.map(
                                (item) => ({

                                    inventoryId:
                                        item.inventory_id ||
                                        item.inventoryId ||
                                        item.id,

                                    quantity:
                                        getItemQuantity(item)

                                })
                            );


                        const response =
                            await fetch(
                                "/api/coinflip/create",
                                {
                                    method: "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },

                                    body:
                                        JSON.stringify({
                                            items,

                                            creatorChoice:
                                                coinflipSelectedSide,
                                            maxJoinPets
                                        })
                                }
                            );


                        const data =
                            await response.json();


                        if (
                            !response.ok ||
                            !data.success
                        ) {

                            throw new Error(
                                data.error ||
                                "Failed to create match."
                            );

                        }


                        closeCoinflipModal();


                        await loadCoinflipMatches();


                        if (
                            window.AdoptMeInventory &&
                            typeof window.AdoptMeInventory.refresh ===
                                "function"
                        ) {

                            await window.AdoptMeInventory.refresh();

                        }


                        showToast("Coinflip match created!");


                    } catch (error) {

                        console.error(
                            "Create match error:",
                            error
                        );


                        showToast(error.message || "Failed to create match.", "error");


                    } finally {

                        coinflipConfirmButton.disabled =
                            false;

                        coinflipConfirmButton.textContent =
                            "Create Match";

                        updateCoinflipSummary();

                    }

                }
            );

        }


        /* ==========================================
           LOAD MATCHES
        =========================================== */

        async function loadCoinflipMatches() {

            if (!coinflipMatches) {
                return;
            }


            try {

                const response =
                    await fetch(
                        "/api/coinflip/"
                    );


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.error ||
                        "Failed to load matches."
                    );

                }


                const matches =
                    Array.isArray(data.matches)
                        ? data.matches
                        : [];

                loadedCoinflipMatches = matches;


                updateCoinflipStats(matches);

                renderCoinflipMatches(matches);


            } catch (error) {

                console.error(
                    "Coinflip matches error:",
                    error
                );

            }

        }


        /* ==========================================
           MATCH STATS
        =========================================== */

        function updateCoinflipStats(matches) {

            if (openMatchesCount) {

                openMatchesCount.textContent =
                    matches.length;

            }


            const total =
                matches.reduce(
                    (sum, match) => {

                        return sum +
                            Number(
                                match.creator_value ??
                                match.creatorValue ??
                                match.wager ??
                                0
                            );

                    },
                    0
                );


            if (totalWageredValue) {

                totalWageredValue.textContent =
                    `💎 ${formatValue(total)}`;

            }

        }


        /* ==========================================
           RENDER MATCHES
        =========================================== */

        function renderCoinflipMatches(matches) {

            if (!coinflipMatches) {
                return;
            }


            if (!matches.length) {

                coinflipMatches.innerHTML = `
                    <div class="matches-empty">

                        <div class="matches-empty-icon">
                            🪙
                        </div>

                        <h3>
                            No open matches
                        </h3>

                        <p>
                            Create a match and be the first player to start a coinflip.
                        </p>

                        <button
                            type="button"
                            class="create-match-button empty-create-button"
                            id="emptyCreateMatchButton"
                        >

                            <span>
                                +
                            </span>

                            Create Match

                        </button>

                    </div>
                `;


                const button =
                    document.getElementById(
                        "emptyCreateMatchButton"
                    );


                if (button) {

                    button.addEventListener(
                        "click",
                        openCoinflipModal
                    );

                }


                return;

            }


            coinflipMatches.innerHTML =
                matches
                    .map(
                        (match) =>
                            renderMatchCard(match)
                    )
                    .join("");


            coinflipMatches
                .querySelectorAll(
                    ".coinflip-cancel-match-button"
                )
                .forEach((button) => {

                    button.addEventListener(
                        "click",
                        () =>
                            cancelCoinflipMatch(
                                button.dataset.matchId
                            )
                    );

                });


            coinflipMatches
                .querySelectorAll(
                    ".coinflip-view-match-button"
                )
                .forEach((button) => {

                    button.addEventListener(
                        "click",
                        () => openGameView(
                            button.dataset.matchId
                        )
                    );

                });


            coinflipMatches
                .querySelectorAll(
                    ".coinflip-join-match-button"
                )
                .forEach((button) => {

                    button.addEventListener(
                        "click",
                        () => {

                            const matchId =
                                button.dataset.matchId;

                            openJoinMatch(matchId);

                        }
                    );

                });

        }


        /* ==========================================
           MATCH CARD
        =========================================== */

        function renderMatchCard(match) {

            const creatorName =
                match.creator_username ??
                match.creatorUsername ??
                match.roblox_username ??
                match.robloxUsername ??
                match.creator_display_name ??
                match.creatorDisplayName ??
                "Player";


            const avatar =
                match.creator_avatar_url ??
                match.creatorAvatarUrl ??
                match.creator_avatar ??
                match.creatorAvatar ??
                match.avatar_url ??
                match.avatarUrl ??
                match.avatar ??
                "";


            const choice =
                String(
                    match.creator_choice ??
                    match.creatorChoice ??
                    "heads"
                ).toLowerCase();


            const wager =
                Number(
                    match.creator_value ??
                    match.creatorValue ??
                    match.wager ??
                    0
                );


            const minimum =
                Number(
                    match.min_join_value ??
                    match.minJoinValue ??
                    Math.floor(
                        wager * 0.95
                    )
                );


            const maximum =
                Number(
                    match.max_join_value ??
                    match.maxJoinValue ??
                    Math.ceil(
                        wager * 1.05
                    )
                );


            /*
                IMPORTANT:
                We no longer put EJS inside the JavaScript.

                The logged-in user ID is stored on the
                body element as data-user-id.
            */

            const currentUserId =
                document.body.dataset.userId ||
                null;


            const matchCreatorId =
                match.creator_id ??
                match.creatorId ??
                "";


            const isCreator =
                Boolean(
                    match.is_creator ??
                    match.isCreator
                ) ||
                (
                    currentUserId &&
                    String(matchCreatorId) ===
                    String(currentUserId)
                );


            const avatarHTML =
                avatar
                    ? `
                        <img
                            src="${escapeAttribute(avatar)}"
                            alt=""
                            onerror="this.style.display='none'; this.parentElement.classList.add('avatar-failed');"
                        >
                    `
                    : `
                        ${escapeHtml(
                            creatorName
                                .charAt(0)
                                .toUpperCase()
                        )}
                    `;


            const pets =
                Array.isArray(match.pets)
                    ? match.pets
                    : [];


            // Expand stacked inventory quantities into separate visual pet cards.
            // The database may store 8 identical pets as one row with quantity: 8,
            // but the UI should show eight individual cards instead of "×8".
            const individualPreviewPets = pets.flatMap((pet) => {
                const quantity = Math.max(1, Number(pet.quantity) || 1);
                return Array.from({ length: quantity }, (_, index) => ({
                    ...pet,
                    quantity: 1,
                    individualIndex: index + 1
                }));
            });

            const petPreviewHTML =
                individualPreviewPets.length
                    ? individualPreviewPets.map((pet) => {
                        const name = pet.name || "Wagered pet";
                        return `
                            <div
                                class="coinflip-wager-pet${pet.image ? "" : " image-missing"}"
                                title="${escapeAttribute(name)}"
                            >
                                ${pet.image ? `
                                    <img
                                        src="${escapeAttribute(pet.image)}"
                                        alt="${escapeAttribute(name)}"
                                        onerror="this.style.display='none'; this.parentElement.classList.add('image-missing');"
                                    >
                                ` : ""}
                                <span class="coinflip-wager-pet-fallback">🐾</span>
                            </div>
                        `;
                    }).join("")
                    : `
                        <div class="coinflip-wager-pet coinflip-wager-pet-empty">
                            <span>🐾</span>
                        </div>
                    `;

            const remainingPets = 0;


            const primaryActionHTML =
                isCreator
                    ? `
                        <button
                            type="button"
                            class="coinflip-cancel-match-button"
                            data-match-id="${escapeAttribute(match.id)}"
                        >
                            Cancel Match
                        </button>
                    `
                    : `
                        <button
                            type="button"
                            class="coinflip-join-match-button"
                            data-match-id="${escapeAttribute(match.id)}"
                        >
                            Join Match
                        </button>
                    `;


            const actionHTML = `
                ${primaryActionHTML}
                <button
                    type="button"
                    class="coinflip-view-match-button"
                    data-match-id="${escapeAttribute(match.id)}"
                >
                    View Game
                </button>
            `;


            return `
                <article class="coinflip-match-card">

                    <div class="coinflip-match-duel">

                        <div class="coinflip-match-contender">
                            <div class="coinflip-match-avatar">
                                ${avatarHTML}
                            </div>
                            <span class="coinflip-match-choice">
                                ${escapeHtml(choice)}
                            </span>
                        </div>

                        <span class="coinflip-match-versus">VS</span>

                        <div class="coinflip-match-contender coinflip-match-waiting">
                            <div class="coinflip-match-avatar">?</div>
                            <span>Waiting</span>
                        </div>

                    </div>


                    <div class="coinflip-match-wager">

                        <div class="coinflip-wager-pets">
                            ${petPreviewHTML}
                            ${
                                remainingPets
                                    ? `<span class="coinflip-wager-more">+${remainingPets}</span>`
                                : ""
                            }
                        </div>

                        <strong class="coinflip-match-value">
                            💎 ${formatValue(wager)}
                        </strong>

                    </div>


                    <div class="coinflip-match-actions">

                        ${actionHTML}

                    </div>

                </article>
            `;

        }


        /* ==========================================
           CANCEL MATCH
        =========================================== */

        async function cancelCoinflipMatch(matchId) {

            if (!matchId) {
                return;
            }


            try {

                const response =
                    await fetch(
                        `/api/coinflip/${encodeURIComponent(matchId)}/cancel`,
                        {
                            method: "POST"
                        }
                    );


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.error ||
                        "Failed to cancel match."
                    );

                }


                await loadCoinflipMatches();

                showToast("Match cancelled — your pets are back in your inventory.");


                if (
                    window.AdoptMeInventory &&
                    typeof window.AdoptMeInventory.refresh ===
                        "function"
                ) {

                    await window.AdoptMeInventory.refresh();

                }


            } catch (error) {

                console.error(
                    "Cancel match error:",
                    error
                );


                showToast(error.message || "Failed to cancel match.", "error");

            }

        }


        /* ==========================================
           JOIN MATCH
        =========================================== */

        function openJoinMatch(matchId) {

            const match = loadedCoinflipMatches.find(
                (item) => String(item.id) === String(matchId)
            );

            if (!match || !coinflipJoinModal) {
                return;
            }

            joiningMatch = match;
            selectedJoinItems = new Map();

            if (coinflipJoinRangeText) {
                coinflipJoinRangeText.textContent =
                    `Your wager must be between 💎 ${formatValue(match.min_join_value)} and 💎 ${formatValue(match.max_join_value)}.`;
            }

            coinflipJoinModal.classList.add("open");
            coinflipJoinModal.setAttribute("aria-hidden", "false");
            document.body.classList.add("coinflip-game-modal-open");

            loadJoinInventory();

        }


        /* ==========================================
           LIVE COMMUNITY CHAT
        =========================================== */

        function escapeChat(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }


        function renderChatMessage(chatMessage) {
            if (!chatMessages || !chatMessage) return;

            const empty = chatMessages.querySelector(".chat-empty");
            if (empty) empty.remove();

            const ownerClass = chatMessage.owner ? " chat-message-owner" : "";
            const username = String(chatMessage.username || "User");
            const initials = username.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
            const avatarUrl = String(chatMessage.avatarUrl || chatMessage.avatar_url || "").trim();
            const avatarMarkup = avatarUrl
                ? `<img src="${escapeChat(avatarUrl)}" alt="${escapeChat(username)} avatar" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.hidden=false;">`
                : "";
            const avatarFallback = `<span class="chat-avatar-fallback"${avatarUrl ? " hidden" : ""}>${escapeChat(initials)}</span>`;
            const crown = chatMessage.owner ? " <span class=\"chat-owner-crown\" aria-label=\"Owner\">👑</span>" : "";
            const createdAt = new Date(chatMessage.createdAt);
            const time = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const fullDate = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
            const message = document.createElement("article");

            message.className = `chat-message${ownerClass}`;
            message.innerHTML = `
                <div class="chat-message-avatar" aria-label="${escapeChat(username)} avatar">${avatarMarkup}${avatarFallback}</div>
                <div class="chat-message-content">
                    <div class="chat-message-header">
                        <strong>${escapeChat(username)}${crown}</strong>
                        <time datetime="${escapeChat(chatMessage.createdAt || "")}" title="${escapeChat(fullDate)}">${escapeChat(time)}</time>
                    </div>
                    <p class="chat-message-text">${escapeChat(chatMessage.message)}</p>
                </div>
            `;

            chatMessages.appendChild(message);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }


        if (typeof io === "function") {
            const chatSocket = io();

            chatSocket.on("connect", () => {
                if (chatInput) chatInput.disabled = false;
                if (chatSendButton) chatSendButton.disabled = false;
            });

            chatSocket.on("disconnect", () => {
                if (chatOnline) chatOnline.textContent = "Reconnecting...";
            });

            chatSocket.on("chat:history", (messages) => {
                if (!chatMessages || !Array.isArray(messages)) return;
                chatMessages.innerHTML = "";
                messages.forEach(renderChatMessage);
            });

            chatSocket.on("chat:message", renderChatMessage);

            chatSocket.on("chat:online", (count) => {
                if (chatOnline) {
                    chatOnline.textContent = `${Number(count) || 0} online`;
                }
            });

            chatSocket.on("chat:error", (message) => {
                if (chatInput) chatInput.placeholder = message;
            });

            chatSocket.on("chat:notice", (notice) => {
                if (!chatMessages) return;

                const empty = chatMessages.querySelector(".chat-empty");
                if (empty) empty.remove();

                const message = document.createElement("p");
                message.className = "chat-command-notice";
                message.textContent = notice;
                chatMessages.appendChild(message);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });

            const sendChatMessage = () => {
                const message = chatInput?.value.trim();
                if (!message) return;
                chatSocket.emit("chat:send", message);
                chatInput.value = "";
            };

            if (chatSendButton) {
                chatSendButton.addEventListener("click", sendChatMessage);
            }

            if (chatInput) {
                chatInput.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        sendChatMessage();
                    }
                });
            }
        }


        function closeJoinMatch() {

            if (!coinflipJoinModal) {
                return;
            }

            coinflipJoinModal.classList.remove("open");
            coinflipJoinModal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("coinflip-game-modal-open");
            joiningMatch = null;

        }


        function getJoinValue() {

            return joinInventoryItems.reduce(
                (total, item) => total +
                    (Number(item.value) || 0) *
                    (Number(selectedJoinItems.get(String(item.id))) || 0),
                0
            );

        }


        function renderJoinInventory() {
            if (!coinflipJoinInventory || !joiningMatch) return;

            if (!joinInventoryItems.length) {
                coinflipJoinInventory.innerHTML = "<p class=\"coinflip-game-empty\">You do not have any available pets to wager.</p>";
                return;
            }

            const cards = [];
            joinInventoryItems.forEach((item) => {
                const itemId = String(item.id);
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const selectedQuantity = Number(selectedJoinItems.get(itemId)) || 0;
                const name = item.name || "Pet";

                for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
                    const selected = selectedQuantity > unitIndex;
                    const unitLabel = quantity > 1 ? ` #${unitIndex + 1}` : "";
                    cards.push(`
                        <button type="button" class="coinflip-join-pet coinflip-individual-pet ${selected ? "selected" : ""}"
                            data-inventory-id="${escapeAttribute(itemId)}"
                            data-unit-index="${unitIndex}"
                            aria-pressed="${selected}"
                            title="${escapeAttribute(name)}${unitLabel} — click to ${selected ? "remove" : "add"}">
                            <span class="coinflip-join-check" aria-hidden="true">${selected ? "✓" : "+"}</span>
                            <span class="coinflip-join-stock">${unitLabel || "Individual"}</span>
                            <div class="coinflip-join-pet-image">${item.image ? `<img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(name)}">` : "<span>🐾</span>"}</div>
                            <strong>${escapeHtml(name)}</strong>
                            <span class="coinflip-join-pet-value">💎 ${formatValue(item.value)}</span>
                        </button>`);
                }
            });

            coinflipJoinInventory.innerHTML = cards.join("");
            coinflipJoinInventory.querySelectorAll(".coinflip-join-pet").forEach((card) => {
                card.addEventListener("click", () => {
                    const itemId = card.dataset.inventoryId;
                    const unitIndex = Number(card.dataset.unitIndex) || 0;
                    const current = Number(selectedJoinItems.get(itemId)) || 0;
                    const next = current > unitIndex ? unitIndex : unitIndex + 1;
                    const selectedOtherPets = Array.from(selectedJoinItems.entries()).reduce((total, [id, quantity]) => total + (id === itemId ? 0 : (Number(quantity) || 0)), 0);
                    const maxJoinPets = Number(joiningMatch?.max_join_pets) || 0;
                    if (next > current && maxJoinPets > 0 && selectedOtherPets + next > maxJoinPets) {
                        showToast(`You can join with up to ${maxJoinPets} pets.`, "error");
                        return;
                    }
                    selectedJoinItems.set(itemId, next);
                    renderJoinInventory();
                    updateJoinSummary();
                });
            });
        }


        function updateJoinSummary() {

            const value = getJoinValue();
            const minimum = Number(joiningMatch?.min_join_value) || 0;
            const maximum = Number(joiningMatch?.max_join_value) || 0;

            if (coinflipJoinRangeText) {
                const maxPets = Number(joiningMatch?.max_join_pets) || 0;
                coinflipJoinRangeText.textContent = maxPets > 0
                    ? `Wager ${formatValue(minimum)} - ${formatValue(maximum)} · Maximum ${maxPets} pets`
                    : `Wager ${formatValue(minimum)} - ${formatValue(maximum)}`;
            }

            if (coinflipJoinValue) {
                coinflipJoinValue.textContent = `💎 ${formatValue(value)}`;
            }

            if (coinflipJoinPayout) {
                const totalPot = (Number(joiningMatch?.creator_value) || 0) + value;
                const taxRate = Number(joiningMatch?.tax_rate) || 10;
                const tax = Math.floor(totalPot * taxRate / 100);
                coinflipJoinPayout.textContent = `💎 ${formatValue(totalPot - tax)}`;
            }

            const selectedPetCount = Array.from(selectedJoinItems.values()).reduce((total, quantity) => total + (Number(quantity) || 0), 0);
            const maxJoinPets = Number(joiningMatch?.max_join_pets) || 0;

            if (coinflipJoinConfirm) {
                coinflipJoinConfirm.disabled =
                    !Array.from(selectedJoinItems.values()).some((quantity) => quantity > 0) ||
                    value < minimum ||
                    value > maximum ||
                    (maxJoinPets > 0 && selectedPetCount > maxJoinPets);
            }

        }


        async function loadJoinInventory() {

            if (!coinflipJoinInventory) {
                return;
            }

            coinflipJoinInventory.innerHTML = "<p class=\"coinflip-game-empty\">Loading available pets...</p>";

            try {
                const response = await fetch("/api/inventory/");
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Failed to load inventory.");
                }

                joinInventoryItems = data.inventory?.items || [];
                renderJoinInventory();
                updateJoinSummary();

            } catch (error) {
                coinflipJoinInventory.innerHTML =
                    `<p class="coinflip-game-empty">${escapeHtml(error.message || "Failed to load inventory.")}</p>`;
            }

        }


        if (coinflipJoinClose) {
            coinflipJoinClose.addEventListener("click", closeJoinMatch);
        }

        if (coinflipJoinModalOverlay) {
            coinflipJoinModalOverlay.addEventListener("click", closeJoinMatch);
        }

        if (coinflipJoinConfirm) {
            coinflipJoinConfirm.addEventListener("click", async () => {
                if (!joiningMatch) {
                    return;
                }

                coinflipJoinConfirm.disabled = true;
                coinflipJoinConfirm.textContent = "Flipping...";

                try {
                    const selectedPets = joinInventoryItems
                        .filter((item) => Number(selectedJoinItems.get(String(item.id))) > 0)
                        .map((item) => ({
                            ...item,
                            quantity: Number(selectedJoinItems.get(String(item.id))) || 1
                        }));
                    const items = selectedPets.map((item) => ({
                            inventoryId: item.id,
                            quantity: Number(selectedJoinItems.get(String(item.id))) || 1
                    }));

                    const response = await fetch(
                        `/api/coinflip/${encodeURIComponent(joiningMatch.id)}/join`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({ items })
                        }
                    );

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        throw new Error(
                            data.error ||
                            "Failed to settle match."
                        );
                    }

                    /*
                     * The server decides the real result.
                     * The animation only displays that result.
                     */
                    const result = String(
                        data.result || ""
                    ).toLowerCase();

                    const winner = Boolean(data.winner);

                    const gameMatch = joiningMatch;

                    closeJoinMatch();

                    await playCoinflipAnimation(
                        result,
                        winner,
                        gameMatch,
                        selectedPets,
                        data
                    );

                    await loadCoinflipMatches();

                    if (window.AdoptMeInventory?.refresh) {
                        await window.AdoptMeInventory.refresh();
                    }

                } catch (error) {
                    showToast(error.message || "Failed to join the coinflip.", "error");

                } finally {
                    if (coinflipJoinConfirm) {
                        coinflipJoinConfirm.textContent =
                            "Join & Flip";
                        updateJoinSummary();
                    }
                }
            });
        }

        if (coinflipJoinSelectAll) {
            coinflipJoinSelectAll.addEventListener("click", () => {
                const allSelected = joinInventoryItems.length > 0 && joinInventoryItems.every((item) =>
                    (Number(selectedJoinItems.get(String(item.id))) || 0) >= (Number(item.quantity) || 1)
                );

                selectedJoinItems = new Map();
                if (!allSelected) {
                    let remaining = Number(joiningMatch?.max_join_pets) || Infinity;
                    joinInventoryItems.forEach((item) => {
                        if (remaining <= 0) return;
                        const quantity = Math.min(Number(item.quantity) || 1, remaining);
                        selectedJoinItems.set(String(item.id), quantity);
                        remaining -= quantity;
                    });
                }

                renderJoinInventory();
                updateJoinSummary();
            });
        }


        /* ==========================================
           COINFLIP ANIMATION
        =========================================== */

        function playCoinflipAnimation(result, winner, match, joinerPets, settlement = {}) {

            return new Promise((resolve) => {

                if (!coinflipGameModal || !coinflipGameDetails) {
                    resolve();
                    return;
                }

                const finalResult =
                    result === "tails"
                        ? "tails"
                        : "heads";

                const finalLabel =
                    finalResult.toUpperCase();

                const finalRotation =
                    finalResult === "tails"
                        ? "2700deg"
                        : "2520deg";

                const resultMessage = winner
                    ? "YOU WON!"
                    : "YOU LOST";

                const creatorName =
                    match?.creator_username ||
                    match?.creator_display_name ||
                    "Creator";

                const creatorAvatar = match?.creator_avatar_url
                    ? `<img src="${escapeAttribute(match.creator_avatar_url)}" alt="${escapeAttribute(creatorName)}">`
                    : escapeHtml(creatorName.charAt(0).toUpperCase());

                const joinerAvatar = currentViewer.avatar
                    ? `<img src="${escapeAttribute(currentViewer.avatar)}" alt="${escapeAttribute(currentViewer.username)}">`
                    : escapeHtml(currentViewer.username.charAt(0).toUpperCase());

                const creatorWon = finalResult === String(match?.creator_choice || "heads").toLowerCase();
                const winnerName = creatorWon ? creatorName : currentViewer.username;

                const renderPet = (pet) => `
                    <div class="coinflip-play-pet" title="${escapeAttribute(pet.name || "Pet")}">
                        ${pet.image ? `<img src="${escapeAttribute(pet.image)}" alt="${escapeAttribute(pet.name || "Pet")}">` : "🐾"}
                    </div>
                `;

                const expandPetUnits = (petList) => (Array.isArray(petList) ? petList : []).flatMap((pet) => {
                    const quantity = Math.max(1, Number(pet.quantity) || 1);
                    return Array.from({ length: quantity }, (_, index) => ({
                        ...pet,
                        quantity: 1,
                        individualIndex: index + 1
                    }));
                });

                const creatorPets = expandPetUnits(match?.pets);
                const creatorValue = Number(match?.creator_value) || 0;
                const expandedJoinerPets = expandPetUnits(joinerPets);
                const joinerValue = (joinerPets || []).reduce(
                    (total, pet) => total + (Number(pet.value) || 0) * (Number(pet.quantity) || 1),
                    0
                );
                const totalPot = creatorValue + joinerValue;
                const taxValue = settlement.taxValue === undefined || settlement.taxValue === null
                    ? 0
                    : Number(settlement.taxValue) || 0;
                const payoutValue = settlement.payoutValue === undefined || settlement.payoutValue === null
                    ? totalPot - taxValue
                    : Number(settlement.payoutValue) || 0;

                coinflipGameDetails.innerHTML = `
                    <div class="coinflip-animation-view">
                        <div class="coinflip-play-header">
                            <span>LIVE COINFLIP</span>
                            <strong># ${escapeHtml(String(match?.id || "").slice(0, 13))}</strong>
                        </div>

                        <div class="coinflip-play-contenders">
                            <div class="coinflip-play-player${creatorWon ? " potential-winner" : ""}">
                                <div class="coinflip-play-avatar">${creatorAvatar}</div>
                                <strong>${escapeHtml(creatorName)}</strong>
                                <span>${escapeHtml(String(match?.creator_choice || "heads").toUpperCase())}</span>
                            </div>

                            <div class="coinflip-animation-stage">
                            <div
                                id="coinflipAnimationCoin"
                                class="coinflip-animation-coin coinflip-result-pending"
                                style="--coin-final-rotation: ${finalRotation};"
                            >
                                <div class="coinflip-animation-face coinflip-animation-heads">
                                    <img
                                        src="/images/coin-heads.png"
                                        alt="Heads"
                                    >
                                </div>

                                <div class="coinflip-animation-face coinflip-animation-tails">
                                    <img
                                        src="/images/coin-tails.png"
                                        alt="Tails"
                                    >
                                </div>
                            </div>
                            </div>

                            <div class="coinflip-play-player${!creatorWon ? " potential-winner" : ""}">
                                <div class="coinflip-play-avatar">${joinerAvatar}</div>
                                <strong>${escapeHtml(currentViewer.username)}</strong>
                                <span>${escapeHtml(String(match?.creator_choice === "heads" ? "TAILS" : "HEADS"))}</span>
                            </div>
                        </div>

                        <div class="coinflip-play-wagers">
                            <div class="coinflip-play-wager${creatorWon ? " winner-wager" : ""}">
                                <div>${creatorPets.map(renderPet).join("")}</div>
                                <strong>💎 ${formatValue(creatorValue)}</strong>
                            </div>
                            <div class="coinflip-play-wager${!creatorWon ? " winner-wager" : ""}">
                                <div>${expandedJoinerPets.map(renderPet).join("")}</div>
                                <strong>💎 ${formatValue(joinerValue)}</strong>
                            </div>
                        </div>

                        <div
                            class="coinflip-animation-status"
                            id="coinflipAnimationStatus"
                            aria-live="polite"
                        >
                            <span id="coinflipCountdownLabel">5</span>
                        </div>

                        <div
                            class="coinflip-animation-result"
                            id="coinflipAnimationResult"
                        >
                            <span class="coinflip-animation-result-side">
                                ${finalLabel}
                            </span>
                            <strong>${resultMessage} · ${escapeHtml(winnerName)} wins</strong>
                            <small>Up to 10% game tax: 💎 ${formatValue(taxValue)} · Payout value: 💎 ${formatValue(payoutValue)}</small>
                        </div>
                    </div>
                `;

                coinflipGameModal.classList.add("open");
                coinflipGameModal.setAttribute("aria-hidden", "false");
                document.body.classList.add("coinflip-game-modal-open");

                const status =
                    document.getElementById("coinflipAnimationStatus");

                const resultBox =
                    document.getElementById("coinflipAnimationResult");

                let finished = false;

                const finishAnimation = () => {
                    if (finished) return;
                    finished = true;
                    if (status) {
                        status.textContent = finalLabel;
                    }

                    if (resultBox) {
                        resultBox.classList.add("show");
                    }

                    const coin = document.getElementById("coinflipAnimationCoin");
                    if (coin) {
                        coin.classList.remove("coinflip-result-pending", "is-flipping");
                        coin.style.setProperty("--coin-final-rotation", finalRotation);
                        coin.style.transform = `rotateY(${finalResult === "tails" ? "180deg" : "0deg"})`;
                    }

                    const title =
                        document.getElementById("coinflipGameTitle");

                    if (title) {
                        title.textContent =
                            winner
                                ? "You won the coinflip!"
                                : "You lost the coinflip.";
                    }

                    resolve();
                };

                const countdownLabel = document.getElementById("coinflipCountdownLabel");

                /* The outcome is settled first; the UI only reveals it after five seconds. */
                let secondsRemaining = 5;
                if (countdownLabel) countdownLabel.textContent = String(secondsRemaining);

                const coin = document.getElementById("coinflipAnimationCoin");
                if (coin) {
                    coin.style.setProperty("--coin-final-rotation", finalRotation);
                    // Wait one frame so the browser reliably transitions from the
                    // hidden question mark state into the real flip animation.
                    window.requestAnimationFrame(() => {
                        coin.classList.remove("coinflip-result-pending");
                        coin.classList.add("is-flipping");
                    });
                }

                const countdown = window.setInterval(() => {
                    secondsRemaining -= 1;
                    if (secondsRemaining > 0) {
                        if (countdownLabel) countdownLabel.textContent = String(secondsRemaining);
                        return;
                    }

                    window.clearInterval(countdown);
                    if (countdownLabel) countdownLabel.textContent = finalLabel;
                    finishAnimation();
                }, 1000);
            });
        }


        /* ==========================================
           GAME VIEW
        =========================================== */

        function closeGameView() {

            if (!coinflipGameModal) {
                return;
            }

            coinflipGameModal.classList.remove("open");
            coinflipGameModal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("coinflip-game-modal-open");

        }


        function openGameView(matchId) {

            const match = loadedCoinflipMatches.find(
                (item) => String(item.id) === String(matchId)
            );

            if (!match || !coinflipGameModal || !coinflipGameDetails) {
                return;
            }

            const creatorName =
                match.creator_username ||
                match.creator_display_name ||
                "Player";

            const choice = String(
                match.creator_choice || "heads"
            ).toLowerCase();

            const wager = Number(match.creator_value) || 0;

            const avatar = match.creator_avatar_url || "";

            const pets = Array.isArray(match.pets)
                ? match.pets
                : [];

            // Render every quantity as an individual pet card.
            // The API stores the combined value in pet.value, so divide it
            // by the quantity to show the value of each individual pet.
            const individualPets = pets.flatMap((pet) => {
                const quantity = Math.max(1, Number(pet.quantity) || 1);
                const totalValue = Number(pet.value) || 0;
                const valuePerPet = totalValue / quantity;

                return Array.from({ length: quantity }, (_, index) => ({
                    ...pet,
                    individualIndex: index + 1,
                    quantity: 1,
                    value: valuePerPet
                }));
            });

            const petList = individualPets.length
                ? individualPets.map((pet) => {
                    const name = pet.name || "Wagered pet";
                    const image = pet.image
                        ? `<img src="${escapeAttribute(pet.image)}" alt="${escapeAttribute(name)}">`
                        : "<span>🐾</span>";

                    const form = String(pet.form || "normal").toLowerCase();
                    const formBadge = form !== "normal"
                        ? `<span class="pet-trait pet-trait-${escapeAttribute(form)}">${escapeHtml(form.charAt(0).toUpperCase() + form.slice(1))}</span>`
                        : "";

                    const movementBadge = pet.fly && pet.ride
                        ? '<span class="pet-trait pet-trait-fr" title="Flyable and Rideable">FR</span>'
                        : pet.fly
                            ? '<span class="pet-trait pet-trait-f" title="Flyable">F</span>'
                            : pet.ride
                                ? '<span class="pet-trait pet-trait-r" title="Rideable">R</span>'
                                : "";

                    const traits = [formBadge, movementBadge]
                        .filter(Boolean)
                        .join("");

                    return `
                        <li class="coinflip-game-pet">
                            <div class="coinflip-game-pet-image">${image}</div>
                            <div>
                                <strong>${escapeHtml(name)}</strong>
                                <span class="coinflip-game-pet-meta">💎 ${formatValue(pet.value)}</span>
                                ${traits ? `<div class="coinflip-game-pet-traits">${traits}</div>` : ""}
                            </div>
                        </li>
                    `;
                }).join("")
                : "<li class=\"coinflip-game-empty\">The wagered pets are unavailable.</li>";

            const creatorAvatar = avatar
                ? `<img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(creatorName)}">`
                : escapeHtml(creatorName.charAt(0).toUpperCase());

            const createdAt = match.created_at
                ? new Date(match.created_at).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                })
                : "Recently";

            coinflipGameDetails.innerHTML = `
                <span class="coinflip-game-kicker">OPEN COINFLIP</span>
                <h2 id="coinflipGameTitle">Coinflip game</h2>
                <div class="coinflip-game-versus">
                    <div class="coinflip-game-contender">
                        <div class="coinflip-game-avatar">${creatorAvatar}</div>
                        <strong>${escapeHtml(creatorName)}</strong>
                        <span>${escapeHtml(choice.charAt(0).toUpperCase() + choice.slice(1))}</span>
                    </div>
                    <span class="coinflip-game-vs">VS</span>
                    <div class="coinflip-game-contender waiting">
                        <div class="coinflip-game-avatar">?</div>
                        <strong>Waiting..</strong>
                        <span>${choice === "heads" ? "Tails" : "Heads"}</span>
                    </div>
                </div>
                <div class="coinflip-game-id"># ${escapeHtml(String(match.id).slice(0, 18))}...</div>
                <div class="coinflip-game-odds">
                    <strong>100.00 % <span>💎 ${formatValue(wager)}</span></strong>
                    <strong>0.00 % <span>💎 0</span></strong>
                </div>
                <div class="coinflip-game-pets-heading">
                    <h3>💎 ${formatValue(wager)}</h3>
                    <span>${individualPets.length} ${individualPets.length === 1 ? "pet" : "pets"}</span>
                </div>
                <div class="coinflip-game-wagers">
                    <ul class="coinflip-game-pets">${petList}</ul>
                    <div class="coinflip-game-opponent-wager">Waiting for the opponent to join...</div>
                </div>
                <div class="coinflip-game-footer">Created ${escapeHtml(createdAt)} <span>PROVABLY FAIR</span></div>
            `;

            coinflipGameModal.classList.add("open");
            coinflipGameModal.setAttribute("aria-hidden", "false");
            document.body.classList.add("coinflip-game-modal-open");

        }


        if (coinflipGameClose) {
            coinflipGameClose.addEventListener("click", closeGameView);
        }

        if (coinflipGameModalOverlay) {
            coinflipGameModalOverlay.addEventListener("click", closeGameView);
        }

        document.addEventListener(
            "keydown",
            (event) => {
                if (event.key === "Escape") {
                    closeGameView();
                    closeJoinMatch();
                }
            }
        );


        /* ==========================================
           INVENTORY BUTTON
        =========================================== */

        const openInventoryButton =
            document.getElementById(
                "openInventoryButton"
            );


        if (openInventoryButton) {

            openInventoryButton.addEventListener(
                "click",
                () => {

                    if (
                        window.AdoptMeInventory &&
                        typeof window.AdoptMeInventory.open ===
                            "function"
                    ) {

                        window.AdoptMeInventory.open();

                    }

                }
            );

        }


        // Open the inventory automatically when mobile navigation links to /?openInventory=1.
        const inventoryQuery = new URLSearchParams(window.location.search);
        if (
            openInventoryButton &&
            inventoryQuery.get("openInventory") === "1"
        ) {
            window.setTimeout(() => {
                openInventoryButton.click();
                inventoryQuery.delete("openInventory");
                const cleanUrl = `${window.location.pathname}${inventoryQuery.toString() ? `?${inventoryQuery}` : ""}${window.location.hash}`;
                window.history.replaceState({}, document.title, cleanUrl);
            }, 250);
        }


        /* ==========================================
           TABS
        =========================================== */

        const openMatchesTab =
            document.getElementById(
                "openMatchesTab"
            );

        const myMatchesTab =
            document.getElementById(
                "myMatchesTab"
            );


        if (openMatchesTab) {

            openMatchesTab.addEventListener(
                "click",
                () => {

                    openMatchesTab.classList.add(
                        "active"
                    );

                    if (myMatchesTab) {

                        myMatchesTab.classList.remove(
                            "active"
                        );

                    }

                    loadCoinflipMatches();

                }
            );

        }


        if (myMatchesTab) {

            myMatchesTab.addEventListener(
                "click",
                () => {

                    myMatchesTab.classList.add(
                        "active"
                    );

                    if (openMatchesTab) {

                        openMatchesTab.classList.remove(
                            "active"
                        );

                    }

                    /*
                        My Matches functionality will be
                        added when match history is built.
                    */

                    loadCoinflipMatches();

                }
            );

        }


        /* ==========================================
           SORT
        =========================================== */

        const sortMatchesButton =
            document.getElementById(
                "sortMatchesButton"
            );


        let newestFirst = true;


        if (sortMatchesButton) {

            sortMatchesButton.addEventListener(
                "click",
                () => {

                    newestFirst =
                        !newestFirst;

                    sortMatchesButton.innerHTML =
                        `
                            <span>
                                ↕
                            </span>
                            ${newestFirst ? "Newest" : "Oldest"}
                        `;

                    loadCoinflipMatches();

                }
            );

        }


        /* ==========================================
           INITIAL LOAD
        =========================================== */

        loadCoinflipMatches();

        loadCoinflipInventory();


        /* ==========================================
           REFRESH OPEN MATCHES
        =========================================== */

        setInterval(
            loadCoinflipMatches,
            5000
        );


})();

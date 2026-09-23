document.addEventListener("DOMContentLoaded", () => {

    // ======================================
    // ELEMENTS
    // ======================================

    const navbarBalance =
        document.getElementById("navbarBalance");

    const inventoryModal =
        document.getElementById("inventoryModal");

    const inventoryButton =
        document.getElementById("inventoryButton");

    const inventoryClose =
        document.getElementById("inventoryClose");

    const inventoryOverlay =
        document.getElementById("inventoryOverlay");

    const inventoryCount =
        document.getElementById("inventoryCount");

    const inventoryTotalValue =
        document.getElementById("inventoryTotalValue");

    const inventoryItems =
        document.getElementById("inventoryItems");

    const selectedItemsCount =
        document.getElementById("selectedItemsCount");

    const selectedItemsValue =
        document.getElementById("selectedItemsValue");

    const selectAllButton =
        document.getElementById("selectAllButton");

    const depositButton =
        document.getElementById("depositButton");

    const withdrawButton =
        document.getElementById("withdrawButton");

    const depositModal =
        document.getElementById("depositModal");

    const withdrawModal =
        document.getElementById("withdrawModal");

    const depositClose =
        document.getElementById("depositClose");

    const withdrawClose =
        document.getElementById("withdrawClose");

    const depositOverlay =
        document.getElementById("depositOverlay");

    const withdrawOverlay =
        document.getElementById("withdrawOverlay");

    const withdrawItems =
        document.getElementById("withdrawItems");

    const withdrawTotalValue =
        document.getElementById("withdrawTotalValue");

    const withdrawConfirmButton =
        document.getElementById("withdrawConfirmButton");

    const depositContinueButton =
        document.getElementById("depositContinueButton");


    // ======================================
    // DEPOSIT ELEMENTS
    // ======================================

    const depositDescription =
        document.getElementById("depositDescription");

    const depositInfo =
        document.getElementById("depositInfo");

    const depositCreatedInfo =
        document.getElementById("depositCreatedInfo");

    const depositId =
        document.getElementById("depositId");

    const depositStatus =
        document.getElementById("depositStatus");

    const depositCreatedStatus =
        document.getElementById("depositCreatedStatus");


    // ======================================
    // STATE
    // ======================================

    let inventory = [];

    let selectedItems = new Map();

    let activeDepositId = null;

    let depositStatusPollInterval = null;


    // ======================================
    // FORMAT VALUE
    // ======================================

    function formatValue(value) {

        return Number(value || 0)
            .toLocaleString("en-US");

    }


    // ======================================
    // ESCAPE HTML
    // ======================================

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    // ======================================
    // LOAD INVENTORY
    // ======================================

    async function loadInventory() {

        try {

            const response =
                await fetch(
                    "/api/inventory",
                    {
                        method: "GET",

                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );


            /*
             * Try to read the response as text first.
             *
             * This prevents errors such as:
             *
             * Unexpected token '<'
             *
             * if Express sends back an HTML error page.
             */

            const responseText =
                await response.text();


            let data;


            try {

                data =
                    JSON.parse(responseText);

            } catch (parseError) {

                console.error(
                    "Inventory API returned invalid JSON:",
                    responseText
                );


                throw new Error(
                    `Inventory API returned ${response.status} instead of JSON`
                );

            }


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    `Failed to load inventory (${response.status})`
                );

            }


            if (!data.success) {

                throw new Error(
                    data.message ||
                    "Failed to load inventory"
                );

            }


            inventory =
                data.inventory?.items || [];


            // ==================================
            // UPDATE NAVBAR
            // ==================================

            if (navbarBalance) {

                navbarBalance.textContent =
                    formatValue(
                        data.inventory?.totalValue || 0
                    );

            }


            // ==================================
            // UPDATE INVENTORY SUMMARY
            // ==================================

            if (inventoryCount) {

                inventoryCount.textContent =
                    formatValue(
                        data.inventory?.itemCount || 0
                    );

            }


            if (inventoryTotalValue) {

                inventoryTotalValue.textContent =
                    formatValue(
                        data.inventory?.totalValue || 0
                    );

            }


            // ==================================
            // REMOVE INVALID SELECTIONS
            // ==================================

            const validItemIds =
                new Set(
                    inventory.map(item =>
                        String(item.id)
                    )
                );


            selectedItems.forEach(
                (item, itemId) => {

                    if (!validItemIds.has(itemId)) {

                        selectedItems.delete(itemId);

                    }

                }
            );


            // ==================================
            // RENDER
            // ==================================

            renderInventory();

            updateSelectionUI();


        } catch (error) {

            console.error(
                "Inventory error:",
                error
            );


            if (navbarBalance) {

                navbarBalance.textContent =
                    "0";

            }


            if (inventoryCount) {

                inventoryCount.textContent =
                    "0";

            }


            if (inventoryTotalValue) {

                inventoryTotalValue.textContent =
                    "0";

            }


            if (inventoryItems) {

                inventoryItems.innerHTML = `
                    <div class="inventory-empty">

                        <strong>
                            Unable to load inventory
                        </strong>

                        <span>
                            ${escapeHtml(
                                error.message ||
                                "Please refresh the page and try again."
                            )}
                        </span>

                    </div>
                `;

            }

        }

    }


    // ======================================
    // RENDER INVENTORY
    // ======================================

    function renderInventory() {

        if (!inventoryItems) {
            return;
        }


        if (
            !inventory ||
            inventory.length === 0
        ) {

            inventoryItems.innerHTML = `
                <div class="inventory-empty">

                    <div class="inventory-empty-icon">
                        📦
                    </div>

                    <strong>
                        Your inventory is empty
                    </strong>

                    <span>
                        Deposited items will appear here.
                    </span>

                </div>
            `;


            return;

        }


        inventoryItems.innerHTML =
            inventory.flatMap(item => Array.from({ length: Math.max(1, Number(item.quantity) || 1) }, (_, unitIndex) => {

                // ==================================
                // FORM
                // ==================================

                let formName =
                    "Normal";


                if (item.form === "neon") {

                    formName =
                        "Neon";

                } else if (
                    item.form === "mega"
                ) {

                    formName =
                        "Mega";

                }


                // ==================================
                // POTION
                // ==================================

                let potionName =
                    "No Potion";


                if (
                    item.fly &&
                    item.ride
                ) {

                    potionName =
                        "Fly Ride";

                } else if (item.fly) {

                    potionName =
                        "Fly";

                } else if (item.ride) {

                    potionName =
                        "Ride";

                }


                // ==================================
                // VARIANT
                // ==================================

                const variant =
                    formName === "Normal"
                        ? potionName
                        : `${formName} • ${potionName}`;


                // ==================================
                // VALUES
                // ==================================

                const quantity =
                    1;


                const value =
                    Number(item.value) || 0;


                const totalValue =
                    value;


                // ==================================
                // SELECTED
                // ==================================

                const isSelected =
                    selectedItems.has(
                        String(item.id)
                    );


                // ==================================
                // IMAGE
                // ==================================

                const imageHtml =
                    item.image
                        ? `
                            <img
                                src="${escapeHtml(item.image)}"
                                alt="${escapeHtml(item.name)}"
                                loading="lazy"
                                onerror="
                                    this.style.display='none';
                                    this.nextElementSibling.style.display='block';
                                "
                            >

                            <span
                                class="inventory-item-image-fallback"
                                style="display:none;"
                            >
                                🐾
                            </span>
                        `
                        : `
                            <span
                                class="inventory-item-image-fallback"
                            >
                                🐾
                            </span>
                        `;


                // ==================================
                // CARD
                // ==================================

                return `
                    <div
                        class="
                            inventory-item-card
                            ${isSelected ? "selected" : ""}
                        "
                        data-item-id="${escapeHtml(item.id)}"
                        data-unit-index="${unitIndex}"
                    >

                        <button
                            type="button"
                            class="inventory-item-select"
                            data-select-item="${escapeHtml(item.id)}"
                            data-unit-index="${unitIndex}"
                            aria-label="Select ${escapeHtml(item.name)}"
                        >

                            <div class="inventory-item-image">

                                ${imageHtml}


                                ${
                                    quantity > 1
                                        ? `
                                            <div class="inventory-item-quantity">
                                                ×${quantity}
                                            </div>
                                        `
                                        : ""
                                }


                                <div
                                    class="inventory-item-selected-check"
                                >
                                    ✓
                                </div>

                            </div>


                            <div class="inventory-item-name">
                                ${escapeHtml(item.name)}
                            </div>


                            <div class="inventory-item-variant">
                                ${escapeHtml(variant)}
                            </div>


                            <div class="inventory-item-value">

                                <span>
                                    💎 ${formatValue(value)}
                                </span>


                                ${
                                    quantity > 1
                                        ? `
                                            <span
                                                class="inventory-item-value-total"
                                            >
                                                ${formatValue(totalValue)} total
                                            </span>
                                        `
                                        : ""
                                }

                            </div>

                        </button>

                    </div>
                `;

            })).join("");


        // ======================================
        // ITEM CLICK EVENTS
        // ======================================

        inventoryItems
            .querySelectorAll(
                "[data-select-item]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        toggleItemSelection(
                            button.dataset.selectItem
                        );

                    }
                );

            });

    }


    // ======================================
    // TOGGLE ITEM
    // ======================================

    function toggleItemSelection(itemId) {

        itemId =
            String(itemId);


        const item =
            inventory.find(
                currentItem =>
                    String(currentItem.id) === itemId
            );


        if (!item) {
            return;
        }


        if (
            selectedItems.has(itemId)
        ) {

            selectedItems.delete(
                itemId
            );

        } else {

            selectedItems.set(
                itemId,
                item
            );

        }


        renderInventory();

        updateSelectionUI();

    }


    // ======================================
    // SELECT ALL
    // ======================================

    function selectAllItems() {

        selectedItems.clear();


        inventory.forEach(item => {

            selectedItems.set(
                String(item.id),
                item
            );

        });


        renderInventory();

        updateSelectionUI();

    }


    // ======================================
    // DESELECT ALL
    // ======================================

    function deselectAllItems() {

        selectedItems.clear();


        renderInventory();

        updateSelectionUI();

    }


    // ======================================
    // UPDATE SELECTION UI
    // ======================================

    function updateSelectionUI() {

        const selected =
            Array.from(
                selectedItems.values()
            );


        const count =
            selected.length;


        const value =
            selected.reduce(
                (total, item) => {

                    const itemValue =
                        Number(item.value) || 0;


                    const quantity =
                        Number(item.quantity) || 1;


                    return total +
                        (
                            itemValue *
                            quantity
                        );

                },
                0
            );


        // ==================================
        // SELECTED COUNT
        // ==================================

        if (selectedItemsCount) {

            selectedItemsCount.textContent =
                formatValue(count);

        }


        // ==================================
        // SELECTED VALUE
        // ==================================

        if (selectedItemsValue) {

            selectedItemsValue.textContent =
                formatValue(value);

        }


        // ==================================
        // SELECT ALL BUTTON
        // ==================================

        if (selectAllButton) {

            if (
                inventory.length > 0 &&
                selectedItems.size ===
                    inventory.length
            ) {

                selectAllButton.textContent =
                    "Deselect All";

            } else {

                selectAllButton.textContent =
                    "Select All";

            }

        }


        // ==================================
        // WITHDRAW BUTTON
        // ==================================

        if (withdrawButton) {

            withdrawButton.disabled =
                selectedItems.size === 0;

        }

    }


    // ======================================
    // OPEN INVENTORY
    // ======================================

    function openInventory() {

        if (!inventoryModal) {
            return;
        }


        inventoryModal.classList.add(
            "active"
        );


        document.body.classList.add(
            "modal-open"
        );


        loadInventory();

    }


    // ======================================
    // CLOSE INVENTORY
    // ======================================

    function closeInventory() {

        if (!inventoryModal) {
            return;
        }


        inventoryModal.classList.remove(
            "active"
        );


        document.body.classList.remove(
            "modal-open"
        );

    }


    // ======================================
    // DEPOSIT STATUS HELPERS
    // ======================================

    function formatDepositStatus(status) {

        const value =
            String(status || "pending");


        return (
            value.charAt(0).toUpperCase() +
            value.slice(1)
        );

    }


    function stopDepositStatusPolling() {

        if (depositStatusPollInterval) {

            clearInterval(
                depositStatusPollInterval
            );

            depositStatusPollInterval = null;

        }

    }


    async function checkDepositStatus() {

        if (!activeDepositId) {
            return;
        }


        try {

            const response =
                await fetch(
                    `/api/inventory/deposit/${encodeURIComponent(activeDepositId)}`,
                    {
                        method: "GET",

                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );


            const responseText =
                await response.text();


            let data;


            try {

                data =
                    JSON.parse(responseText);

            } catch (parseError) {

                console.error(
                    "Deposit status API returned invalid JSON:",
                    responseText
                );

                return;

            }


            if (
                !response.ok ||
                !data.success
            ) {

                console.error(
                    "Failed to check deposit status:",
                    data.message ||
                    `HTTP ${response.status}`
                );

                return;

            }


            const deposit =
                data.deposit || {};


            const status =
                String(
                    deposit.status ||
                    "pending"
                ).toLowerCase();


            const formattedStatus =
                formatDepositStatus(status);


            if (depositCreatedStatus) {

                depositCreatedStatus.textContent =
                    formattedStatus;

            }


            if (depositStatus) {

                depositStatus.textContent =
                    formattedStatus;

            }


            // ==================================
            // DEPOSIT COMPLETED
            // ==================================

            if (status === "completed") {

                stopDepositStatusPolling();


                if (depositDescription) {

                    depositDescription.textContent =
                        "Your deposit has been completed successfully.";

                }


                if (depositContinueButton) {

                    depositContinueButton.textContent =
                        "Done";

                    depositContinueButton.disabled =
                        false;

                    depositContinueButton.onclick =
                        function depositCompleted() {

                            closeDeposit();

                            depositContinueButton.onclick =
                                createDeposit;

                        };

                }


                await loadInventory();


                return;

            }


            // ==================================
            // DEPOSIT CANCELLED
            // ==================================

            if (status === "cancelled") {

                stopDepositStatusPolling();


                if (depositDescription) {

                    depositDescription.textContent =
                        "This deposit request has been cancelled.";

                }


                if (depositContinueButton) {

                    depositContinueButton.textContent =
                        "Close";

                    depositContinueButton.disabled =
                        false;

                    depositContinueButton.onclick =
                        function depositCancelled() {

                            closeDeposit();

                            depositContinueButton.onclick =
                                createDeposit;

                        };

                }


                return;

            }


            // ==================================
            // PROCESSING
            // ==================================

            if (status === "processing") {

                if (depositDescription) {

                    depositDescription.textContent =
                        "Your trade is being processed. Please wait while we verify it.";

                }

                return;

            }


            // ==================================
            // PENDING
            // ==================================

            if (status === "pending") {

                if (depositDescription) {

                    depositDescription.textContent =
                        "Your deposit request is pending. Complete the trade to continue.";

                }

            }

        } catch (error) {

            console.error(
                "Deposit status error:",
                error
            );

        }

    }


    function startDepositStatusPolling(
        depositIdValue
    ) {

        stopDepositStatusPolling();


        activeDepositId =
            depositIdValue;


        if (!activeDepositId) {
            return;
        }


        // Check immediately.
        checkDepositStatus();


        // Then keep checking every 3 seconds.
        depositStatusPollInterval =
            setInterval(
                checkDepositStatus,
                3000
            );

    }


    // ======================================
    // RESET DEPOSIT MODAL
    // ======================================

    function resetDepositModal() {

        stopDepositStatusPolling();

        activeDepositId = null;


        if (depositDescription) {

            depositDescription.textContent =
                "Deposit your Adopt Me pets into your inventory.";

        }


        if (depositInfo) {

            depositInfo.style.display =
                "";

        }


        if (depositCreatedInfo) {

            depositCreatedInfo.style.display =
                "none";

        }


        if (depositId) {

            depositId.textContent =
                "-";

        }


        if (depositStatus) {

            depositStatus.textContent =
                "Ready";

        }


        if (depositCreatedStatus) {

            depositCreatedStatus.textContent =
                "Pending";

        }


        if (depositContinueButton) {

            depositContinueButton.disabled =
                false;

            depositContinueButton.textContent =
                "Continue";

            depositContinueButton.onclick =
                createDeposit;

        }

    }


    // ======================================
    // OPEN DEPOSIT
    // ======================================

    function openDeposit() {

        if (!depositModal) {
            return;
        }


        resetDepositModal();


        depositModal.classList.add(
            "active"
        );

    }


    // ======================================
    // CLOSE DEPOSIT
    // ======================================

    function closeDeposit() {

        if (!depositModal) {
            return;
        }


        depositModal.classList.remove(
            "active"
        );


        resetDepositModal();

    }


    // ======================================
    // CREATE DEPOSIT
    // ======================================

    async function createDeposit() {

        if (!depositContinueButton) {
            return;
        }


        depositContinueButton.disabled =
            true;


        depositContinueButton.textContent =
            "Creating Deposit...";


        try {

            const response =
                await fetch(
                    "/api/inventory/deposit",
                    {
                        method: "POST",

                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );


            // ==================================
            // READ RESPONSE SAFELY
            // ==================================

            const responseText =
                await response.text();


            let data;


            try {

                data =
                    JSON.parse(
                        responseText
                    );

            } catch (parseError) {

                console.error(
                    "Deposit API returned invalid JSON:",
                    responseText
                );


                throw new Error(
                    `Deposit API returned ${response.status} instead of JSON`
                );

            }


            // ==================================
            // CHECK RESPONSE
            // ==================================

            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Failed to create deposit request."
                );

            }


            console.log(
                "Deposit created:",
                data.deposit
            );


            // ==================================
            // GET DEPOSIT DATA
            // ==================================

            const createdDeposit =
                data.deposit || {};


            const createdDepositId =
                createdDeposit.id || "-";


            const createdDepositStatus =
                createdDeposit.status ||
                "pending";


            // ==================================
            // UPDATE DEPOSIT ID
            // ==================================

            if (depositId) {

                depositId.textContent =
                    createdDepositId;

            }


            // ==================================
            // UPDATE STATUS
            // ==================================

            const formattedStatus =
                formatDepositStatus(
                    createdDepositStatus
                );


            if (depositCreatedStatus) {

                depositCreatedStatus.textContent =
                    formattedStatus;

            }


            // ==================================
            // HIDE INITIAL INFORMATION
            // ==================================

            if (depositInfo) {

                depositInfo.style.display =
                    "none";

            }


            // ==================================
            // UPDATE DESCRIPTION
            // ==================================

            if (depositDescription) {

                depositDescription.textContent =
                    "Your deposit request has been created.";

            }


            // ==================================
            // SHOW CREATED DEPOSIT
            // ==================================

            if (depositCreatedInfo) {

                depositCreatedInfo.style.display =
                    "";

            }


            // ==================================
            // CHANGE BUTTON
            // ==================================

            depositContinueButton.disabled =
                false;


            depositContinueButton.textContent =
                "Done";


            // ==================================
            // START STATUS POLLING
            // ==================================

            if (
                createdDepositId !== "-"
            ) {

                startDepositStatusPolling(
                    createdDepositId
                );

            }


            // ==================================
            // CHANGE BUTTON ACTION
            // ==================================

            depositContinueButton.onclick =
                function depositDone() {

                    closeDeposit();

                    depositContinueButton.onclick =
                        createDeposit;

                };


        } catch (error) {

            console.error(
                "Deposit error:",
                error
            );


            alert(
                error.message ||
                "Failed to create deposit request."
            );


            depositContinueButton.disabled =
                false;


            depositContinueButton.textContent =
                "Continue";

        }

    }


    // ======================================
    // RENDER WITHDRAW ITEMS
    // ======================================

    function renderWithdrawItems() {

        if (!withdrawItems) {
            return;
        }


        const selected =
            Array.from(
                selectedItems.values()
            );


        if (
            selected.length === 0
        ) {

            withdrawItems.innerHTML = `
                <div class="withdraw-empty">

                    <div>
                        📦
                    </div>

                    <strong>
                        No items selected
                    </strong>

                    <span>
                        Select the items you want to withdraw.
                    </span>

                </div>
            `;


            if (withdrawTotalValue) {

                withdrawTotalValue.textContent =
                    "0";

            }


            return;

        }


        let totalValue =
            0;


        withdrawItems.innerHTML =
            selected.map(item => {

                const value =
                    Number(item.value) || 0;


                const quantity =
                    Number(item.quantity) || 1;


                totalValue +=
                    value * quantity;


                return `
                    <div class="withdraw-item">

                        <div class="withdraw-item-image">

                            ${
                                item.image
                                    ? `
                                        <img
                                            src="${escapeHtml(item.image)}"
                                            alt="${escapeHtml(item.name)}"
                                        >
                                    `
                                    : `
                                        <span>
                                            🐾
                                        </span>
                                    `
                            }

                        </div>


                        <div class="withdraw-item-info">

                            <strong>
                                ${escapeHtml(item.name)}
                            </strong>

                            <span>
                                💎 ${formatValue(value)}
                            </span>

                        </div>


                        ${
                            quantity > 1
                                ? `
                                    <span class="withdraw-item-quantity">
                                        ×${quantity}
                                    </span>
                                `
                                : ""
                        }

                    </div>
                `;

            }).join("");


        if (withdrawTotalValue) {

            withdrawTotalValue.textContent =
                formatValue(totalValue);

        }

    }


    // ======================================
    // SUBMIT WITHDRAWAL
    // ======================================

    async function confirmWithdrawal() {
        if (selectedItems.size === 0 || !withdrawConfirmButton) {
            return;
        }

        const originalText = withdrawConfirmButton.textContent;
        withdrawConfirmButton.disabled = true;
        withdrawConfirmButton.textContent = "Submitting...";

        try {
            const response = await fetch("/api/inventory/withdraw", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    items: Array.from(selectedItems.values()).map(item => ({
                        inventoryId: item.id,
                        quantity: Number(item.quantity) || 1
                    }))
                })
            });

            const responseText = await response.text();
            let data;

            try {
                data = JSON.parse(responseText);
            } catch (_) {
                throw new Error(`Withdrawal request failed (${response.status})`);
            }

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to submit withdrawal.");
            }

            closeWithdraw();
            selectedItems.clear();
            await loadInventory();
            updateSelectionUI();

            window.alert(
                `Withdrawal submitted!\nRequest ID: ${data.withdrawal?.id || "pending"}`
            );
        } catch (error) {
            console.error("Withdrawal error:", error);
            window.alert(error.message || "Failed to submit withdrawal.");
        } finally {
            withdrawConfirmButton.disabled = false;
            withdrawConfirmButton.textContent = originalText;
        }
    }


    // ======================================
    // OPEN WITHDRAW
    // ======================================

    function openWithdraw() {

        if (
            selectedItems.size === 0
        ) {

            return;

        }


        renderWithdrawItems();


        if (withdrawModal) {

            withdrawModal.classList.add(
                "active"
            );

        }

    }


    // ======================================
    // CLOSE WITHDRAW
    // ======================================

    function closeWithdraw() {

        if (!withdrawModal) {
            return;
        }


        withdrawModal.classList.remove(
            "active"
        );

    }


    // ======================================
    // EVENT LISTENERS
    // ======================================

    if (inventoryButton) {

        inventoryButton.addEventListener(
            "click",
            openInventory
        );

    }


    if (inventoryClose) {

        inventoryClose.addEventListener(
            "click",
            closeInventory
        );

    }


    if (inventoryOverlay) {

        inventoryOverlay.addEventListener(
            "click",
            closeInventory
        );

    }


    if (selectAllButton) {

        selectAllButton.addEventListener(
            "click",
            () => {

                if (
                    inventory.length > 0 &&
                    selectedItems.size ===
                        inventory.length
                ) {

                    deselectAllItems();

                } else {

                    selectAllItems();

                }

            }
        );

    }


    if (depositButton) {

        depositButton.addEventListener(
            "click",
            openDeposit
        );

    }


    if (depositContinueButton) {

        depositContinueButton.addEventListener(
            "click",
            createDeposit
        );

    }


    if (withdrawButton) {

        withdrawButton.addEventListener(
            "click",
            openWithdraw
        );

    }


    if (withdrawConfirmButton) {

        withdrawConfirmButton.addEventListener(
            "click",
            confirmWithdrawal
        );

    }


    if (depositClose) {

        depositClose.addEventListener(
            "click",
            closeDeposit
        );

    }


    if (withdrawClose) {

        withdrawClose.addEventListener(
            "click",
            closeWithdraw
        );

    }


    if (depositOverlay) {

        depositOverlay.addEventListener(
            "click",
            closeDeposit
        );

    }


    if (withdrawOverlay) {

        withdrawOverlay.addEventListener(
            "click",
            closeWithdraw
        );

    }


    // ======================================
    // ESCAPE KEY
    // ======================================

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Escape"
            ) {

                return;

            }


            closeWithdraw();

            closeDeposit();

            closeInventory();

        }
    );


    // ======================================
    // INITIAL LOAD
    // ======================================

    loadInventory();


    // ======================================
    // EXPOSE INVENTORY API
    // ======================================

    window.AdoptMeInventory = {

        getItems() {

            return inventory;

        },


        getSelectedItems() {

            return Array.from(
                selectedItems.values()
            );

        },


        getSelectedValue() {

            return Array.from(
                selectedItems.values()
            ).reduce(
                (total, item) => {

                    const value =
                        Number(item.value) || 0;


                    const quantity =
                        Number(item.quantity) || 1;


                    return total +
                        (
                            value *
                            quantity
                        );

                },
                0
            );

        },


        refresh() {

            return loadInventory();

        },


        open() {

            openInventory();

        },


        close() {

            closeInventory();

        }

    };

});
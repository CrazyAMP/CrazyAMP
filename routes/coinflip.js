const express = require("express");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

const pool = require("../db");

const router = express.Router();

const TAX_RATE = 10;

/*
 * Select whole pets whose combined value is as close as possible to
 * the 10% tax target without exceeding it. A match with two or fewer
 * total pets is not tax-eligible by design.
 */
function selectTaxedWagers(wagers, totalValue) {
    const totalPetCount = wagers.reduce(
        (sum, wager) => sum + Number(wager.quantity || 0),
        0
    );

    if (totalPetCount <= 2) {
        return {
            taxValue: 0,
            taxedQuantities: new Map()
        };
    }

    const target = Math.floor(
        Number(totalValue) * TAX_RATE / 100
    );

    if (target <= 0) {
        return {
            taxValue: 0,
            taxedQuantities: new Map()
        };
    }

    /*
     * Bounded subset-sum over individual pet units. Each state stores
     * the selected quantity for each match-item row. We only retain
     * sums at or below the target, ensuring the tax never exceeds 10%.
     */
    let states = new Map();
    states.set(0, new Map());

    for (const wager of wagers) {
        const value = Number(wager.value_per_item || 0);
        const quantity = Number(wager.quantity || 0);

        if (!Number.isInteger(quantity) || quantity <= 0 || value <= 0) {
            continue;
        }

        for (let unit = 0; unit < quantity; unit += 1) {
            const nextStates = new Map(states);

            for (const [sum, quantities] of states.entries()) {
                const nextSum = sum + value;

                if (nextSum > target || nextStates.has(nextSum)) {
                    continue;
                }

                const nextQuantities = new Map(quantities);
                const rowId = String(wager.id);
                nextQuantities.set(
                    rowId,
                    (nextQuantities.get(rowId) || 0) + 1
                );

                nextStates.set(nextSum, nextQuantities);
            }

            states = nextStates;
        }
    }

    let bestSum = 0;

    for (const sum of states.keys()) {
        if (sum > bestSum && sum <= target) {
            bestSum = sum;
        }
    }

    return {
        taxValue: bestSum,
        taxedQuantities: states.get(bestSum) || new Map()
    };
}

function requireLogin(req, res, next) {
    const userId =
        req.session?.userId ||
        req.session?.user?.id;

    if (!userId) {
        return res.status(401).json({
            success: false,
            error: "You must be logged in."
        });
    }

    next();
}

router.use(requireLogin);


/* =========================================================
   GET OPEN COINFLIP MATCHES
   ========================================================= */

router.get("/", async (req, res) => {
    const userId =
        req.session.userId ||
        req.session.user?.id;

    try {
        const result = await pool.query(
            `
            SELECT
                cm.id,
                cm.creator_id,
                cm.joiner_id,

                cm.creator_value,
                cm.joiner_value,
                cm.total_value,
                cm.tax_value,
                cm.payout_value,
                cm.tax_rate,

                cm.min_join_value,
                cm.max_join_value,
                cm.max_join_pets,

                cm.creator_choice,
                cm.status,

                cm.created_at,
                cm.updated_at,

                u.roblox_username AS creator_username,
                u.roblox_display_name AS creator_display_name,
                u.avatar_url AS creator_avatar_url,

                COALESCE(
                    wagered_pets.pets,
                    '[]'::json
                ) AS pets,

                (
                    cm.creator_id = $1
                ) AS is_creator

            FROM coinflip_matches cm

            INNER JOIN users u
                ON u.id = cm.creator_id

            LEFT JOIN LATERAL (
                SELECT json_agg(
                    json_build_object(
                        'name', it.name,
                        'image', it.image,
                        'form', it.form,
                        'fly', it.fly,
                        'ride', it.ride,
                        'quantity', cmi.quantity,
                        'value', cmi.total_value
                    )
                    ORDER BY it.name ASC
                ) AS pets

                FROM coinflip_match_items cmi

                INNER JOIN items it
                    ON it.id = cmi.item_id

                WHERE cmi.match_id = cm.id
                  AND cmi.side = 'creator'
            ) wagered_pets
                ON TRUE

            WHERE cm.status = 'open'

            ORDER BY cm.created_at DESC
            `,
            [userId]
        );

        return res.json({
            success: true,
            matches: result.rows
        });

    } catch (error) {
        console.error(
            "Load coinflip matches error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: "Failed to load coinflip matches."
        });
    }
});


/* =========================================================
   CREATE COINFLIP MATCH
   ========================================================= */

router.post("/create", async (req, res) => {
    const userId =
        req.session.userId ||
        req.session.user?.id;

    const {
        items,
        creatorChoice,
        maxJoinPets
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            error: "Please select at least one pet."
        });
    }

    const parsedMaxJoinPets = Number(maxJoinPets);

    if (
        !Number.isInteger(parsedMaxJoinPets) ||
        parsedMaxJoinPets < 1 ||
        parsedMaxJoinPets > 100
    ) {
        return res.status(400).json({
            success: false,
            error: "Choose a maximum of 1 to 100 pets for the joiner."
        });
    }

    if (
        creatorChoice !== "heads" &&
        creatorChoice !== "tails"
    ) {
        return res.status(400).json({
            success: false,
            error: "Please choose Heads or Tails."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * Prevent duplicate inventory IDs from being submitted.
         */
        const requestedItems = new Map();

        for (const item of items) {
            if (!item || !item.inventoryId) {
                throw new Error(
                    "Invalid inventory item."
                );
            }

            const inventoryId =
                String(item.inventoryId);

            const quantity = Math.max(
                1,
                Number(item.quantity) || 1
            );

            requestedItems.set(
                inventoryId,
                (
                    requestedItems.get(inventoryId) || 0
                ) + quantity
            );
        }

        const inventoryIds =
            Array.from(requestedItems.keys());

        /*
         * Lock the inventory rows while creating
         * the match so the same pets cannot be
         * used in another match simultaneously.
         */
        const inventoryResult = await client.query(
            `
            SELECT
                i.id,
                i.user_id,
                i.item_id,
                i.quantity,
                i.locked_quantity,

                it.name,
                it.form,
                it.fly,
                it.ride,
                it.value,
                it.image

            FROM inventory i

            INNER JOIN items it
                ON it.id = i.item_id
                AND COALESCE(it.is_deleted, FALSE) = FALSE

            WHERE i.id = ANY($1::uuid[])
              AND i.user_id = $2

            FOR UPDATE
            `,
            [
                inventoryIds,
                userId
            ]
        );

        if (
            inventoryResult.rows.length !==
            inventoryIds.length
        ) {
            throw new Error(
                "One or more selected pets could not be found in your inventory."
            );
        }

        let creatorValue = 0;

        const selectedRows = [];

        for (const row of inventoryResult.rows) {
            const requestedQuantity =
                requestedItems.get(
                    String(row.id)
                ) || 0;

            const availableQuantity =
                Number(row.quantity) -
                Number(row.locked_quantity || 0);

            if (
                requestedQuantity <= 0 ||
                requestedQuantity > availableQuantity
            ) {
                throw new Error(
                    `Not enough available quantity for ${row.name}.`
                );
            }

            const valuePerItem =
                Number(row.value) || 0;

            if (valuePerItem <= 0) {
                throw new Error(
                    `${row.name} does not have a valid value.`
                );
            }

            const totalItemValue =
                valuePerItem *
                requestedQuantity;

            creatorValue += totalItemValue;

            selectedRows.push({
                ...row,
                requestedQuantity,
                valuePerItem,
                totalItemValue
            });
        }

        if (creatorValue <= 0) {
            throw new Error(
                "Your wager must be greater than zero."
            );
        }

        /*
         * Joiner must be between 95% and 105%
         * of the creator's wager.
         */
        const minJoinValue =
            Math.floor(
                creatorValue * 0.95
            );

        const maxJoinValue =
            Math.ceil(
                creatorValue * 1.05
            );

        /*
         * The initial total is the creator's wager.
         * Once somebody joins, this will become:
         *
         * creator + joiner
         */
        const estimatedTotalValue =
            creatorValue;

        /*
         * Tax is calculated only after both sides join because the
         * final pot and the complete pet list are required. Do not
         * display a creator-only tax estimate for open matches.
         */
        const estimatedTaxValue = 0;
        const estimatedPayoutValue = estimatedTotalValue;

        const matchId = uuidv4();

        /*
         * Lock the selected inventory.
         */
        for (const row of selectedRows) {
            await client.query(
                `
                UPDATE inventory

                SET locked_quantity =
                    locked_quantity + $1

                WHERE id = $2
                  AND user_id = $3
                `,
                [
                    row.requestedQuantity,
                    row.id,
                    userId
                ]
            );
        }

        /*
         * Create the match.
         */
        await client.query(
            `
            INSERT INTO coinflip_matches (
                id,
                creator_id,

                creator_value,
                joiner_value,

                total_value,
                tax_value,
                payout_value,

                tax_rate,

                min_join_value,
                max_join_value,
                max_join_pets,

                creator_choice,

                status,
                updated_at
            )

            VALUES (
                $1,
                $2,

                $3,
                0,

                $4,
                $5,
                $6,

                $7,

                $8,
                $9,
                $10,

                $11,

                'open',
                CURRENT_TIMESTAMP
            )
            `,
            [
                matchId,
                userId,

                creatorValue,
                estimatedTotalValue,
                estimatedTaxValue,
                estimatedPayoutValue,

                TAX_RATE,

                minJoinValue,
                maxJoinValue,
                parsedMaxJoinPets,

                creatorChoice
            ]
        );

        /*
         * Store every pet being wagered.
         */
        for (const row of selectedRows) {
            await client.query(
                `
                INSERT INTO coinflip_match_items (
                    id,
                    match_id,
                    user_id,
                    inventory_id,
                    item_id,
                    side,
                    quantity,
                    value_per_item,
                    total_value
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    'creator',
                    $6,
                    $7,
                    $8
                )
                `,
                [
                    uuidv4(),
                    matchId,
                    userId,
                    row.id,
                    row.item_id,
                    row.requestedQuantity,
                    row.valuePerItem,
                    row.totalItemValue
                ]
            );
        }

        await client.query("COMMIT");

        return res.json({
            success: true,
            match: {
                id: matchId,
                creatorValue,
                minJoinValue,
                maxJoinValue,
                maxJoinPets: parsedMaxJoinPets,
                creatorChoice,
                status: "open"
            }
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(
            "Create coinflip match error:",
            error
        );

        return res.status(400).json({
            success: false,
            error:
                error.message ||
                "Failed to create coinflip match."
        });

    } finally {
        client.release();
    }
});


/* =========================================================
   JOIN AND SETTLE COINFLIP MATCH
   ========================================================= */

router.post("/:matchId/join", async (req, res) => {
    const userId =
        req.session.userId ||
        req.session.user?.id;

    const { matchId } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            error: "Please select at least one pet to join."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * Lock the match so two people cannot
         * join and settle it simultaneously.
         */
        const matchResult = await client.query(
            `
            SELECT *
            FROM coinflip_matches
            WHERE id = $1
            FOR UPDATE
            `,
            [matchId]
        );

        if (!matchResult.rows.length) {
            throw new Error(
                "Coinflip match not found."
            );
        }

        const match = matchResult.rows[0];

        if (match.status !== "open") {
            throw new Error(
                "This match is no longer open."
            );
        }

        if (
            String(match.creator_id) ===
            String(userId)
        ) {
            throw new Error(
                "You cannot join your own match."
            );
        }

        /*
         * Combine duplicate inventory IDs.
         */
        const requestedItems = new Map();

        for (const item of items) {
            if (!item || !item.inventoryId) {
                throw new Error(
                    "Invalid inventory item."
                );
            }

            const inventoryId =
                String(item.inventoryId);

            const quantity = Math.max(
                1,
                Number(item.quantity) || 1
            );

            requestedItems.set(
                inventoryId,
                (
                    requestedItems.get(inventoryId) || 0
                ) + quantity
            );
        }

        const inventoryIds =
            Array.from(requestedItems.keys());

        const requestedPetCount = Array.from(requestedItems.values())
            .reduce((total, quantity) => total + quantity, 0);

        const maxJoinPets = Number(match.max_join_pets) || 0;

        if (maxJoinPets > 0 && requestedPetCount > maxJoinPets) {
            throw new Error(
                `This match allows a maximum of ${maxJoinPets} pets.`
            );
        }

        /*
         * Lock joiner's inventory rows.
         */
        const inventoryResult = await client.query(
            `
            SELECT
                i.id,
                i.item_id,
                i.quantity,
                i.locked_quantity,
                it.value

            FROM inventory i

            INNER JOIN items it
                ON it.id = i.item_id
                AND COALESCE(it.is_deleted, FALSE) = FALSE

            WHERE i.id = ANY($1::uuid[])
              AND i.user_id = $2

            FOR UPDATE
            `,
            [
                inventoryIds,
                userId
            ]
        );

        if (
            inventoryResult.rows.length !==
            inventoryIds.length
        ) {
            throw new Error(
                "One or more selected pets could not be found."
            );
        }

        let joinerValue = 0;

        const joinerItems = [];

        for (const row of inventoryResult.rows) {
            const requestedQuantity =
                requestedItems.get(
                    String(row.id)
                ) || 0;

            const availableQuantity =
                Number(row.quantity) -
                Number(row.locked_quantity || 0);

            if (
                requestedQuantity <= 0 ||
                requestedQuantity > availableQuantity
            ) {
                throw new Error(
                    "One or more selected pets are unavailable."
                );
            }

            const valuePerItem =
                Number(row.value) || 0;

            if (valuePerItem <= 0) {
                throw new Error(
                    "Every selected pet must have a valid value."
                );
            }

            const totalValue =
                valuePerItem *
                requestedQuantity;

            joinerValue += totalValue;

            joinerItems.push({
                inventoryId: row.id,
                itemId: row.item_id,
                quantity: requestedQuantity,
                valuePerItem,
                totalValue
            });
        }

        if (
            joinerValue <
            Number(match.min_join_value) ||
            joinerValue >
            Number(match.max_join_value)
        ) {
            throw new Error(
                `Your wager must be between ${match.min_join_value} and ${match.max_join_value}.`
            );
        }

        /*
         * Lock the joiner's wagered inventory.
         */
        for (const item of joinerItems) {
            await client.query(
                `
                UPDATE inventory
                SET locked_quantity =
                    locked_quantity + $1
                WHERE id = $2
                  AND user_id = $3
                `,
                [
                    item.quantity,
                    item.inventoryId,
                    userId
                ]
            );

            await client.query(
                `
                INSERT INTO coinflip_match_items (
                    id,
                    match_id,
                    user_id,
                    inventory_id,
                    item_id,
                    side,
                    quantity,
                    value_per_item,
                    total_value
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    'joiner',
                    $6,
                    $7,
                    $8
                )
                `,
                [
                    uuidv4(),
                    matchId,
                    userId,
                    item.inventoryId,
                    item.itemId,
                    item.quantity,
                    item.valuePerItem,
                    item.totalValue
                ]
            );
        }

        /*
         * Determine the coinflip result on the server.
         */
        const resultSide =
            crypto.randomInt(0, 2) === 0
                ? "heads"
                : "tails";

        /*
         * The creator wins if the result matches
         * their chosen side. Otherwise the joiner wins.
         */
        const winnerId =
            resultSide === match.creator_choice
                ? match.creator_id
                : userId;

        /*
         * Get every wager in this match.
         */
        const totalValue =
            Number(match.creator_value) +
            joinerValue;

        const allWagersResult =
            await client.query(
                `
                SELECT
                    cmi.id,
                    cmi.inventory_id,
                    cmi.item_id,
                    cmi.user_id,
                    cmi.quantity,
                    cmi.value_per_item,
                    cmi.total_value,
                    it.name AS item_name,
                    it.form,
                    it.fly,
                    it.ride

                FROM coinflip_match_items cmi
                INNER JOIN items it
                    ON it.id = cmi.item_id

                WHERE cmi.match_id = $1

                FOR UPDATE
                `,
                [matchId]
            );

        const { taxValue, taxedQuantities } =
            selectTaxedWagers(allWagersResult.rows, totalValue);

        const taxedPets = allWagersResult.rows
            .map(wager => {
                const taxedQuantity = Math.min(
                    Number(wager.quantity || 0),
                    Number(taxedQuantities.get(String(wager.id)) || 0)
                );

                if (taxedQuantity <= 0) return null;

                const traits = [
                    wager.form && wager.form !== "normal" ? wager.form : null,
                    wager.fly && wager.ride ? "FR" : wager.fly ? "F" : wager.ride ? "R" : null
                ].filter(Boolean).join(" · ");

                return {
                    name: wager.item_name || "Unknown pet",
                    traits,
                    quantity: taxedQuantity,
                    value: Number(wager.value_per_item || 0) * taxedQuantity,
                    userId: wager.user_id
                };
            })
            .filter(Boolean);

        /*
         * SETTLE ALL WAGERS
         *
         * Taxed whole pets are removed from the pot and are not
         * credited to the winner. All remaining pets go to the winner.
         *
         * Important:
         * inventory.quantity must remain positive.
         *
         * If somebody wagers their entire stack,
         * we DELETE the inventory row instead of
         * changing quantity to 0.
         */
        for (
            const wageredItem
            of allWagersResult.rows
        ) {
            const quantity =
                Number(wageredItem.quantity);

            if (
                !Number.isInteger(quantity) ||
                quantity <= 0
            ) {
                throw new Error(
                    "Invalid wager quantity during settlement."
                );
            }

            /*
             * Lock and read the original inventory row.
             */
            const inventoryResult =
                await client.query(
                    `
                    SELECT
                        id,
                        quantity,
                        locked_quantity

                    FROM inventory

                    WHERE id = $1
                      AND user_id = $2

                    FOR UPDATE
                    `,
                    [
                        wageredItem.inventory_id,
                        wageredItem.user_id
                    ]
                );

            if (!inventoryResult.rows.length) {
                throw new Error(
                    "A wagered pet could not be found during settlement."
                );
            }

            const inventoryRow =
                inventoryResult.rows[0];

            const currentQuantity =
                Number(inventoryRow.quantity);

            const currentLockedQuantity =
                Number(
                    inventoryRow.locked_quantity || 0
                );

            /*
             * Make sure the inventory contains enough
             * of this item to cover the wager.
             */
            if (quantity > currentQuantity) {
                throw new Error(
                    "A wagered pet does not have enough quantity."
                );
            }

            /*
             * Make sure the wager is actually locked.
             */
            if (quantity > currentLockedQuantity) {
                throw new Error(
                    "A wagered pet has an invalid locked quantity."
                );
            }

            const newQuantity =
                currentQuantity - quantity;

            /*
             * If the entire inventory stack was wagered,
             * remove the row entirely.
             *
             * This prevents:
             *
             * quantity = 0
             *
             * which violates the positive_quantity
             * database constraint.
             */
            if (newQuantity === 0) {
                await client.query(
                    `
                    DELETE FROM inventory
                    WHERE id = $1
                      AND user_id = $2
                    `,
                    [
                        wageredItem.inventory_id,
                        wageredItem.user_id
                    ]
                );

            } else {
                /*
                 * Otherwise reduce the quantity and
                 * unlock the wagered amount.
                 */
                await client.query(
                    `
                    UPDATE inventory
                    SET
                        quantity = $1,
                        locked_quantity = $2

                    WHERE id = $3
                      AND user_id = $4
                    `,
                    [
                        newQuantity,
                        currentLockedQuantity -
                            quantity,
                        wageredItem.inventory_id,
                        wageredItem.user_id
                    ]
                );
            }

            const taxedQuantity = Math.min(
                quantity,
                Number(taxedQuantities.get(String(wageredItem.id)) || 0)
            );

            const winnerQuantity = quantity - taxedQuantity;

            /*
             * Credit only the non-taxed portion of the wagered item
             * to the winner. Taxed pets are intentionally removed.
             */
            if (winnerQuantity <= 0) {
                continue;
            }

            const winnerItem =
                await client.query(
                    `
                    SELECT id
                    FROM inventory

                    WHERE user_id = $1
                      AND item_id = $2

                    ORDER BY id

                    LIMIT 1

                    FOR UPDATE
                    `,
                    [
                        winnerId,
                        wageredItem.item_id
                    ]
                );

            if (winnerItem.rows.length) {
                await client.query(
                    `
                    UPDATE inventory

                    SET quantity =
                        quantity + $1

                    WHERE id = $2
                    `,
                    [
                        winnerQuantity,
                        winnerItem.rows[0].id
                    ]
                );

            } else {
                await client.query(
                    `
                    INSERT INTO inventory (
                        id,
                        user_id,
                        item_id,
                        quantity,
                        locked_quantity
                    )

                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        0
                    )
                    `,
                    [
                        uuidv4(),
                        winnerId,
                        wageredItem.item_id,
                        winnerQuantity
                    ]
                );
            }
        }

        /*
         * Final values were calculated before settlement so the
         * selected whole-pet tax can be applied consistently.
         */

        /*
         * Mark the match as completed.
         */
        await client.query(
            `
            UPDATE coinflip_matches

            SET
                joiner_id = $1,
                joiner_value = $2,
                total_value = $3,
                tax_value = $4,
                payout_value = $5,
                joiner_choice = $6,
                winner_id = $7,
                status = 'completed',
                joined_at = CURRENT_TIMESTAMP,
                completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $8
            `,
            [
                userId,
                joinerValue,
                totalValue,
                taxValue,
                totalValue - taxValue,
                match.creator_choice === "heads"
                    ? "tails"
                    : "heads",
                winnerId,
                matchId
            ]
        );

        await client.query("COMMIT");

        const taxWebhookUrl = String(process.env.DISCORD_TAX_WEBHOOK_URL || "").trim();
        if (taxWebhookUrl && taxedPets.length > 0) {
            const taxLines = taxedPets.map(pet =>
                `• ${pet.name}${pet.traits ? ` (${pet.traits})` : ""} ×${pet.quantity} — 💎 ${pet.value.toLocaleString("en-US")} — User: ${pet.userId}`
            ).join("\n");

            try {
                const webhookResponse = await fetch(`${taxWebhookUrl}${taxWebhookUrl.includes("?") ? "&" : "?"}wait=true`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: "CrazyAMP Tax",
                        embeds: [{
                            title: "🧾 Coinflip Tax Collected",
                            color: 0xf59e0b,
                            fields: [
                                { name: "Match ID", value: String(matchId), inline: false },
                                { name: "Total Pot", value: `💎 ${totalValue.toLocaleString("en-US")}`, inline: true },
                                { name: "Tax Target", value: "10%", inline: true },
                                { name: "Actual Tax", value: `💎 ${taxValue.toLocaleString("en-US")}`, inline: true },
                                { name: "Taxed Pets", value: taxLines.slice(0, 1024) || "None", inline: false },
                                { name: "Winner ID", value: String(winnerId), inline: false }
                            ],
                            timestamp: new Date().toISOString(),
                            footer: { text: "CrazyAMP coinflip tax system" }
                        }],
                        allowed_mentions: { parse: [] }
                    })
                });

                const webhookResponseBody = await webhookResponse.text();
                if (!webhookResponse.ok) {
                    console.error("Discord tax webhook failed:", webhookResponse.status, webhookResponseBody);
                } else {
                    console.log("Discord tax webhook sent successfully:", webhookResponse.status);
                }
            } catch (webhookError) {
                console.error("Discord tax webhook error:", webhookError.message);
            }
        } else if (!taxWebhookUrl && taxedPets.length > 0) {
            console.error("DISCORD_TAX_WEBHOOK_URL is not configured. Add it to Railway Variables and redeploy.");
        }

        /*
         * Return the actual server-side result
         * to the frontend animation.
         */
        return res.json({
            success: true,
            result: resultSide,
            winnerId,
            taxValue,
            payoutValue: totalValue - taxValue,
            taxRate: Number(match.tax_rate || TAX_RATE),
            winner:
                String(winnerId) ===
                String(userId)
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(
            "Join coinflip match error:",
            error
        );

        return res.status(400).json({
            success: false,
            error:
                error.message ||
                "Failed to settle coinflip match."
        });

    } finally {
        client.release();
    }
});


/* =========================================================
   CANCEL COINFLIP MATCH
   ========================================================= */

router.post("/:matchId/cancel", async (req, res) => {
    const userId =
        req.session.userId ||
        req.session.user?.id;

    const {
        matchId
    } = req.params;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * Lock the match so it cannot be cancelled
         * at the same time as another action.
         */
        const matchResult = await client.query(
            `
            SELECT
                id,
                creator_id,
                status

            FROM coinflip_matches

            WHERE id = $1

            FOR UPDATE
            `,
            [matchId]
        );

        if (!matchResult.rows.length) {
            throw new Error(
                "Coinflip match not found."
            );
        }

        const match =
            matchResult.rows[0];

        if (
            String(match.creator_id) !==
            String(userId)
        ) {
            throw new Error(
                "You can only cancel your own match."
            );
        }

        if (match.status !== "open") {
            throw new Error(
                "This match can no longer be cancelled."
            );
        }

        /*
         * Get all creator items.
         */
        const itemsResult =
            await client.query(
                `
                SELECT
                    inventory_id,
                    quantity

                FROM coinflip_match_items

                WHERE match_id = $1
                  AND side = 'creator'
                `,
                [matchId]
            );

        /*
         * Unlock the pets.
         */
        for (const item of itemsResult.rows) {
            await client.query(
                `
                UPDATE inventory

                SET locked_quantity =
                    GREATEST(
                        0,
                        locked_quantity - $1
                    )

                WHERE id = $2
                  AND user_id = $3
                `,
                [
                    Number(item.quantity),
                    item.inventory_id,
                    userId
                ]
            );
        }

        /*
         * Cancel the match.
         */
        await client.query(
            `
            UPDATE coinflip_matches

            SET
                status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $1
            `,
            [matchId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(
            "Cancel coinflip match error:",
            error
        );

        return res.status(400).json({
            success: false,
            error:
                error.message ||
                "Failed to cancel coinflip match."
        });

    } finally {
        client.release();
    }
});


module.exports = router;

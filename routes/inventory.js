const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const pool = require("../db");


// ==========================================
// GET INVENTORY
// ==========================================

router.get("/", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.status(401).json({
                success: false,
                message: "You must be logged in."
            });

        }


        const userId =
            req.session.user.id;


        const result =
            await pool.query(
                `
                SELECT
                    inventory.id,
                    (
                        inventory.quantity -
                        COALESCE(
                            inventory.locked_quantity,
                            0
                        )
                    ) AS available_quantity,

                    items.id AS item_id,
                    items.name,
                    items.form,
                    items.fly,
                    items.ride,
                    items.value,
                    items.image

                FROM inventory

                INNER JOIN items
                    ON inventory.item_id = items.id
                    AND COALESCE(items.is_deleted, FALSE) = FALSE

                WHERE inventory.user_id = $1
                  AND (
                      inventory.quantity -
                      COALESCE(
                          inventory.locked_quantity,
                          0
                  )) > 0

                ORDER BY items.value DESC
                `,
                [userId]
            );


        let totalValue = 0;


        const items =
            result.rows.map(item => {

                const quantity =
                    Number(item.available_quantity) || 0;


                const value =
                    Number(item.value) || 0;


                const totalItemValue =
                    value * quantity;


                totalValue +=
                    totalItemValue;


                return {

                    id: item.id,

                    itemId: item.item_id,

                    name: item.name,

                    form: item.form,

                    fly: item.fly,

                    ride: item.ride,

                    quantity: quantity,

                    value: value,

                    totalValue:
                        totalItemValue,

                    image: item.image

                };

            });


        return res.json({

            success: true,

            inventory: {

                itemCount:
                    items.length,

                totalValue:
                    totalValue,

                items:
                    items

            }

        });


    } catch (error) {

        console.error(
            "Inventory error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to load inventory."

        });

    }

});



// ==========================================
// CREATE DEPOSIT
// ==========================================

router.post("/deposit", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.status(401).json({

                success: false,

                message:
                    "You must be logged in."

            });

        }


        const userId =
            req.session.user.id;


        const depositId =
            crypto.randomUUID();


        const result =
            await pool.query(
                `
                INSERT INTO deposits (
                    id,
                    user_id,
                    status
                )

                VALUES (
                    $1,
                    $2,
                    'pending'
                )

                RETURNING
                    id,
                    user_id,
                    status,
                    trade_id,
                    created_at,
                    completed_at
                `,
                [
                    depositId,
                    userId
                ]
            );


        const deposit =
            result.rows[0];


        return res.status(201).json({

            success: true,

            message:
                "Deposit request created successfully.",

            deposit: {

                id:
                    deposit.id,

                status:
                    deposit.status,

                tradeId:
                    deposit.trade_id,

                createdAt:
                    deposit.created_at,

                completedAt:
                    deposit.completed_at

            }

        });


    } catch (error) {

        console.error(
            "Create deposit error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to create deposit request."

        });

    }

});



// ==========================================
// CREATE WITHDRAWAL
// ==========================================

router.post("/withdraw", async (req, res) => {
    const client = await pool.connect();

    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "You must be logged in."
            });
        }

        const requestedItems = Array.isArray(req.body.items)
            ? req.body.items
            : [];

        if (requestedItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Select at least one item to withdraw."
            });
        }

        const userId = req.session.user.id;
        const withdrawalId = crypto.randomUUID();

        const itemIds = [...new Set(
            requestedItems
                .map(item => String(item.inventoryId || item.id || ""))
                .filter(Boolean)
        )];

        await client.query("BEGIN");

        const inventoryResult = await client.query(
            `
            SELECT
                inventory.id,
                inventory.quantity,
                COALESCE(inventory.locked_quantity, 0) AS locked_quantity,
                items.name,
                items.form,
                items.fly,
                items.ride,
                items.value,
                items.image
            FROM inventory
            INNER JOIN items
                ON items.id = inventory.item_id
                AND COALESCE(items.is_deleted, FALSE) = FALSE
            WHERE inventory.user_id = $1
              AND inventory.id = ANY($2::uuid[])
            FOR UPDATE
            `,
            [userId, itemIds]
        );

        if (inventoryResult.rows.length !== itemIds.length) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "One or more selected items are no longer available."
            });
        }

        const withdrawalItems = [];
        let totalValue = 0;

        for (const row of inventoryResult.rows) {
            const availableQuantity =
                Number(row.quantity) - Number(row.locked_quantity || 0);

            if (availableQuantity <= 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: `${row.name} is no longer available.`
                });
            }

            const requested = requestedItems.find(item =>
                String(item.inventoryId || item.id || "") === String(row.id)
            );

            const quantity = Math.min(
                Math.max(Number(requested?.quantity) || availableQuantity, 1),
                availableQuantity
            );

            const itemValue = Number(row.value) || 0;
            totalValue += itemValue * quantity;

            withdrawalItems.push({
                inventoryId: row.id,
                name: row.name,
                form: row.form,
                fly: row.fly,
                ride: row.ride,
                value: itemValue,
                quantity,
                image: row.image
            });

            await client.query(
                `
                UPDATE inventory
                SET locked_quantity = COALESCE(locked_quantity, 0) + $1
                WHERE id = $2
                `,
                [quantity, row.id]
            );
        }

        await client.query(
            `
            INSERT INTO withdrawals (id, user_id, status, total_value)
            VALUES ($1, $2, 'pending', $3)
            `,
            [withdrawalId, userId, totalValue]
        );

        for (const item of withdrawalItems) {
            await client.query(
                `
                INSERT INTO withdrawal_items
                    (id, withdrawal_id, inventory_id, item_name, item_value, quantity, item_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
                `,
                [
                    crypto.randomUUID(),
                    withdrawalId,
                    item.inventoryId,
                    item.name,
                    item.value,
                    item.quantity,
                    JSON.stringify(item)
                ]
            );
        }

        await client.query("COMMIT");

        const webhookUrl = process.env.DISCORD_WITHDRAW_WEBHOOK_URL;
        if (webhookUrl) {
            const username =
                req.session.user.roblox_username ||
                req.session.user.username ||
                req.session.user.displayName ||
                "Unknown user";

            const itemLines = withdrawalItems.map(item => {
                const traits = [
                    item.form && item.form !== "normal" ? item.form : null,
                    item.fly && item.ride ? "FR" : item.fly ? "F" : item.ride ? "R" : null
                ].filter(Boolean).join(" · ");

                return `• ${item.name}${traits ? ` (${traits})` : ""} ×${item.quantity} — 💎 ${(item.value * item.quantity).toLocaleString("en-US")}`;
            }).join("\n");

            try {
                const webhookResponse = await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: "CrazyAMP Withdrawals",
                        embeds: [{
                            title: "📤 New Withdrawal Request",
                            color: 0x22c55e,
                            fields: [
                                { name: "User", value: String(username).slice(0, 1024), inline: true },
                                { name: "User ID", value: String(userId), inline: true },
                                { name: "Withdrawal ID", value: withdrawalId, inline: false },
                                { name: "Pets", value: itemLines.slice(0, 1024) || "None", inline: false },
                                { name: "Total Value", value: `💎 ${totalValue.toLocaleString("en-US")}`, inline: true },
                                { name: "Status", value: "Pending", inline: true }
                            ],
                            timestamp: new Date().toISOString(),
                            footer: { text: "CrazyAMP withdrawal system" }
                        }],
                        allowed_mentions: { parse: [] }
                    })
                });

                if (!webhookResponse.ok) {
                    console.error("Discord withdrawal webhook failed:", webhookResponse.status);
                }
            } catch (webhookError) {
                console.error("Discord withdrawal webhook error:", webhookError.message);
            }
        } else {
            console.warn("DISCORD_WITHDRAW_WEBHOOK_URL is not configured.");
        }

        return res.status(201).json({
            success: true,
            message: "Withdrawal request submitted successfully.",
            withdrawal: {
                id: withdrawalId,
                status: "pending",
                totalValue,
                items: withdrawalItems
            }
        });
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (_) {}

        console.error("Create withdrawal error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create withdrawal request."
        });
    } finally {
        client.release();
    }
});


// ==========================================
// GET DEPOSIT STATUS
// ==========================================

router.get("/deposit/:id", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.status(401).json({

                success: false,

                message:
                    "You must be logged in."

            });

        }


        const userId =
            req.session.user.id;


        const depositId =
            req.params.id;


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    status,
                    trade_id,
                    created_at,
                    completed_at

                FROM deposits

                WHERE id = $1
                AND user_id = $2
                `,
                [
                    depositId,
                    userId
                ]
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Deposit not found."

            });

        }


        const deposit =
            result.rows[0];


        return res.json({

            success: true,

            deposit: {

                id:
                    deposit.id,

                status:
                    deposit.status,

                tradeId:
                    deposit.trade_id,

                createdAt:
                    deposit.created_at,

                completedAt:
                    deposit.completed_at

            }

        });


    } catch (error) {

        console.error(
            "Get deposit error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to get deposit status."

        });

    }

});



module.exports = router;

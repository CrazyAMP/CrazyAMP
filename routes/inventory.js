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

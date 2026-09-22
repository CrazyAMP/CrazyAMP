const express = require("express");
const crypto = require("crypto");

const pool = require("../db");

const router = express.Router();


// ==========================================
// ADD ITEM
// ==========================================

router.post("/", async (req, res) => {

    try {

        const {
            name,
            form,
            fly,
            ride,
            value,
            image
        } = req.body;


        // ======================================
        // VALIDATE NAME
        // ======================================

        if (!name || !name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Pet name is required."
            });

        }


        // ======================================
        // VALIDATE FORM
        // ======================================

        const validForms = [
            "normal",
            "neon",
            "mega"
        ];

        const selectedForm =
            form || "normal";


        if (!validForms.includes(selectedForm)) {

            return res.status(400).json({
                success: false,
                message:
                    "Form must be normal, neon or mega."
            });

        }


        // ======================================
        // VALIDATE VALUE
        // ======================================

        const numericValue =
            Number(value);


        if (
            !Number.isFinite(numericValue) ||
            numericValue < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Value must be a valid positive number."
            });

        }


        // ======================================
        // CREATE ITEM
        // ======================================

        const itemId =
            crypto.randomUUID();


        const result =
            await pool.query(
                `
                INSERT INTO items (
                    id,
                    name,
                    form,
                    fly,
                    ride,
                    value,
                    image
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )
                RETURNING
                    id,
                    name,
                    form,
                    fly,
                    ride,
                    value,
                    image
                `,
                [
                    itemId,

                    name.trim(),

                    selectedForm,

                    Boolean(fly),

                    Boolean(ride),

                    Math.floor(
                        numericValue
                    ),

                    image
                        ? image.trim()
                        : null
                ]
            );


        const item =
            result.rows[0];


        return res.status(201).json({

            success: true,

            message:
                "Item created successfully.",

            item: {
                id: item.id,

                name: item.name,

                form: item.form,

                fly: item.fly,

                ride: item.ride,

                value: Number(
                    item.value
                ),

                image: item.image
            }

        });


    } catch (error) {

        console.error(
            "Item creation error:"
        );

        console.error(error);


        return res.status(500).json({

            success: false,

            message:
                "Failed to create item."

        });

    }

});


// ==========================================
// GET ALL ITEMS
// ==========================================

router.get("/", async (req, res) => {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    form,
                    fly,
                    ride,
                    value,
                    image,
                    created_at
                FROM items
                WHERE COALESCE(is_deleted, FALSE) = FALSE
                ORDER BY
                    name ASC,
                    form ASC,
                    fly ASC,
                    ride ASC
                `
            );


        return res.json({

            success: true,

            items:
                result.rows.map(item => ({

                    id: item.id,

                    name: item.name,

                    form: item.form,

                    fly: item.fly,

                    ride: item.ride,

                    value: Number(
                        item.value
                    ),

                    image: item.image,

                    createdAt:
                        item.created_at

                }))

        });


    } catch (error) {

        console.error(
            "Item fetch error:"
        );

        console.error(error);


        return res.status(500).json({

            success: false,

            message:
                "Failed to load items."

        });

    }

});


module.exports = router;

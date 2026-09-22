require("dotenv").config();

const crypto = require("crypto");
const pool = require("../db");

async function addTestPet() {
    try {
        console.log("Adding test pet...");

        // Find the first registered user
        const userResult = await pool.query(`
            SELECT id, roblox_username
            FROM users
            ORDER BY created_at ASC
            LIMIT 1
        `);

        if (userResult.rows.length === 0) {
            console.log(
                "No users found. Log into the website with Roblox first."
            );

            return;
        }

        const user = userResult.rows[0];

        console.log(
            `Adding test pet to ${user.roblox_username}...`
        );


        // Create the test item
        const itemId = crypto.randomUUID();

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
            `,
            [
                itemId,

                "Bat Dragon",

                "neon",

                true,

                true,

                100000,

                null
            ]
        );


        // Add the item to the user's inventory
        const inventoryId =
            crypto.randomUUID();

        await pool.query(
            `
            INSERT INTO inventory (
                id,
                user_id,
                item_id,
                quantity
            )
            VALUES (
                $1,
                $2,
                $3,
                $4
            )
            `,
            [
                inventoryId,

                user.id,

                itemId,

                1
            ]
        );


        console.log(
            "Test pet added successfully!"
        );

        console.log("");
        console.log(
            "Pet: Neon Fly Ride Bat Dragon"
        );
        console.log(
            "Value: 100,000"
        );

    } catch (error) {

        console.error(
            "Failed to add test pet:"
        );

        console.error(error);

    } finally {

        await pool.end();

    }
}

addTestPet();
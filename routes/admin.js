const express = require("express");
const crypto = require("crypto");
const pool = require("../db");

const router = express.Router();

function isSuperOwner(req) {
    const username =
        req.session?.user?.username ||
        req.session?.user?.roblox_username ||
        req.session?.user?.displayName ||
        "";

    return String(username).toLowerCase() === "skyez3rs";
}

const adminReady = (async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_whitelist (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            added_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Keep old matches and inventories intact when a catalogue pet is removed.
    await pool.query(`
        ALTER TABLE items
            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    `);
})();

async function isAdmin(req) {
    if (isSuperOwner(req)) return true;

    const userId = req.session?.user?.id;
    if (!userId) return false;

    await adminReady;
    const result = await pool.query(
        "SELECT 1 FROM admin_whitelist WHERE user_id = $1",
        [userId]
    );

    return result.rows.length > 0;
}

async function requireAdmin(req, res, next) {
    try {
        if (await isAdmin(req)) return next();

        return res.status(403).json({
            success: false,
            message: "Admin access is required."
        });
    } catch (error) {
        console.error("Admin access error:", error);
        return res.status(500).json({ success: false, message: "Could not verify admin access." });
    }
}

router.use(requireAdmin);

function requireSuperOwner(req, res, next) {
    if (isSuperOwner(req)) return next();
    return res.status(403).json({ success: false, message: "Only the owner can manage admin access." });
}

router.get("/whitelist", requireSuperOwner, async (req, res) => {
    try {
        await adminReady;
        const result = await pool.query(`
            SELECT aw.user_id, u.roblox_username, u.roblox_display_name, u.avatar_url, aw.created_at
            FROM admin_whitelist aw
            INNER JOIN users u ON u.id = aw.user_id
            ORDER BY u.roblox_username ASC
        `);
        return res.json({ success: true, admins: result.rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not load the whitelist." });
    }
});

router.post("/whitelist", requireSuperOwner, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "Choose a player first." });

    try {
        await adminReady;
        const added = await pool.query(`
            INSERT INTO admin_whitelist (user_id, added_by)
            SELECT id, $2 FROM users WHERE id = $1
            ON CONFLICT (user_id) DO NOTHING
            RETURNING user_id
        `, [userId, req.session.user.id]);

        if (!added.rows.length) {
            const exists = await pool.query("SELECT 1 FROM users WHERE id = $1", [userId]);
            if (!exists.rows.length) return res.status(404).json({ success: false, message: "Player was not found." });
            return res.json({ success: true, message: "That player is already whitelisted." });
        }

        return res.status(201).json({ success: true, message: "Player added to the admin whitelist." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not update the whitelist." });
    }
});

router.delete("/whitelist/:userId", requireSuperOwner, async (req, res) => {
    try {
        await adminReady;
        await pool.query("DELETE FROM admin_whitelist WHERE user_id = $1", [req.params.userId]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Could not remove the admin." });
    }
});

router.get("/users", async (req, res) => {
    const query = String(req.query.query || "").trim();

    try {
        const result = await pool.query(
            `
            SELECT id, roblox_username, roblox_display_name, avatar_url
            FROM users
            WHERE LOWER(roblox_username) LIKE LOWER($1)
               OR LOWER(COALESCE(roblox_display_name, '')) LIKE LOWER($1)
            ORDER BY roblox_username ASC
            LIMIT 50
            `,
            [`%${query}%`]
        );

        return res.json({ success: true, users: result.rows });
    } catch (error) {
        console.error("Admin users error:", error);
        return res.status(500).json({ success: false, message: "Could not load players." });
    }
});

router.get("/pets", async (req, res) => {
    try {
        await adminReady;
        const result = await pool.query(`
            SELECT id, name, form, fly, ride, value, image
            FROM items
            WHERE COALESCE(is_deleted, FALSE) = FALSE
            ORDER BY name ASC, form ASC
        `);

        return res.json({ success: true, pets: result.rows });
    } catch (error) {
        console.error("Admin pets error:", error);
        return res.status(500).json({ success: false, message: "Could not load pets." });
    }
});

router.post("/pets", async (req, res) => {
    const { name, form = "normal", fly = false, ride = false, value, image = "" } = req.body;
    const numericValue = Number(value);

    if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, message: "Pet name is required." });
    }

    if (!["normal", "neon", "mega"].includes(form)) {
        return res.status(400).json({ success: false, message: "Invalid pet form." });
    }

    if (!Number.isSafeInteger(numericValue) || numericValue < 0) {
        return res.status(400).json({ success: false, message: "Value must be a whole number of zero or more." });
    }

    try {
        await adminReady;
        const result = await pool.query(
            `
            INSERT INTO items (id, name, form, fly, ride, value, image)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, name, form, fly, ride, value, image
            `,
            [crypto.randomUUID(), String(name).trim(), form, Boolean(fly), Boolean(ride), numericValue, String(image).trim() || null]
        );

        return res.status(201).json({ success: true, pet: result.rows[0] });
    } catch (error) {
        console.error("Admin create pet error:", error);
        return res.status(500).json({ success: false, message: "Could not create pet." });
    }
});

router.delete("/pets/:petId", async (req, res) => {
    try {
        await adminReady;
        const result = await pool.query(
            `
            UPDATE items
            SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND COALESCE(is_deleted, FALSE) = FALSE
            RETURNING id
            `,
            [req.params.petId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Pet was not found." });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error("Admin delete pet error:", error);
        return res.status(500).json({ success: false, message: "Could not delete pet." });
    }
});

router.post("/inventory", async (req, res) => {
    const { userId, petId, quantity = 1 } = req.body;
    const amount = Number(quantity);

    if (!userId || !petId || !Number.isSafeInteger(amount) || amount < 1 || amount > 999) {
        return res.status(400).json({ success: false, message: "Choose a player, pet, and quantity between 1 and 999." });
    }

    const client = await pool.connect();

    try {
        await adminReady;
        await client.query("BEGIN");

        const pet = await client.query(
            "SELECT id FROM items WHERE id = $1 AND COALESCE(is_deleted, FALSE) = FALSE",
            [petId]
        );
        const user = await client.query("SELECT id FROM users WHERE id = $1", [userId]);

        if (!pet.rows.length || !user.rows.length) {
            throw new Error("Player or pet was not found.");
        }

        const inventory = await client.query(
            `SELECT id FROM inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1 FOR UPDATE`,
            [userId, petId]
        );

        if (inventory.rows.length) {
            await client.query("UPDATE inventory SET quantity = quantity + $1 WHERE id = $2", [amount, inventory.rows[0].id]);
        } else {
            await client.query(
                "INSERT INTO inventory (id, user_id, item_id, quantity, locked_quantity) VALUES ($1, $2, $3, $4, 0)",
                [crypto.randomUUID(), userId, petId, amount]
            );
        }

        await client.query("COMMIT");
        return res.json({ success: true });
    } catch (error) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: error.message || "Could not add pet." });
    } finally {
        client.release();
    }
});

router.delete("/inventory", async (req, res) => {
    const { userId, petId, quantity = 1 } = req.body;
    const amount = Number(quantity);

    if (!userId || !petId || !Number.isSafeInteger(amount) || amount < 1 || amount > 999) {
        return res.status(400).json({ success: false, message: "Choose a player, pet, and quantity between 1 and 999." });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await client.query(
            `
            SELECT id, quantity, locked_quantity
            FROM inventory
            WHERE user_id = $1 AND item_id = $2
            LIMIT 1
            FOR UPDATE
            `,
            [userId, petId]
        );

        if (!result.rows.length) throw new Error("That player does not own this pet.");

        const item = result.rows[0];
        const available = Number(item.quantity) - Number(item.locked_quantity || 0);

        if (amount > available) {
            throw new Error("Cannot remove pets currently wagered in a coinflip.");
        }

        if (amount === Number(item.quantity)) {
            await client.query("DELETE FROM inventory WHERE id = $1", [item.id]);
        } else {
            await client.query("UPDATE inventory SET quantity = quantity - $1 WHERE id = $2", [amount, item.id]);
        }

        await client.query("COMMIT");
        return res.json({ success: true });
    } catch (error) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: error.message || "Could not remove pet." });
    } finally {
        client.release();
    }
});

module.exports = { router, isAdmin, isSuperOwner };

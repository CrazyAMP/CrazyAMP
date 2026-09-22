const express = require("express");
const pool = require("../db");

const router = express.Router();

function requireLogin(req, res, next) {
    if (!req.session?.user?.id) {
        return res.redirect("/");
    }

    next();
}

async function getAccountSummary(userId) {
    const result = await pool.query(
        `
        SELECT
            COALESCE(SUM(
                CASE WHEN creator_id = $1 THEN creator_value ELSE joiner_value END
            ) FILTER (WHERE status = 'completed'), 0) AS wagered,
            COALESCE(SUM(
                CASE WHEN winner_id = $1 THEN payout_value ELSE 0 END
            ) FILTER (WHERE status = 'completed'), 0) AS won_value,
            COUNT(*) FILTER (WHERE status = 'completed') AS games_played,
            COUNT(*) FILTER (WHERE status = 'completed' AND winner_id = $1) AS games_won
        FROM coinflip_matches
        WHERE creator_id = $1 OR joiner_id = $1
        `,
        [userId]
    );

    const summary = result.rows[0];
    const wagered = Number(summary.wagered) || 0;
    const wonValue = Number(summary.won_value) || 0;

    return {
        wagered,
        deposited: 0,
        withdrawn: 0,
        profit: wonValue - wagered,
        gamesPlayed: Number(summary.games_played) || 0,
        gamesWon: Number(summary.games_won) || 0
    };
}

async function getGameHistory(userId) {
    const result = await pool.query(
        `
        SELECT
            cm.id, cm.creator_id, cm.joiner_id, cm.creator_value,
            cm.joiner_value, cm.total_value, cm.creator_choice,
            cm.joiner_choice, cm.status, cm.winner_id, cm.created_at,
            cm.completed_at,
            creator.roblox_username AS creator_username,
            joiner.roblox_username AS joiner_username,
            (
                SELECT json_agg(json_build_object(
                    'name', i.name,
                    'image', i.image,
                    'quantity', cmi.quantity
                ) ORDER BY i.name)
                FROM coinflip_match_items cmi
                INNER JOIN items i ON i.id = cmi.item_id
                WHERE cmi.match_id = cm.id
                  AND cmi.user_id = $1
            ) AS your_pets
        FROM coinflip_matches cm
        INNER JOIN users creator ON creator.id = cm.creator_id
        LEFT JOIN users joiner ON joiner.id = cm.joiner_id
        WHERE cm.creator_id = $1 OR cm.joiner_id = $1
        ORDER BY COALESCE(cm.completed_at, cm.created_at) DESC
        LIMIT 100
        `,
        [userId]
    );

    return result.rows.map((game) => ({
        ...game,
        yourValue: String(game.creator_id) === String(userId)
            ? Number(game.creator_value)
            : Number(game.joiner_value),
        won: String(game.winner_id) === String(userId),
        opponent: String(game.creator_id) === String(userId)
            ? (game.joiner_username || "Waiting for opponent")
            : game.creator_username,
        yourPets: game.your_pets || []
    }));
}

router.get("/profile", requireLogin, async (req, res) => {
    try {
        const summary = await getAccountSummary(req.session.user.id);
        return res.render("profile", { user: req.session.user, summary });
    } catch (error) {
        console.error("Profile error:", error);
        return res.status(500).send("Could not load profile.");
    }
});

router.get("/history", requireLogin, async (req, res) => {
    try {
        const games = await getGameHistory(req.session.user.id);
        return res.render("history", { user: req.session.user, games });
    } catch (error) {
        console.error("Game history error:", error);
        return res.status(500).send("Could not load game history.");
    }
});

module.exports = router;

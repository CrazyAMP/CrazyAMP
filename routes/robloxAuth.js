const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const pool = require("../db");

const router = express.Router();

// ==========================================
// TEMPORARY VERIFICATION STORAGE
// ==========================================

const verificationCodes = new Map();

const VERIFICATION_EXPIRY = 10 * 60 * 1000;

// ==========================================
// ROBLOX LOOKUP
// ==========================================

router.post("/lookup", async (req, res) => {
    try {
        const { username } = req.body;

        if (!username || !username.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a Roblox username."
            });
        }

        const response = await axios.post(
            "https://users.roblox.com/v1/usernames/users",
            {
                usernames: [username.trim()],
                excludeBannedUsers: false
            },
            {
                timeout: 10000
            }
        );

        if (
            !response.data.data ||
            response.data.data.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message: "Roblox user not found."
            });
        }

        const user = response.data.data[0];

        // ==========================================
        // GET AVATAR
        // ==========================================

        const avatarResponse = await axios.get(
            "https://thumbnails.roblox.com/v1/users/avatar-headshot",
            {
                params: {
                    userIds: user.id,
                    size: "150x150",
                    format: "Png",
                    isCircular: false
                },
                timeout: 10000
            }
        );

        const avatar =
            avatarResponse.data.data &&
            avatarResponse.data.data.length > 0
                ? avatarResponse.data.data[0].imageUrl
                : null;

        // ==========================================
        // GENERATE VERIFICATION CODE
        // ==========================================

        const randomCode = crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase();

        const verificationCode =
            `ADOPTME-${randomCode}`;

        verificationCodes.set(
            String(user.id),
            {
                code: verificationCode,
                username: user.name,
                createdAt: Date.now()
            }
        );

        return res.json({
            success: true,

            user: {
                id: user.id,
                username: user.name,
                displayName: user.displayName,
                avatar
            },

            verificationCode
        });

    } catch (error) {
        console.error("Roblox lookup error:");

        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }

        return res.status(500).json({
            success: false,
            message: "Failed to contact Roblox."
        });
    }
});

// ==========================================
// VERIFY ROBLOX ACCOUNT
// ==========================================

router.post("/verify", async (req, res) => {
    try {
        const { robloxId } = req.body;

        if (!robloxId) {
            return res.status(400).json({
                success: false,
                message: "Missing Roblox account."
            });
        }

        // ==========================================
        // FIND VERIFICATION
        // ==========================================

        const verification =
            verificationCodes.get(
                String(robloxId)
            );

        if (!verification) {
            return res.status(400).json({
                success: false,
                message:
                    "Verification code expired. Please start again."
            });
        }

        // ==========================================
        // CHECK EXPIRATION
        // ==========================================

        if (
            Date.now() - verification.createdAt >
            VERIFICATION_EXPIRY
        ) {
            verificationCodes.delete(
                String(robloxId)
            );

            return res.status(400).json({
                success: false,
                message:
                    "Verification code expired. Please start again."
            });
        }

        // ==========================================
        // GET CURRENT ROBLOX PROFILE
        // ==========================================

        const response = await axios.get(
            `https://users.roblox.com/v1/users/${robloxId}`,
            {
                timeout: 10000
            }
        );

        const description =
            response.data.description || "";

        console.log(
            `Checking About Me for ${verification.username}`
        );

        // ==========================================
        // CHECK VERIFICATION CODE
        // ==========================================

        if (
            !description.includes(
                verification.code
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Verification code not found in your Roblox About Me."
            });
        }

        // ==========================================
        // VERIFIED
        // ==========================================

        verificationCodes.delete(
            String(robloxId)
        );

        const robloxUserId =
            Number(robloxId);

        const username =
            response.data.name;

        const displayName =
            response.data.displayName;

        // ==========================================
        // GET AVATAR
        // ==========================================

        let avatarUrl = null;

        try {
            const avatarResponse =
                await axios.get(
                    "https://thumbnails.roblox.com/v1/users/avatar-headshot",
                    {
                        params: {
                            userIds: robloxUserId,
                            size: "150x150",
                            format: "Png",
                            isCircular: false
                        },
                        timeout: 10000
                    }
                );

            if (
                avatarResponse.data.data &&
                avatarResponse.data.data.length > 0
            ) {
                avatarUrl =
                    avatarResponse.data.data[0].imageUrl;
            }

        } catch (avatarError) {
            console.error(
                "Avatar lookup failed:",
                avatarError.message
            );
        }

        // ==========================================
        // CREATE OR UPDATE USER
        // ==========================================

        let userResult =
            await pool.query(
                `
                SELECT
                    id,
                    roblox_id,
                    roblox_username,
                    roblox_display_name,
                    avatar_url
                FROM users
                WHERE roblox_id = $1
                `,
                [robloxUserId]
            );

        let user;

        // ==========================================
        // NEW USER
        // ==========================================

        if (userResult.rows.length === 0) {

            const userId =
                crypto.randomUUID();

            const insertResult =
                await pool.query(
                    `
                    INSERT INTO users (
                        id,
                        roblox_id,
                        roblox_username,
                        roblox_display_name,
                        avatar_url
                    )
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING
                        id,
                        roblox_id,
                        roblox_username,
                        roblox_display_name,
                        avatar_url
                    `,
                    [
                        userId,
                        robloxUserId,
                        username,
                        displayName,
                        avatarUrl
                    ]
                );

            user =
                insertResult.rows[0];

            console.log(
                `Created new user: ${username}`
            );

        } else {

            // ==========================================
            // EXISTING USER
            // ==========================================

            const updateResult =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        roblox_username = $1,
                        roblox_display_name = $2,
                        avatar_url = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE roblox_id = $4
                    RETURNING
                        id,
                        roblox_id,
                        roblox_username,
                        roblox_display_name,
                        avatar_url
                    `,
                    [
                        username,
                        displayName,
                        avatarUrl,
                        robloxUserId
                    ]
                );

            user =
                updateResult.rows[0];

            console.log(
                `Existing user logged in: ${username}`
            );
        }

        // ==========================================
        // CREATE LOGIN SESSION
        // ==========================================

        req.session.user = {
            id: user.id,

            robloxId: Number(
                user.roblox_id
            ),

            username:
                user.roblox_username,

            displayName:
                user.roblox_display_name,

            avatar:
                user.avatar_url
        };

        // ==========================================
        // ALSO STORE USER ID DIRECTLY
        // ==========================================

        req.session.userId =
            user.id;

        // ==========================================
        // EXPLICITLY SAVE SESSION
        // ==========================================

        req.session.save((sessionError) => {

            if (sessionError) {
                console.error(
                    "Session save error:",
                    sessionError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Login session could not be saved. Please try again."
                });
            }

            console.log(
                `Session created for ${username}`
            );

            console.log(
                `Session user ID: ${user.id}`
            );

            return res.json({
                success: true,

                message:
                    "Roblox account verified successfully!",

                user: req.session.user
            });
        });

    } catch (error) {

        console.error(
            "Roblox verification error:"
        );

        if (error.response) {
            console.error(
                error.response.data
            );
        } else {
            console.error(
                error.message
            );
        }

        return res.status(500).json({
            success: false,
            message:
                "Failed to verify your Roblox account. Please try again."
        });
    }
});

module.exports = router;
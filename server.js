const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Server } = require("socket.io");
require("dotenv").config();

const pool = require("./db");

const robloxAuth = require("./routes/robloxAuth");
const inventory = require("./routes/inventory");
const items = require("./routes/items");
const coinflipRoutes = require("./routes/coinflip");
const accountRoutes = require("./routes/account");
const { router: adminRoutes, isAdmin, isSuperOwner } = require("./routes/admin");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

const PORT =
    process.env.PORT || 3000;

app.set(
    "view engine",
    "ejs"
);

app.set(
    "views",
    path.join(__dirname, "views")
);

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

// Trust Railway's reverse proxy so secure cookies work correctly in production.
app.set("trust proxy", 1);

// Store sessions in PostgreSQL instead of Express's in-memory store.
// This keeps users logged in when the server restarts or redeploys.
const sessionMiddleware =
    session({
        store: new pgSession({
            pool,
            tableName: "user_sessions",
            createTableIfMissing: true
        }),

        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        rolling: true,

        cookie: {
            httpOnly: true,

            secure: process.env.NODE_ENV === "production",

            sameSite: "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30
        }
    });

app.use(sessionMiddleware);

io.engine.use(sessionMiddleware);

const CHAT_HISTORY_LIMIT = 100;

function isOwnerUsername(username) {
    return String(username || "").toLowerCase() === "skyez3rs";
}

async function initializeChat() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            username VARCHAR(100) NOT NULL,
            message VARCHAR(300) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

const chatReady = initializeChat()
    .then(() => console.log("Live chat storage is ready."))
    .catch((error) => {
        console.error("Live chat storage failed to initialize:", error.message);
        throw error;
    });

function broadcastOnlineCount() {
    io.emit("chat:online", io.of("/").sockets.size);
}

function sendChatNotice(socket, message) {
    socket.emit("chat:notice", message);
}

async function givePet(commandText) {
    const command = commandText.match(/^!give\s+(\S+)\s+(.+)$/i);

    if (!command) {
        throw new Error("Use: !give [USER] [PET]");
    }

    const [, targetUsername, petName] = command;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const target = await client.query(
            `
            SELECT id, roblox_username
            FROM users
            WHERE LOWER(roblox_username) = LOWER($1)
            LIMIT 1
            FOR UPDATE
            `,
            [targetUsername]
        );

        if (!target.rows.length) {
            throw new Error(`Player \"${targetUsername}\" was not found.`);
        }

        const pet = await client.query(
            `
            SELECT id, name
            FROM items
            WHERE LOWER(name) = LOWER($1)
            LIMIT 1
            `,
            [petName.trim()]
        );

        if (!pet.rows.length) {
            throw new Error(`Pet \"${petName.trim()}\" was not found.`);
        }

        const existingInventory = await client.query(
            `
            SELECT id
            FROM inventory
            WHERE user_id = $1
              AND item_id = $2
            ORDER BY id
            LIMIT 1
            FOR UPDATE
            `,
            [target.rows[0].id, pet.rows[0].id]
        );

        if (existingInventory.rows.length) {
            await client.query(
                `
                UPDATE inventory
                SET quantity = quantity + 1
                WHERE id = $1
                `,
                [existingInventory.rows[0].id]
            );
        } else {
            await client.query(
                `
                INSERT INTO inventory (
                    id, user_id, item_id, quantity, locked_quantity
                )
                VALUES ($1, $2, $3, 1, 0)
                `,
                [
                    crypto.randomUUID(),
                    target.rows[0].id,
                    pet.rows[0].id
                ]
            );
        }

        await client.query("COMMIT");

        return `${pet.rows[0].name} was added to ${target.rows[0].roblox_username}.`;

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;

    } finally {
        client.release();
    }
}

io.on("connection", async (socket) => {
    const user = socket.request.session?.user;

    if (!user?.id) {
        socket.disconnect(true);
        return;
    }

    try {
        await chatReady;

        const history = await pool.query(
            `
            SELECT id, username, message, created_at, avatar_url
            FROM (
                SELECT cm.id, cm.username, cm.message, cm.created_at, u.avatar_url
                FROM chat_messages cm
                JOIN users u ON u.id = cm.user_id
                ORDER BY created_at DESC
                LIMIT $1
            ) recent_messages
            ORDER BY created_at ASC
            `,
            [CHAT_HISTORY_LIMIT]
        );

        socket.emit(
            "chat:history",
            history.rows.map((message) => ({
                id: message.id,
                username: message.username,
                message: message.message,
                owner: isOwnerUsername(message.username),
                createdAt: message.created_at,
                avatarUrl: message.avatar_url || ""
            }))
        );

        broadcastOnlineCount();

    } catch (error) {
        console.error("Load chat history error:", error.message);
        socket.emit("chat:error", "Chat is temporarily unavailable.");
    }

    socket.on("chat:send", async (rawMessage) => {
        const message = String(rawMessage || "").trim();

        if (!message || message.length > 300) {
            socket.emit("chat:error", "Messages must be between 1 and 300 characters.");
            return;
        }

        const username =
            user.username ||
            user.roblox_username ||
            user.displayName ||
            "Player";

        if (message.toLowerCase().startsWith("!give")) {
            if (!isOwnerUsername(username)) {
                sendChatNotice(socket, "Only the owner can use !give.");
                return;
            }

            try {
                await chatReady;
                sendChatNotice(socket, await givePet(message));
            } catch (error) {
                sendChatNotice(socket, error.message || "Could not add that pet.");
            }

            return;
        }

        try {
            await chatReady;

            const savedMessage = await pool.query(
                `
                INSERT INTO chat_messages (
                    id, user_id, username, message
                )
                VALUES ($1, $2, $3, $4)
                RETURNING id, username, message, created_at
                `,
                [
                    crypto.randomUUID(),
                    user.id,
                    username,
                    message
                ]
            );

            const row = savedMessage.rows[0];
            const avatarUrl = user.avatar_url || user.avatar || user.avatarUrl || "";

            io.emit("chat:message", {
                id: row.id,
                username: row.username,
                message: row.message,
                owner: isOwnerUsername(row.username),
                createdAt: row.created_at,
                avatarUrl
            });

        } catch (error) {
            console.error("Save chat message error:", error.message);
            socket.emit("chat:error", "Your message could not be sent.");
        }
    });

    socket.on("disconnect", broadcastOnlineCount);
});

app.use(
    "/api/roblox",
    robloxAuth
);

app.use(
    "/api/inventory",
    inventory
);

app.use(
    "/api/items",
    items
);

app.use(
    "/api/coinflip",
    coinflipRoutes
);

app.use("/api/admin", adminRoutes);
app.use("/", accountRoutes);

app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ success: true });
    });
});

app.get("/", async (req, res) => {

    if (req.session.user) {

        return res.render("home", {
            user: req.session.user,
            canAdmin: await isAdmin(req)
        });
    }

    return res.render(
        "login"
    );
});


app.get("/items", (req, res) => {

    res.render(
        "items"
    );

});

app.get("/admin", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/");
    }

    if (!(await isAdmin(req))) {
        return res.status(403).send("Admin access is required.");
    }

    return res.render("admin", {
        user: req.session.user,
        isSuperOwner: isSuperOwner(req)
    });
});

async function testDatabase() {

    try {

        const result =
            await pool.query(
                "SELECT NOW()"
            );

        console.log(
            "Connected to PostgreSQL!"
        );

        console.log(
            "Database time:",
            result.rows[0].now
        );

    } catch (error) {

        console.error(
            "PostgreSQL connection failed:"
        );

        console.error(
            error.message
        );

    }

}

httpServer.listen(
    PORT,

    async () => {

        console.log(
            `CrazyAMP is Function - http://localhost:${PORT}`
        );

        await testDatabase();

    }
);

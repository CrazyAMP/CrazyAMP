const pool = require("../db");


async function setupDatabase() {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");


        /*
        ==========================================
        INVENTORY LOCKING
        ==========================================

        locked_quantity tells us how many copies of
        an inventory item are currently committed to
        a Coinflip match.

        Example:

        quantity = 5
        locked_quantity = 2

        The user owns 5, but only 3 are currently
        available for withdrawal / another match.
        */


        await client.query(`
            ALTER TABLE inventory
            ADD COLUMN IF NOT EXISTS locked_quantity
            INTEGER NOT NULL DEFAULT 0;
        `);


        await client.query(`
            ALTER TABLE inventory
            DROP CONSTRAINT IF EXISTS valid_locked_quantity;
        `);


        await client.query(`
            ALTER TABLE inventory
            ADD CONSTRAINT valid_locked_quantity
            CHECK (
                locked_quantity >= 0
                AND locked_quantity <= quantity
            );
        `);


        /*
        ==========================================
        COINFLIP MATCHES
        ==========================================
        */


        await client.query(`
            CREATE TABLE IF NOT EXISTS coinflip_matches (

                id UUID PRIMARY KEY,

                creator_id UUID NOT NULL
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                joiner_id UUID
                    REFERENCES users(id)
                    ON DELETE SET NULL,

                creator_value BIGINT NOT NULL DEFAULT 0,

                joiner_value BIGINT NOT NULL DEFAULT 0,

                total_value BIGINT NOT NULL DEFAULT 0,

                tax_value BIGINT NOT NULL DEFAULT 0,

                payout_value BIGINT NOT NULL DEFAULT 0,

                tax_rate NUMERIC(5,2)
                    NOT NULL DEFAULT 10.00,

                min_join_value BIGINT
                    NOT NULL DEFAULT 0,

                max_join_value BIGINT
                    NOT NULL DEFAULT 0,

                creator_choice VARCHAR(5),

                joiner_choice VARCHAR(5),

                status VARCHAR(30)
                    NOT NULL DEFAULT 'open',

                winner_id UUID
                    REFERENCES users(id)
                    ON DELETE SET NULL,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                joined_at TIMESTAMP,

                completed_at TIMESTAMP,

                cancelled_at TIMESTAMP,


                CONSTRAINT valid_coinflip_status

                CHECK (
                    status IN (
                        'open',
                        'locked',
                        'flipping',
                        'completed',
                        'cancelled'
                    )
                ),


                CONSTRAINT valid_creator_choice

                CHECK (
                    creator_choice IS NULL
                    OR creator_choice IN (
                        'heads',
                        'tails'
                    )
                ),


                CONSTRAINT valid_joiner_choice

                CHECK (
                    joiner_choice IS NULL
                    OR joiner_choice IN (
                        'heads',
                        'tails'
                    )
                ),


                CONSTRAINT positive_creator_value

                CHECK (
                    creator_value >= 0
                ),


                CONSTRAINT positive_joiner_value

                CHECK (
                    joiner_value >= 0
                ),


                CONSTRAINT positive_total_value

                CHECK (
                    total_value >= 0
                ),


                CONSTRAINT positive_tax_value

                CHECK (
                    tax_value >= 0
                ),


                CONSTRAINT positive_payout_value

                CHECK (
                    payout_value >= 0
                ),


                CONSTRAINT valid_tax_rate

                CHECK (
                    tax_rate >= 0
                    AND tax_rate <= 100
                ),


                CONSTRAINT valid_join_range

                CHECK (
                    min_join_value >= 0
                    AND max_join_value >= min_join_value
                )

            );
        `);


        /*
        ==========================================
        ADD MISSING COLUMNS TO EXISTING TABLE
        ==========================================

        This makes the setup safe if the table was
        already created before these fields existed.
        */


        await client.query(`
            ALTER TABLE coinflip_matches
            ADD COLUMN IF NOT EXISTS creator_choice
            VARCHAR(5);
        `);


        await client.query(`
            ALTER TABLE coinflip_matches
            ADD COLUMN IF NOT EXISTS joiner_choice
            VARCHAR(5);
        `);


        await client.query(`
            ALTER TABLE coinflip_matches
            ADD COLUMN IF NOT EXISTS updated_at
            TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);


        /*
        ==========================================
        MAKE SURE CHOICE CONSTRAINTS EXIST
        ==========================================
        */


        await client.query(`
            ALTER TABLE coinflip_matches
            DROP CONSTRAINT IF EXISTS valid_creator_choice;
        `);


        await client.query(`
            ALTER TABLE coinflip_matches
            ADD CONSTRAINT valid_creator_choice
            CHECK (
                creator_choice IS NULL
                OR creator_choice IN (
                    'heads',
                    'tails'
                )
            );
        `);


        await client.query(`
            ALTER TABLE coinflip_matches
            DROP CONSTRAINT IF EXISTS valid_joiner_choice;
        `);


        await client.query(`
            ALTER TABLE coinflip_matches
            ADD CONSTRAINT valid_joiner_choice
            CHECK (
                joiner_choice IS NULL
                OR joiner_choice IN (
                    'heads',
                    'tails'
                )
            );
        `);


        /*
        ==========================================
        COINFLIP MATCH ITEMS
        ==========================================

        Each selected inventory item is recorded
        here.

        "side" is either:

        creator
        joiner

        We store the value at the time the item was
        placed into the match so later value changes
        don't alter an existing wager.
        */


        await client.query(`
            CREATE TABLE IF NOT EXISTS coinflip_match_items (

                id UUID PRIMARY KEY,

                match_id UUID NOT NULL
                    REFERENCES coinflip_matches(id)
                    ON DELETE CASCADE,

                user_id UUID NOT NULL
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                inventory_id UUID NOT NULL
                    REFERENCES inventory(id)
                    ON DELETE CASCADE,

                item_id UUID NOT NULL
                    REFERENCES items(id)
                    ON DELETE RESTRICT,

                side VARCHAR(20) NOT NULL,

                quantity INTEGER NOT NULL DEFAULT 1,

                value_per_item BIGINT
                    NOT NULL DEFAULT 0,

                total_value BIGINT
                    NOT NULL DEFAULT 0,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,


                CONSTRAINT valid_coinflip_item_side

                CHECK (
                    side IN (
                        'creator',
                        'joiner'
                    )
                ),


                CONSTRAINT positive_coinflip_quantity

                CHECK (
                    quantity > 0
                ),


                CONSTRAINT positive_item_value

                CHECK (
                    value_per_item >= 0
                ),


                CONSTRAINT positive_item_total

                CHECK (
                    total_value >= 0
                ),


                CONSTRAINT unique_match_inventory

                UNIQUE (
                    match_id,
                    inventory_id,
                    side
                )

            );
        `);


        /*
        ==========================================
        INDEXES
        ==========================================
        */


        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_coinflip_matches_status

            ON coinflip_matches(status);
        `);


        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_coinflip_matches_creator

            ON coinflip_matches(creator_id);
        `);


        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_coinflip_matches_joiner

            ON coinflip_matches(joiner_id);
        `);


        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_coinflip_matches_created

            ON coinflip_matches(created_at DESC);
        `);


        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_coinflip_match_items_match

            ON coinflip_match_items(match_id);
        `);


        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_coinflip_match_items_user

            ON coinflip_match_items(user_id);
        `);


        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_coinflip_match_items_inventory

            ON coinflip_match_items(inventory_id);
        `);


        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_inventory_locked

            ON inventory(
                user_id,
                locked_quantity
            );
        `);


        /*
        ==========================================
        FINISH
        ==========================================
        */


        await client.query("COMMIT");


        console.log(
            "Coinflip database setup complete!"
        );

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Coinflip database setup failed:",
            error
        );

        throw error;

    } finally {

        client.release();

    }
}


/*
==========================================
RUN SETUP
==========================================
*/


setupDatabase()

    .then(() => {

        console.log(
            "Database setup finished successfully."
        );

        process.exit(0);

    })

    .catch((error) => {

        console.error(error);

        process.exit(1);

    });
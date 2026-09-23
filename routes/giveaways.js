const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const router = express.Router();

function userId(req) { return req.session?.user?.id || req.session?.userId; }
function requireUser(req, res, next) { if (!userId(req)) return res.status(401).json({ success:false, message:'You must be logged in.' }); next(); }

async function expireGiveaways(client = pool) {
  const expired = await client.query(`SELECT id, user_id, inventory_id FROM giveaways WHERE status='active' AND ends_at <= CURRENT_TIMESTAMP FOR UPDATE`);
  for (const giveaway of expired.rows) {
    const winner = await client.query(`SELECT user_id FROM giveaway_entries WHERE giveaway_id=$1 ORDER BY RANDOM() LIMIT 1`, [giveaway.id]);
    if (!winner.rows.length) {
      await client.query(`UPDATE inventory SET locked_quantity=GREATEST(locked_quantity-1,0) WHERE id=$1 AND user_id=$2`, [giveaway.inventory_id, giveaway.user_id]);
      await client.query(`UPDATE giveaways SET status='expired', updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [giveaway.id]);
      continue;
    }
    const winnerId = winner.rows[0].user_id;
    const pet = await client.query(`SELECT item_id FROM inventory WHERE id=$1 AND user_id=$2 FOR UPDATE`, [giveaway.inventory_id, giveaway.user_id]);
    if (!pet.rows.length) {
      await client.query(`UPDATE giveaways SET status='expired', updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [giveaway.id]);
      continue;
    }
    await client.query(`UPDATE inventory SET quantity=quantity-1, locked_quantity=GREATEST(locked_quantity-1,0) WHERE id=$1 AND user_id=$2`, [giveaway.inventory_id, giveaway.user_id]);
    const existing = await client.query(`SELECT id FROM inventory WHERE user_id=$1 AND item_id=$2 FOR UPDATE`, [winnerId, pet.rows[0].item_id]);
    if (existing.rows.length) await client.query(`UPDATE inventory SET quantity=quantity+1 WHERE id=$1`, [existing.rows[0].id]);
    else await client.query(`INSERT INTO inventory (id,user_id,item_id,quantity,locked_quantity) VALUES ($1,$2,$3,1,0)`, [crypto.randomUUID(),winnerId,pet.rows[0].item_id]);
    await client.query(`UPDATE giveaways SET status='completed', winner_id=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [giveaway.id,winnerId]);
  }
}

router.get('/', requireUser, async (req,res) => {
  try {
    await expireGiveaways();
    const result = await pool.query(`
      SELECT g.id, g.user_id, g.item_name, g.item_value, g.item_image, g.form, g.fly, g.ride,
             g.ends_at, g.created_at, g.status, u.roblox_username,
             COUNT(ge.id)::int AS entrant_count
      FROM giveaways g JOIN users u ON u.id=g.user_id
      LEFT JOIN giveaway_entries ge ON ge.giveaway_id=g.id
      WHERE g.status='active'
      GROUP BY g.id, u.roblox_username
      ORDER BY g.created_at DESC
      LIMIT 10
    `);
    res.json({success:true, giveaways:result.rows});
  } catch (e) { console.error('Giveaways list error:',e); res.status(500).json({success:false,message:'Could not load giveaways.'}); }
});

router.post('/', requireUser, async (req,res) => {
  const ownerId = userId(req);
  const inventoryId = String(req.body.inventoryId || '');
  const durationMinutes = Number(req.body.durationMinutes);
  if (!inventoryId || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 10080) return res.status(400).json({success:false,message:'Choose a pet and a duration between 1 minute and 7 days.'});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await expireGiveaways(client);
    const row = await client.query(`
      SELECT inv.id, inv.quantity, COALESCE(inv.locked_quantity,0) locked_quantity,
             i.name, i.value, i.image, i.form, i.fly, i.ride
      FROM inventory inv JOIN items i ON i.id=inv.item_id
      WHERE inv.id=$1 AND inv.user_id=$2 AND COALESCE(i.is_deleted,FALSE)=FALSE
      FOR UPDATE
    `,[inventoryId,ownerId]);
    if (!row.rows.length) throw new Error('That pet is not available.');
    const pet=row.rows[0];
    if (Number(pet.quantity)-Number(pet.locked_quantity) < 1) throw new Error('That pet is already locked.');
    const id=crypto.randomUUID();
    const endsAt=new Date(Date.now()+durationMinutes*60000);
    await client.query('UPDATE inventory SET locked_quantity=locked_quantity+1 WHERE id=$1',[inventoryId]);
    await client.query(`INSERT INTO giveaways (id,user_id,inventory_id,item_name,item_value,item_image,form,fly,ride,ends_at,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')`,[id,ownerId,inventoryId,pet.name,pet.value,pet.image,pet.form,pet.fly,pet.ride,endsAt]);
    await client.query('COMMIT');
    res.json({success:true,giveaway:{id,endsAt}});
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({success:false,message:e.message||'Could not create giveaway.'}); }
  finally { client.release(); }
});

router.post('/:id/join', requireUser, async (req,res) => {
  const entrantId=userId(req); const giveawayId=String(req.params.id);
  try {
    await expireGiveaways();
    const g=await pool.query(`SELECT id,user_id,status,ends_at FROM giveaways WHERE id=$1`,[giveawayId]);
    if (!g.rows.length || g.rows[0].user_id === entrantId || g.rows[0].status!=='active' || new Date(g.rows[0].ends_at)<=new Date()) return res.status(400).json({success:false,message:'This giveaway has ended.'});
    const eligibility=await pool.query(`
      SELECT 1 FROM coinflip_matches
      WHERE status='completed' AND completed_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        AND (creator_id=$1 OR joiner_id=$1) LIMIT 1
    `,[entrantId]);
    if (!eligibility.rows.length) return res.status(403).json({success:false,message:'You must have played a completed game in the last 24 hours.'});
    await pool.query(`INSERT INTO giveaway_entries (id,giveaway_id,user_id) VALUES ($1,$2,$3) ON CONFLICT (giveaway_id,user_id) DO NOTHING`,[crypto.randomUUID(),giveawayId,entrantId]);
    res.json({success:true,message:'You joined the giveaway.'});
  } catch(e) { console.error('Giveaway join error:',e); res.status(500).json({success:false,message:'Could not join giveaway.'}); }
});

module.exports=router;

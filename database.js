export async function createUser(client, userId, name) {
    try {
        await client.query(
            'INSERT INTO bakerybattle.player (player_id, name) VALUES ($1, $2)', 
            [userId, name]
        );
    } catch (err) {
        console.error('Error creating user:', err);
        throw new Error(err);
    } 
}
export async function savePlayer(client, userId, health, inventory, round) {
    try {
        await client.query(
            'INSERT INTO bakerybattle.playerround (player_id, health, inventory, round) VALUES ($1, $2, $3, $4)',
            [userId, health, inventory, round]
        );
    } catch (err) {
        console.error('Error saving player:', err);
        throw new Error(err);
    }
}
export async function getRandomPlayer(client, userId, round) {
    try {
        const result = await client.query(
            `SELECT p.name, pr.health, pr.inventory, pr.round
            FROM bakerybattle.playerround pr
            JOIN bakerybattle.player p ON pr.player_id = p.player_id
            WHERE pr.player_id != $1 AND pr.round = $2 
            ORDER BY RANDOM() 
            LIMIT 1`,
            [userId, round]
        );
        return result.rows[0];
    } catch (err) {
        console.error('Error fetching random player:', err);
        throw new Error(err);
    }
}

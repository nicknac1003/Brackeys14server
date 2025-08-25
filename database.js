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


const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    require('./commands/withdraw').data.toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄️ Started refreshing (/) commands')

        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands },
        ); 

        console.log('Successfully reloaded application (/) commands.')
    } catch (error) {
        console.error(error);
    }
})();
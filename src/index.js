require("dotenv").config();

const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");

const pingCommand = require("./commands/ping.js");
const apostaCommand = require("./commands/aposta.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// memória simples (temporária)
const apostas = {};

client.once("clientReady", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const clientId = client.user.id;
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

    try {
        console.log("Registering slash commands...");

        await rest.put(
            Routes.applicationCommands(clientId),
            {
                body: [
                    pingCommand.data.toJSON(),
                    apostaCommand.data.toJSON()
                ]
            }
        );

        console.log("Slash commands registered.");
    } catch (error) {
        console.error(error);
    }
});

client.on("interactionCreate", async (interaction) => {

    // comandos
    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === pingCommand.data.name) {
            return pingCommand.execute(interaction);
        }

        if (interaction.commandName === apostaCommand.data.name) {
            return apostaCommand.execute(interaction);
        }
    }

    // botões
    if (interaction.isButton()) {

        const userId = interaction.user.id;
        const escolha = interaction.customId;

        // impedir votar duas vezes
        if (apostas[userId]) {
            return interaction.reply({
                content: "❌ Você já fez sua aposta!",
                ephemeral: true
            });
        }

        // salvar aposta
        apostas[userId] = escolha;

        return interaction.reply({
            content: `✅ Você apostou em: **${interaction.component.label}**`,
            ephemeral: true
        });
    }

});

if (!process.env.TOKEN) {
    console.error("Erro: TOKEN não definido.");
    process.exit(1);
}

client.login(process.env.TOKEN);

require("dotenv").config();

const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");

const pingCommand = require("./commands/ping.js");
const saldoCommand = require("./commands/saldo.js");
const criarApostaCommand = require("./commands/criar-aposta.js");
const apostarCommand = require("./commands/apostar.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// saldos dos usuários
const saldos = {};

// jogos criados com odds
const jogos = {};

// apostas com valor
const apostasValores = {};

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
                    saldoCommand.data.toJSON(),
                    criarApostaCommand.data.toJSON(),
                    apostarCommand.data.toJSON()
                ]
            }
        );

        console.log("Slash commands registered.");
    } catch (error) {
        console.error(error);
    }
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === pingCommand.data.name) {
        return pingCommand.execute(interaction);
    }

    if (interaction.commandName === saldoCommand.data.name) {
        return saldoCommand.execute(interaction, saldos);
    }

    if (interaction.commandName === criarApostaCommand.data.name) {
        return criarApostaCommand.execute(interaction, jogos);
    }

    if (interaction.commandName === apostarCommand.data.name) {
        return apostarCommand.execute(interaction, saldos, jogos, apostasValores);
    }
});

if (!process.env.TOKEN) {
    console.error("Erro: TOKEN não definido.");
    process.exit(1);
}

client.login(process.env.TOKEN);

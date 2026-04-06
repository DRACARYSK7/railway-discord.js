require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

const pingCommand = require("./commands/ping.js");
const saldoCommand = require("./commands/saldo.js");
const criarApostaCommand = require("./commands/criar-aposta.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// saldo dos usuários
const saldos = {};

// jogos criados
const jogos = {};

// apostas salvas
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
                    criarApostaCommand.data.toJSON()
                ]
            }
        );

        console.log("Slash commands registered.");
    } catch (error) {
        console.error(error);
    }
});

client.on("interactionCreate", async (interaction) => {

    // COMANDOS
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === pingCommand.data.name) {
            return pingCommand.execute(interaction);
        }

        if (interaction.commandName === saldoCommand.data.name) {
            return saldoCommand.execute(interaction, saldos);
        }

        if (interaction.commandName === criarApostaCommand.data.name) {
            return criarApostaCommand.execute(interaction, jogos);
        }
    }

    // CLIQUE NOS BOTÕES
    if (interaction.isButton()) {
        const [tipo, jogo, escolha] = interaction.customId.split("|");

        if (tipo !== "bet") return;
        if (!jogos[jogo]) {
            return interaction.reply({
                content: "❌ Esse jogo não existe mais.",
                ephemeral: true
            });
        }

        if (!jogos[jogo].aberto) {
            return interaction.reply({
                content: "❌ As apostas para esse jogo estão fechadas.",
                ephemeral: true
            });
        }

        const userId = interaction.user.id;

        if (!saldos[userId]) {
            saldos[userId] = 100;
        }

        if (!apostasValores[jogo]) {
            apostasValores[jogo] = {};
        }

        if (apostasValores[jogo][userId]) {
            return interaction.reply({
                content: "❌ Você já fez uma aposta nesse jogo!",
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`betmodal|${jogo}|${escolha}`)
            .setTitle("Valor da aposta");

        const valorInput = new TextInputBuilder()
            .setCustomId("valor")
            .setLabel("Digite o valor da sua aposta")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ex: 10")
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(valorInput);
        modal.addComponents(row);

        return interaction.showModal(modal);
    }

    // ENVIO DO POPUP
    if (interaction.isModalSubmit()) {
        const [tipo, jogo, escolha] = interaction.customId.split("|");

        if (tipo !== "betmodal") return;
        if (!jogos[jogo]) {
            return interaction.reply({
                content: "❌ Esse jogo não existe mais.",
                ephemeral: true
            });
        }

        if (!jogos[jogo].aberto) {
            return interaction.reply({
                content: "❌ As apostas para esse jogo estão fechadas.",
                ephemeral: true
            });
        }

        const userId = interaction.user.id;

        if (!saldos[userId]) {
            saldos[userId] = 100;
        }

        if (!apostasValores[jogo]) {
            apostasValores[jogo] = {};
        }

        if (apostasValores[jogo][userId]) {
            return interaction.reply({
                content: "❌ Você já fez uma aposta nesse jogo!",
                ephemeral: true
            });
        }

        const valorTexto = interaction.fields.getTextInputValue("valor");
        const valor = parseInt(valorTexto, 10);

        if (isNaN(valor) || valor <= 0) {
            return interaction.reply({
                content: "❌ Digite um valor válido maior que 0.",
                ephemeral: true
            });
        }

        if (saldos[userId] < valor) {
            return interaction.reply({
                content: `❌ Você não tem saldo suficiente. Seu saldo atual é **${saldos[userId]} moedas**.`,
                ephemeral: true
            });
        }

        let odd = 1;
        let nomeEscolha = "";

        if (escolha === "time1") {
            odd = jogos[jogo].odd1;
            nomeEscolha = jogos[jogo].time1;
        }

        if (escolha === "empate") {
            odd = jogos[jogo].oddEmpate;
            nomeEscolha = "Empate";
        }

        if (escolha === "time2") {
            odd = jogos[jogo].odd2;
            nomeEscolha = jogos[jogo].time2;
        }

        const retornoPossivel = valor * odd;

        saldos[userId] -= valor;

        apostasValores[jogo][userId] = {
            escolha,
            valor,
            odd
        };

        return interaction.reply({
            content:
`✅ **Aposta registrada!**

🎮 Jogo: **${jogo}**
🎯 Escolha: **${nomeEscolha}**
💰 Valor apostado: **${valor} moedas**
📈 Odd travada: **${odd.toFixed(2)}**
💸 Retorno possível: **${retornoPossivel.toFixed(2)} moedas**
💳 Saldo restante: **${saldos[userId]} moedas**`,
            ephemeral: true
        });
    }
});

if (!process.env.TOKEN) {
    console.error("Erro: TOKEN não definido.");
    process.exit(1);
}

client.login(process.env.TOKEN);

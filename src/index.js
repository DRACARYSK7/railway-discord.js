require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const { loadDatabase, saveDatabase, DB_PATH } = require("./storage");

const pingCommand = require("./commands/ping.js");
const saldoCommand = require("./commands/saldo.js");
const apostaCommand = require("./commands/aposta.js");
const apostarCommand = require("./commands/apostar.js");
const criarApostaCommand = require("./commands/criar-aposta.js");
const finalizarJogoCommand = require("./commands/finalizar-jogo.js");
const rankingCommand = require("./commands/ranking.js");
const rankingRodadaCommand = require("./commands/ranking-rodada.js");
const resetarRodadaCommand = require("./commands/resetar-rodada.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const database = loadDatabase();

const saldos = database.saldos || {};
const jogos = database.jogos || {};
const carrinhos = database.carrinhos || {};
const multiplas = database.multiplas || {};
const rodadaStats = database.rodadaStats || {};
const apostasValores = database.apostasValores || {};

function saveAll() {
    saveDatabase({
        saldos,
        jogos,
        carrinhos,
        multiplas,
        rodadaStats,
        apostasValores
    });
}

function criarBotoesPainel() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("painel_saldo")
            .setLabel("Ver saldo")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("painel_bilhete")
            .setLabel("Ver bilhete")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("painel_fechar")
            .setLabel("Fechar múltipla")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("painel_limpar")
            .setLabel("Limpar bilhete")
            .setStyle(ButtonStyle.Danger)
    );
}

client.once("clientReady", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Database carregado de: ${DB_PATH}`);

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
                    apostaCommand.data.toJSON(),
                    apostarCommand.data.toJSON(),
                    criarApostaCommand.data.toJSON(),
                    finalizarJogoCommand.data.toJSON(),
                    rankingCommand.data.toJSON(),
                    rankingRodadaCommand.data.toJSON(),
                    resetarRodadaCommand.data.toJSON()
                ]
            }
        );

        console.log("Slash commands registered.");
    } catch (error) {
        console.error(error);
    }
});

client.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === pingCommand.data.name) {
            return pingCommand.execute(interaction);
        }

        if (interaction.commandName === saldoCommand.data.name) {
            return saldoCommand.execute(interaction, saldos, saveAll);
        }

        if (interaction.commandName === apostaCommand.data.name) {
            return apostaCommand.execute(interaction);
        }

        if (interaction.commandName === apostarCommand.data.name) {
            return apostarCommand.execute(interaction, saldos, jogos, apostasValores, saveAll);
        }

        if (interaction.commandName === criarApostaCommand.data.name) {
            return criarApostaCommand.execute(interaction, jogos, saveAll);
        }

        if (interaction.commandName === finalizarJogoCommand.data.name) {
            return finalizarJogoCommand.execute(
                interaction,
                jogos,
                multiplas,
                saldos,
                rodadaStats,
                saveAll
            );
        }

        if (interaction.commandName === rankingCommand.data.name) {
            return rankingCommand.execute(interaction, saldos);
        }

        if (interaction.commandName === rankingRodadaCommand.data.name) {
            return rankingRodadaCommand.execute(interaction, rodadaStats);
        }

        if (interaction.commandName === resetarRodadaCommand.data.name) {
            return resetarRodadaCommand.execute(interaction, rodadaStats, saveAll);
        }
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith("bet|")) {
            const [tipo, jogo, escolha] = customId.split("|");

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

            if (saldos[userId] == null) {
                saldos[userId] = 100;
            }

            if (!Array.isArray(carrinhos[userId])) {
                carrinhos[userId] = [];
            }

            const jaExisteNoBilhete = carrinhos[userId].some(item => item.jogo === jogo);

            if (jaExisteNoBilhete) {
                return interaction.reply({
                    content: "❌ Você já adicionou uma opção desse jogo no seu bilhete.",
                    ephemeral: true
                });
            }

            let odd = 1;
            let nomeEscolha = "";

            if (escolha === "time1") {
                odd = Number(jogos[jogo].odd1);
                nomeEscolha = jogos[jogo].time1;
            }

            if (escolha === "empate") {
                odd = Number(jogos[jogo].oddEmpate);
                nomeEscolha = "Empate";
            }

            if (escolha === "time2") {
                odd = Number(jogos[jogo].odd2);
                nomeEscolha = jogos[jogo].time2;
            }

            carrinhos[userId].push({
                jogo,
                escolha,
                odd,
                nomeEscolha
            });

            saveAll();

            const oddParcial = carrinhos[userId].reduce((acc, item) => acc * Number(item.odd), 1);

            const lista = carrinhos[userId]
                .map(item => `🎯 **${item.jogo}** → **${item.nomeEscolha}** (${Number(item.odd).toFixed(2)})`)
                .join("\n");

            return interaction.reply({
                content:
`✅ **Seleção adicionada ao bilhete!**

${lista}

📈 Odd parcial: **${oddParcial.toFixed(2)}**`,
                components: [criarBotoesPainel()],
                ephemeral: true
            });
        }

        if (customId === "painel_saldo") {
            const userId = interaction.user.id;

            if (saldos[userId] == null) {
                saldos[userId] = 100;
                saveAll();
            }

            return interaction.reply({
                content: `💰 Você tem **${Number(saldos[userId]).toFixed(2)} moedas**.`,
                ephemeral: true
            });
        }

        if (customId === "painel_bilhete") {
            const userId = interaction.user.id;

            if (!Array.isArray(carrinhos[userId]) || carrinhos[userId].length === 0) {
                return interaction.reply({
                    content: "❌ Seu bilhete está vazio.",
                    ephemeral: true
                });
            }

            const lista = carrinhos[userId]
                .map(item => `🎯 **${item.jogo}** → **${item.nomeEscolha}** (${Number(item.odd).toFixed(2)})`)
                .join("\n");

            const oddParcial = carrinhos[userId].reduce((acc, item) => acc * Number(item.odd), 1);

            return interaction.reply({
                content:
`🧾 **Seu bilhete atual**

${lista}

📈 Odd parcial: **${oddParcial.toFixed(2)}**`,
                ephemeral: true
            });
        }

        if (customId === "painel_limpar") {
            const userId = interaction.user.id;
            carrinhos[userId] = [];
            saveAll();

            return interaction.reply({
                content: "🗑️ Seu bilhete foi limpo.",
                ephemeral: true
            });
        }

        if (customId === "painel_fechar") {
            const userId = interaction.user.id;

            if (!Array.isArray(carrinhos[userId]) || carrinhos[userId].length === 0) {
                return interaction.reply({
                    content: "❌ Seu bilhete está vazio.",
                    ephemeral: true
                });
            }

            const modal = new ModalBuilder()
                .setCustomId("modal_fechar_multipla")
                .setTitle("Fechar múltipla");

            const valorInput = new TextInputBuilder()
                .setCustomId("valor")
                .setLabel("Digite o valor da aposta")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Ex: 10")
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(valorInput);
            modal.addComponents(row);

            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === "modal_fechar_multipla") {
            const userId = interaction.user.id;

            if (saldos[userId] == null) {
                saldos[userId] = 100;
            }

            if (!Array.isArray(carrinhos[userId]) || carrinhos[userId].length === 0) {
                return interaction.reply({
                    content: "❌ Seu bilhete está vazio.",
                    ephemeral: true
                });
            }

            const valorTexto = interaction.fields.getTextInputValue("valor");
            const valor = parseFloat(valorTexto.replace(",", "."));

            if (Number.isNaN(valor) || valor <= 0) {
                return interaction.reply({
                    content: "❌ Digite um valor válido maior que 0.",
                    ephemeral: true
                });
            }

            if (Number(saldos[userId]) < valor) {
                return interaction.reply({
                    content: `❌ Você não tem saldo suficiente. Seu saldo atual é **${Number(saldos[userId]).toFixed(2)} moedas**.`,
                    ephemeral: true
                });
            }

            let oddTotal = 1;

            for (const selecao of carrinhos[userId]) {
                oddTotal *= Number(selecao.odd);
            }

            const retornoPossivel = valor * oddTotal;

            saldos[userId] = Number(saldos[userId]) - valor;

            multiplas[userId] = {
                valor: Number(valor),
                oddTotal: Number(oddTotal),
                retornoPossivel: Number(retornoPossivel),
                selecoes: carrinhos[userId].map(item => ({
                    jogo: item.jogo,
                    escolha: item.escolha,
                    odd: Number(item.odd),
                    nomeEscolha: item.nomeEscolha
                })),
                resolvida: false
            };

            const lista = carrinhos[userId]
                .map(item => `🎯 **${item.jogo}** → **${item.nomeEscolha}** (${Number(item.odd).toFixed(2)})`)
                .join("\n");

            carrinhos[userId] = [];

            saveAll();

            return interaction.reply({
                content:
`✅ **Múltipla registrada!**

${lista}

💰 Valor apostado: **${valor.toFixed(2)} moedas**
📈 Odd total: **${oddTotal.toFixed(2)}**
💸 Retorno possível: **${retornoPossivel.toFixed(2)} moedas**
💳 Saldo restante: **${Number(saldos[userId]).toFixed(2)} moedas**`,
                ephemeral: true
            });
        }
    }
});

if (!process.env.TOKEN) {
    console.error("Erro: TOKEN não definido.");
    process.exit(1);
}

client.login(process.env.TOKEN);

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

const pingCommand = require("./commands/ping.js");
const saldoCommand = require("./commands/saldo.js");
const criarApostaCommand = require("./commands/criar-aposta.js");
const finalizarJogoCommand = require("./commands/finalizar-jogo.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// saldo dos usuários
const saldos = {};

// jogos criados
const jogos = {};

// carrinho temporário da múltipla
const carrinhos = {};

// múltiplas fechadas
const multiplas = {};

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
                    finalizarJogoCommand.data.toJSON()
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

        if (interaction.commandName === saldoCommand.data.name) {
            return saldoCommand.execute(interaction, saldos);
        }

        if (interaction.commandName === criarApostaCommand.data.name) {
            return criarApostaCommand.execute(interaction, jogos);
        }

        if (interaction.commandName === finalizarJogoCommand.data.name) {
            return finalizarJogoCommand.execute(interaction, jogos, multiplas, saldos);
        }
    }

    // botões
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

            if (!saldos[userId]) {
                saldos[userId] = 100;
            }

            if (!carrinhos[userId]) {
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

            carrinhos[userId].push({
                jogo,
                escolha,
                odd,
                nomeEscolha
            });

            const oddParcial = carrinhos[userId].reduce((acc, item) => acc * item.odd, 1);

            const lista = carrinhos[userId]
                .map(item => `🎯 **${item.jogo}** → **${item.nomeEscolha}** (${item.odd.toFixed(2)})`)
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

            if (!saldos[userId]) {
                saldos[userId] = 100;
            }

            return interaction.reply({
                content: `💰 Você tem **${saldos[userId]} moedas**.`,
                ephemeral: true
            });
        }

        if (customId === "painel_bilhete") {
            const userId = interaction.user.id;

            if (!carrinhos[userId] || carrinhos[userId].length === 0) {
                return interaction.reply({
                    content: "❌ Seu bilhete está vazio.",
                    ephemeral: true
                });
            }

            const lista = carrinhos[userId]
                .map(item => `🎯 **${item.jogo}** → **${item.nomeEscolha}** (${item.odd.toFixed(2)})`)
                .join("\n");

            const oddParcial = carrinhos[userId].reduce((acc, item) => acc * item.odd, 1);

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

            return interaction.reply({
                content: "🗑️ Seu bilhete foi limpo.",
                ephemeral: true
            });
        }

        if (customId === "painel_fechar") {
            const userId = interaction.user.id;

            if (!carrinhos[userId] || carrinhos[userId].length === 0) {
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

    // modal de fechar múltipla
    if (interaction.isModalSubmit()) {
        if (interaction.customId === "modal_fechar_multipla") {
            const userId = interaction.user.id;

            if (!saldos[userId]) {
                saldos[userId] = 100;
            }

            if (!carrinhos[userId] || carrinhos[userId].length === 0) {
                return interaction.reply({
                    content: "❌ Seu bilhete está vazio.",
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

            let oddTotal = 1;

            for (const selecao of carrinhos[userId]) {
                oddTotal *= selecao.odd;
            }

            const retornoPossivel = valor * oddTotal;

            saldos[userId] -= valor;

            multiplas[userId] = {
                valor,
                oddTotal,
                retornoPossivel,
                selecoes: [...carrinhos[userId]],
                resolvida: false
            };

            const lista = carrinhos[userId]
                .map(item => `🎯 **${item.jogo}** → **${item.nomeEscolha}** (${item.odd.toFixed(2)})`)
                .join("\n");

            carrinhos[userId] = [];

            return interaction.reply({
                content:
`✅ **Múltipla registrada!**

${lista}

💰 Valor apostado: **${valor} moedas**
📈 Odd total: **${oddTotal.toFixed(2)}**
💸 Retorno possível: **${retornoPossivel.toFixed(2)} moedas**
💳 Saldo restante: **${saldos[userId]} moedas**`,
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

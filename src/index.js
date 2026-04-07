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
    TextInputStyle,
    PermissionFlagsBits
} = require("discord.js");

const { loadDatabase, saveDatabase, DB_PATH } = require("./storage");

const pingCommand = require("./commands/ping.js");
const saldoCommand = require("./commands/saldo.js");
const apostaCommand = require("./commands/aposta.js");
const apostarCommand = require("./commands/apostar.js");
const criarApostaCommand = require("./commands/criar-aposta.js");
const fecharMercadoCommand = require("./commands/fechar-mercado.js");
const resultadoJogoCommand = require("./commands/resultado-jogo.js");
const rankingCommand = require("./commands/ranking.js");
const rankingRodadaCommand = require("./commands/ranking-rodada.js");
const resetarRodadaCommand = require("./commands/resetar-rodada.js");
const verApostasCommand = require("./commands/ver-apostas.js");
const painelStaffCommand = require("./commands/painel-staff.js");

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
const historicoApostas = database.historicoApostas || {};

const paineisBilhete = {};
const painelStaffAtivo = {};

function saveAll() {
    saveDatabase({
        saldos,
        jogos,
        carrinhos,
        multiplas,
        rodadaStats,
        apostasValores,
        historicoApostas
    });
}

function temPermissaoStaff(interaction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

function extrairUserId(input) {
    if (!input) return null;

    const mentionMatch = input.match(/^<@!?(\d+)>$/);
    if (mentionMatch) return mentionMatch[1];

    const idMatch = input.match(/^(\d{16,25})$/);
    if (idMatch) return idMatch[1];

    return null;
}

function criarBotoesPainelStaff() {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_atualizar").setLabel("Atualizar").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("staff_ver_apostas").setLabel("Ver apostas").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("staff_ver_ranking").setLabel("Ranking").setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_adicionar_moedas").setLabel("Adicionar").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staff_remover_moedas").setLabel("Remover").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("staff_ver_saldo_membro").setLabel("Saldo membro").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("staff_resetar_rodada").setLabel("Resetar rodada").setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_excluir_jogo").setLabel("Excluir jogo").setStyle(ButtonStyle.Danger)
    );

    return [row1, row2, row3];
}

function montarConteudoPainelStaff(extra = "") {
    return [
        "📊 **PAINEL STAFF**",
        `👥 Usuários: ${Object.keys(saldos).length}`,
        `🎮 Jogos: ${Object.keys(jogos).length}`,
        extra || ""
    ].join("\n");
}

async function atualizarOuCriarPainelStaff(interaction, extra = "") {
    const conteudo = montarConteudoPainelStaff(extra);
    const components = criarBotoesPainelStaff();

    const msg = await interaction.channel.send({
        content: conteudo,
        components
    });

    painelStaffAtivo.channelId = msg.channelId;
    painelStaffAtivo.messageId = msg.id;
}

client.once("clientReady", async () => {
    console.log(`Logado como ${client.user.tag}`);

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

    await rest.put(
        Routes.applicationCommands(client.user.id),
        {
            body: [
                pingCommand.data.toJSON(),
                saldoCommand.data.toJSON(),
                apostaCommand.data.toJSON(),
                apostarCommand.data.toJSON(),
                criarApostaCommand.data.toJSON(),
                fecharMercadoCommand.data.toJSON(),
                resultadoJogoCommand.data.toJSON(),
                rankingCommand.data.toJSON(),
                rankingRodadaCommand.data.toJSON(),
                resetarRodadaCommand.data.toJSON(),
                verApostasCommand.data.toJSON(),
                painelStaffCommand.data.toJSON()
            ]
        }
    );
});

client.on("interactionCreate", async (interaction) => {

    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "painel-staff") {
            if (!temPermissaoStaff(interaction)) {
                return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
            }

            await interaction.reply({ content: "Painel enviado", ephemeral: true });
            return atualizarOuCriarPainelStaff(interaction);
        }
    }

    if (interaction.isButton()) {
        const id = interaction.customId;

        if (!temPermissaoStaff(interaction)) return;

        if (id === "staff_adicionar_moedas" || id === "staff_remover_moedas") {
            const modal = new ModalBuilder()
                .setCustomId(id === "staff_adicionar_moedas" ? "modal_add" : "modal_remove")
                .setTitle("Moedas");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("usuario").setLabel("Usuário").setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("valor").setLabel("Valor").setStyle(TextInputStyle.Short)
                )
            );

            return interaction.showModal(modal);
        }

        if (id === "staff_ver_saldo_membro") {
            const modal = new ModalBuilder()
                .setCustomId("modal_saldo")
                .setTitle("Ver saldo");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("usuario").setLabel("Usuário").setStyle(TextInputStyle.Short)
                )
            );

            return interaction.showModal(modal);
        }

        if (id === "staff_excluir_jogo") {
            const modal = new ModalBuilder()
                .setCustomId("modal_excluir_jogo")
                .setTitle("Excluir jogo");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("jogo").setLabel("ID do jogo").setStyle(TextInputStyle.Short)
                )
            );

            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {

        if (interaction.customId === "modal_add" || interaction.customId === "modal_remove") {
            const userId = extrairUserId(interaction.fields.getTextInputValue("usuario"));
            const valor = Number(interaction.fields.getTextInputValue("valor"));

            if (!userId || isNaN(valor)) {
                return interaction.reply({ content: "❌ Dados inválidos", ephemeral: true });
            }

            saldos[userId] = saldos[userId] || 100;

            if (interaction.customId === "modal_add") {
                saldos[userId] += valor;
            } else {
                if (saldos[userId] < valor) {
                    return interaction.reply({ content: "❌ Saldo insuficiente", ephemeral: true });
                }
                saldos[userId] -= valor;
            }

            saveAll();

            return interaction.reply({
                content: `💰 Novo saldo: ${saldos[userId]}`,
                ephemeral: true
            });
        }

        if (interaction.customId === "modal_saldo") {
            const userId = extrairUserId(interaction.fields.getTextInputValue("usuario"));
            return interaction.reply({
                content: `💰 Saldo: ${saldos[userId] || 100}`,
                ephemeral: true
            });
        }

        if (interaction.customId === "modal_excluir_jogo") {
            const jogo = interaction.fields.getTextInputValue("jogo");

            if (!jogos[jogo]) {
                return interaction.reply({ content: "❌ Jogo não existe", ephemeral: true });
            }

            delete jogos[jogo];
            saveAll();

            return interaction.reply({ content: "✅ Jogo excluído", ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);

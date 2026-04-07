const { SlashCommandBuilder } = require("discord.js");
const { atualizarMensagemJogo } = require("../utils/jogos-utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("fechar-mercado")
        .setDescription("Fecha as apostas de um jogo (início da partida)")
        .addStringOption(option =>
            option.setName("jogo")
                .setDescription("Identificador do jogo")
                .setRequired(true)
        ),

    async execute(interaction, jogos, saveData, client) {
        const jogoId = interaction.options.getString("jogo").trim().toLowerCase();

        if (!jogos[jogoId]) {
            return interaction.reply({
                content: "❌ Esse jogo não existe.",
                ephemeral: true
            });
        }

        if (!jogos[jogoId].aberto) {
            return interaction.reply({
                content: "❌ Esse mercado já está fechado.",
                ephemeral: true
            });
        }

        jogos[jogoId].aberto = false;

        saveData();
        await atualizarMensagemJogo(client, jogoId, jogos[jogoId]);

        return interaction.reply({
            content:
`⏳ **MERCADO ENCERRADO**

🎮 Jogo: **${jogos[jogoId].time1} x ${jogos[jogoId].time2}**

As apostas foram encerradas.
As odds estão travadas.`,
            ephemeral: true
        });
    }
};

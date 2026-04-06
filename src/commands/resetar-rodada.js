const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("resetar-rodada")
        .setDescription("Zera o ranking da rodada atual")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, rodadaStats, saveData) {
        for (const userId of Object.keys(rodadaStats)) {
            delete rodadaStats[userId];
        }

        saveData();

        return interaction.reply({
            content: "✅ O ranking da rodada foi resetado com sucesso."
        });
    }
};

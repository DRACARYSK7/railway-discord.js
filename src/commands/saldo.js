const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("saldo")
        .setDescription("Mostra seu saldo de moedas"),

    async execute(interaction, saldos, saveData) {
        const userId = interaction.user.id;

        if (saldos[userId] == null) {
            saldos[userId] = 100;
            saveData();
        }

        return interaction.reply({
            content: `💰 Você tem **${saldos[userId].toFixed(2)} moedas**.`,
            ephemeral: true
        });
    }
};

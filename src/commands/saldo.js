const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("saldo")
        .setDescription("Mostra seu saldo de moedas"),

    async execute(interaction, saldos) {
        const userId = interaction.user.id;

        if (!saldos[userId]) {
            saldos[userId] = 100;
        }

        return interaction.reply({
            content: `💰 Você tem **${saldos[userId]} moedas**.`,
            ephemeral: true
        });
    }
};

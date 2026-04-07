const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("painel-staff")
        .setDescription("Abre o painel geral da staff")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        return interaction.reply({
            content: "📊 Carregando painel da staff...",
            ephemeral: true
        });
    }
};

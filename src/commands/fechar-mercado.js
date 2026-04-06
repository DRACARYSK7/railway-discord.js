const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("fechar-mercado")
        .setDescription("Fecha as apostas de um jogo (início da partida)")
        .addStringOption(option =>
            option.setName("jogo")
                .setDescription("Identificador do jogo")
                .setRequired(true)
        ),

    async execute(interaction, jogos, saveData) {
        const jogo = interaction.options.getString("jogo");

        if (!jogos[jogo]) {
            return interaction.reply({
                content: "❌ Esse jogo não existe.",
                ephemeral: true
            });
        }

        if (!jogos[jogo].aberto) {
            return interaction.reply({
                content: "❌ Esse mercado já está fechado.",
                ephemeral: true
            });
        }

        jogos[jogo].aberto = false;

        saveData();

        return interaction.reply({
            content:
`⏳ **MERCADO ENCERRADO**

🎮 Jogo: **${jogos[jogo].time1} x ${jogos[jogo].time2}**

As apostas foram encerradas.
As odds estão travadas.`
        });
    }
};

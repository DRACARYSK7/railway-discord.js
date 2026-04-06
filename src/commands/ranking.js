const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ranking")
        .setDescription("Mostra o ranking geral de moedas"),

    async execute(interaction, saldos) {
        const ranking = Object.entries(saldos)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (ranking.length === 0) {
            return interaction.reply({
                content: "❌ Ainda não há jogadores no ranking de moedas.",
                ephemeral: true
            });
        }

        const textoRanking = ranking
            .map(([userId, saldo], index) => {
                return `${index + 1}. <@${userId}> — **${saldo.toFixed(2)} moedas**`;
            })
            .join("\n");

        return interaction.reply({
            content:
`🏆 **RANKING GERAL DE MOEDAS**

${textoRanking}`
        });
    }
};

const { SlashCommandBuilder } = require("discord.js");

function formatarLucro(valor) {
    return `${valor >= 0 ? "+" : ""}${valor.toFixed(2)}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ranking-rodada")
        .setDescription("Mostra o ranking da rodada atual"),

    async execute(interaction, rodadaStats) {
        const ranking = Object.entries(rodadaStats)
            .filter(([, dados]) => {
                return dados.apostado > 0 || dados.retorno > 0 || dados.lucro !== 0;
            })
            .sort((a, b) => {
                if (b[1].lucro !== a[1].lucro) {
                    return b[1].lucro - a[1].lucro;
                }

                if (b[1].retorno !== a[1].retorno) {
                    return b[1].retorno - a[1].retorno;
                }

                return a[1].apostado - b[1].apostado;
            })
            .slice(0, 10);

        if (ranking.length === 0) {
            return interaction.reply({
                content: "❌ Ainda não há resultados na rodada.",
                ephemeral: true
            });
        }

        const textoRanking = ranking
            .map(([userId, dados], index) => {
                return `${index + 1}. <@${userId}> — **${formatarLucro(dados.lucro)} moedas** | Apostado: ${dados.apostado.toFixed(2)} | Retorno: ${dados.retorno.toFixed(2)}`;
            })
            .join("\n");

        return interaction.reply({
            content:
`📊 **RANKING DA RODADA**

${textoRanking}`
        });
    }
};

const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("finalizar-jogo")
        .setDescription("Finaliza um jogo e define o resultado")
        .addStringOption(option =>
            option.setName("jogo")
                .setDescription("Identificador do jogo. Ex: remo_vasco")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("resultado")
                .setDescription("Resultado final do jogo")
                .setRequired(true)
                .addChoices(
                    { name: "time1", value: "time1" },
                    { name: "empate", value: "empate" },
                    { name: "time2", value: "time2" }
                )),

    async execute(interaction, jogos, multiplas, saldos) {
        const jogo = interaction.options.getString("jogo");
        const resultado = interaction.options.getString("resultado");

        if (!jogos[jogo]) {
            return interaction.reply({
                content: "❌ Esse jogo não existe.",
                ephemeral: true
            });
        }

        jogos[jogo].aberto = false;
        jogos[jogo].resultado = resultado;

        const ganhadores = [];
        const perdedores = [];

        for (const userId of Object.keys(multiplas)) {
            const multipla = multiplas[userId];

            if (!multipla || multipla.resolvida) continue;

            const contemJogo = multipla.selecoes.some(selecao => selecao.jogo === jogo);
            if (!contemJogo) continue;

            // só resolve se TODOS os jogos da múltipla já tiverem resultado
            const todosFinalizados = multipla.selecoes.every(selecao => {
                return jogos[selecao.jogo] && jogos[selecao.jogo].resultado;
            });

            if (!todosFinalizados) continue;

            const acertouTudo = multipla.selecoes.every(selecao => {
                return jogos[selecao.jogo].resultado === selecao.escolha;
            });

            if (acertouTudo) {
                if (!saldos[userId]) saldos[userId] = 100;
                saldos[userId] += multipla.retornoPossivel;

                ganhadores.push(`<@${userId}> +${multipla.retornoPossivel.toFixed(2)} moedas`);
            } else {
                perdedores.push(`<@${userId}> perdeu a múltipla`);
            }

            multipla.resolvida = true;
        }

        return interaction.reply({
            content:
`🏁 **JOGO FINALIZADO**

🎮 Jogo: **${jogo}**
📌 Resultado: **${resultado}**

${ganhadores.length ? `💰 **Ganhadores:**\n${ganhadores.join("\n")}` : "💰 **Ganhadores:** ninguém"}
${perdedores.length ? `\n\n❌ **Perdedores:**\n${perdedores.join("\n")}` : "\n\n❌ **Perdedores:** ninguém"}`
        });
    }
};

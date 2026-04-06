const { SlashCommandBuilder } = require("discord.js");

function formatarLucro(valor) {
    return `${valor >= 0 ? "+" : ""}${valor.toFixed(2)}`;
}

function montarRankingMoedas(saldos) {
    const ranking = Object.entries(saldos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (ranking.length === 0) {
        return "ninguém";
    }

    return ranking
        .map(([userId, saldo], index) => {
            return `${index + 1}. <@${userId}> — **${saldo.toFixed(2)} moedas**`;
        })
        .join("\n");
}

function montarRankingRodada(rodadaStats) {
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
        return "ninguém";
    }

    return ranking
        .map(([userId, dados], index) => {
            return `${index + 1}. <@${userId}> — **${formatarLucro(dados.lucro)} moedas** | Apostado: ${dados.apostado.toFixed(2)} | Retorno: ${dados.retorno.toFixed(2)}`;
        })
        .join("\n");
}

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

    async execute(interaction, jogos, multiplas, saldos, rodadaStats) {
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
        let resolvidasAgora = 0;

        for (const userId of Object.keys(multiplas)) {
            const multipla = multiplas[userId];

            if (!multipla || multipla.resolvida) continue;

            const contemJogo = multipla.selecoes.some(selecao => selecao.jogo === jogo);
            if (!contemJogo) continue;

            const todosFinalizados = multipla.selecoes.every(selecao => {
                return jogos[selecao.jogo] && jogos[selecao.jogo].resultado;
            });

            if (!todosFinalizados) continue;

            const acertouTudo = multipla.selecoes.every(selecao => {
                return jogos[selecao.jogo].resultado === selecao.escolha;
            });

            if (!rodadaStats[userId]) {
                rodadaStats[userId] = {
                    apostado: 0,
                    retorno: 0,
                    lucro: 0,
                    vitorias: 0,
                    derrotas: 0
                };
            }

            rodadaStats[userId].apostado += multipla.valor;

            if (acertouTudo) {
                if (!saldos[userId]) {
                    saldos[userId] = 100;
                }

                saldos[userId] += multipla.retornoPossivel;

                const lucroLiquido = multipla.retornoPossivel - multipla.valor;

                rodadaStats[userId].retorno += multipla.retornoPossivel;
                rodadaStats[userId].lucro += lucroLiquido;
                rodadaStats[userId].vitorias += 1;

                ganhadores.push(
                    `<@${userId}> recebeu **${multipla.retornoPossivel.toFixed(2)} moedas** (lucro: **${formatarLucro(lucroLiquido)}**)`
                );
            } else {
                rodadaStats[userId].lucro -= multipla.valor;
                rodadaStats[userId].derrotas += 1;

                perdedores.push(
                    `<@${userId}> ficou com **${formatarLucro(-multipla.valor)} moedas**`
                );
            }

            multipla.resolvida = true;
            delete multiplas[userId];
            resolvidasAgora += 1;
        }

        const resumoResolucao = resolvidasAgora > 0
            ? `🎟️ Múltiplas resolvidas agora: **${resolvidasAgora}**`
            : "🎟️ Nenhuma múltipla foi resolvida ainda com esse resultado.";

        return interaction.reply({
            content:
`🏁 **JOGO FINALIZADO**

🎮 Jogo: **${jogo}**
📌 Resultado: **${resultado}**

${resumoResolucao}

${ganhadores.length ? `💰 **Ganhadores:**\n${ganhadores.join("\n")}` : "💰 **Ganhadores:** ninguém"}
${perdedores.length ? `\n\n❌ **Perdedores:**\n${perdedores.join("\n")}` : "\n\n❌ **Perdedores:** ninguém"}

🏆 **RANKING DE MOEDAS**
${montarRankingMoedas(saldos)}

📊 **RANKING DA RODADA**
${montarRankingRodada(rodadaStats)}`
        });
    }
};

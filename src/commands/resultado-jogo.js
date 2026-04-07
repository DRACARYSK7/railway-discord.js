const { SlashCommandBuilder } = require("discord.js");

function formatarLucro(valor) {
    return `${valor >= 0 ? "+" : ""}${Number(valor).toFixed(2)}`;
}

function montarRankingMoedas(saldos) {
    const ranking = Object.entries(saldos)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 10);

    if (ranking.length === 0) {
        return "ninguém";
    }

    return ranking
        .map(([userId, saldo], index) => {
            return `${index + 1}. <@${userId}> — **${Number(saldo).toFixed(2)} moedas**`;
        })
        .join("\n");
}

function montarRankingRodada(rodadaStats) {
    const ranking = Object.entries(rodadaStats)
        .filter(([, dados]) => {
            return Number(dados.apostado) > 0 || Number(dados.retorno) > 0 || Number(dados.lucro) !== 0;
        })
        .sort((a, b) => {
            if (Number(b[1].lucro) !== Number(a[1].lucro)) {
                return Number(b[1].lucro) - Number(a[1].lucro);
            }

            if (Number(b[1].retorno) !== Number(a[1].retorno)) {
                return Number(b[1].retorno) - Number(a[1].retorno);
            }

            return Number(a[1].apostado) - Number(b[1].apostado);
        })
        .slice(0, 10);

    if (ranking.length === 0) {
        return "ninguém";
    }

    return ranking
        .map(([userId, dados], index) => {
            return `${index + 1}. <@${userId}> — **${formatarLucro(Number(dados.lucro))} moedas** | Apostado: ${Number(dados.apostado).toFixed(2)} | Retorno: ${Number(dados.retorno).toFixed(2)}`;
        })
        .join("\n");
}

function garantirStats(rodadaStats, userId) {
    if (!rodadaStats[userId]) {
        rodadaStats[userId] = {
            apostado: 0,
            retorno: 0,
            lucro: 0,
            vitorias: 0,
            derrotas: 0
        };
    }
}

function atualizarHistorico(historicoApostas, userId, idAposta, atualizacao) {
    if (!Array.isArray(historicoApostas[userId])) return;

    const aposta = historicoApostas[userId].find(item => item.idAposta === idAposta);
    if (!aposta) return;

    Object.assign(aposta, atualizacao);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("resultado-jogo")
        .setDescription("Define o resultado final de um jogo")
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

    async execute(interaction, jogos, multiplas, saldos, rodadaStats, apostasValores, historicoApostas, saveData) {
        const jogo = interaction.options.getString("jogo");
        const resultado = interaction.options.getString("resultado");

        if (!jogos[jogo]) {
            return interaction.reply({
                content: "❌ Esse jogo não existe.",
                ephemeral: true
            });
        }

        if (jogos[jogo].resultado) {
            return interaction.reply({
                content: "❌ Esse jogo já teve um resultado definido.",
                ephemeral: true
            });
        }

        jogos[jogo].resultado = resultado;

        const ganhadores = [];
        const perdedores = [];

        let simplesResolvidas = 0;
        let multiplasResolvidas = 0;

        const apostasDoJogo = apostasValores[jogo] || {};

        for (const userId of Object.keys(apostasDoJogo)) {
            const aposta = apostasDoJogo[userId];
            if (!aposta) continue;

            garantirStats(rodadaStats, userId);

            const valorApostado = Number(aposta.valor);
            const odd = Number(aposta.odd);
            const retornoPossivel = valorApostado * odd;

            rodadaStats[userId].apostado += valorApostado;

            if (aposta.escolha === resultado) {
                if (saldos[userId] == null) {
                    saldos[userId] = 100;
                }

                saldos[userId] = Number(saldos[userId]) + retornoPossivel;

                const lucroLiquido = retornoPossivel - valorApostado;

                rodadaStats[userId].retorno += retornoPossivel;
                rodadaStats[userId].lucro += lucroLiquido;
                rodadaStats[userId].vitorias += 1;

                ganhadores.push(
                    `<@${userId}> ganhou na **simples** e recebeu **${retornoPossivel.toFixed(2)} moedas** (lucro: **${formatarLucro(lucroLiquido)}**)`
                );

                atualizarHistorico(historicoApostas, userId, aposta.idAposta, {
                    status: "ganhou",
                    resolvidaEm: new Date().toISOString(),
                    resultadoJogo: resultado,
                    retornoRecebido: Number(retornoPossivel),
                    lucroLiquido: Number(lucroLiquido)
                });
            } else {
                rodadaStats[userId].lucro -= valorApostado;
                rodadaStats[userId].derrotas += 1;

                perdedores.push(
                    `<@${userId}> perdeu na **simples** e ficou com **${formatarLucro(-valorApostado)} moedas**`
                );

                atualizarHistorico(historicoApostas, userId, aposta.idAposta, {
                    status: "perdeu",
                    resolvidaEm: new Date().toISOString(),
                    resultadoJogo: resultado,
                    retornoRecebido: 0,
                    lucroLiquido: Number(-valorApostado)
                });
            }

            simplesResolvidas += 1;
        }

        delete apostasValores[jogo];

        for (const userId of Object.keys(multiplas)) {
            const multipla = multiplas[userId];

            if (!multipla || multipla.resolvida) continue;

            const contemJogo = Array.isArray(multipla.selecoes) &&
                multipla.selecoes.some(selecao => selecao.jogo === jogo);

            if (!contemJogo) continue;

            const todosFinalizados = multipla.selecoes.every(selecao => {
                return jogos[selecao.jogo] && jogos[selecao.jogo].resultado;
            });

            if (!todosFinalizados) continue;

            const acertouTudo = multipla.selecoes.every(selecao => {
                return jogos[selecao.jogo].resultado === selecao.escolha;
            });

            garantirStats(rodadaStats, userId);

            const valorApostado = Number(multipla.valor);
            const retornoPossivel = Number(multipla.retornoPossivel);

            rodadaStats[userId].apostado += valorApostado;

            if (acertouTudo) {
                if (saldos[userId] == null) {
                    saldos[userId] = 100;
                }

                saldos[userId] = Number(saldos[userId]) + retornoPossivel;

                const lucroLiquido = retornoPossivel - valorApostado;

                rodadaStats[userId].retorno += retornoPossivel;
                rodadaStats[userId].lucro += lucroLiquido;
                rodadaStats[userId].vitorias += 1;

                ganhadores.push(
                    `<@${userId}> ganhou na **múltipla** e recebeu **${retornoPossivel.toFixed(2)} moedas** (lucro: **${formatarLucro(lucroLiquido)}**)`
                );

                atualizarHistorico(historicoApostas, userId, multipla.idAposta, {
                    status: "ganhou",
                    resolvidaEm: new Date().toISOString(),
                    retornoRecebido: Number(retornoPossivel),
                    lucroLiquido: Number(lucroLiquido)
                });
            } else {
                rodadaStats[userId].lucro -= valorApostado;
                rodadaStats[userId].derrotas += 1;

                perdedores.push(
                    `<@${userId}> perdeu na **múltipla** e ficou com **${formatarLucro(-valorApostado)} moedas**`
                );

                atualizarHistorico(historicoApostas, userId, multipla.idAposta, {
                    status: "perdeu",
                    resolvidaEm: new Date().toISOString(),
                    retornoRecebido: 0,
                    lucroLiquido: Number(-valorApostado)
                });
            }

            multipla.resolvida = true;
            delete multiplas[userId];
            multiplasResolvidas += 1;
        }

        saveData();

        return interaction.reply({
            content:
`🏁 **RESULTADO REGISTRADO**

🎮 Jogo: **${jogos[jogo].time1} x ${jogos[jogo].time2}**
📌 Resultado: **${resultado}**

🎟️ Simples resolvidas agora: **${simplesResolvidas}**
🎟️ Múltiplas resolvidas agora: **${multiplasResolvidas}**

${ganhadores.length ? `💰 **Ganhadores:**\n${ganhadores.join("\n")}` : "💰 **Ganhadores:** ninguém"}
${perdedores.length ? `\n\n❌ **Perdedores:**\n${perdedores.join("\n")}` : "\n\n❌ **Perdedores:** ninguém"}

🏆 **RANKING DE MOEDAS**
${montarRankingMoedas(saldos)}

📊 **RANKING DA RODADA**
${montarRankingRodada(rodadaStats)}`
        });
    }
};

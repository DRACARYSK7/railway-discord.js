const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

function formatOdd(valor) {
    return Number(valor).toFixed(2);
}

function formatarDataHoraBR(data, horario) {
    if (!data && !horario) return "Não definido";
    if (!data) return horario || "Não definido";

    const partes = String(data).split("-");
    if (partes.length !== 3) {
        return horario ? `${data} às ${horario}` : data;
    }

    const [ano, mes, dia] = partes;
    const dataFormatada = `${dia}/${mes}/${ano}`;

    if (!horario) return dataFormatada;

    return `${dataFormatada} às ${horario}`;
}

function jogoJaComecou(jogo) {
    if (!jogo?.dataJogo || !jogo?.horarioJogo) return false;

    const dataHoraTexto = `${jogo.dataJogo}T${jogo.horarioJogo}:00`;
    const inicioJogo = new Date(dataHoraTexto);

    if (Number.isNaN(inicioJogo.getTime())) {
        return false;
    }

    return Date.now() >= inicioJogo.getTime();
}

function criarBotoesJogo(jogoId, jogo) {
    const botoesDesabilitados = !jogo.aberto;

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`bet|${jogoId}|time1`)
                .setLabel(`${jogo.time1} (${formatOdd(jogo.odd1)})`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(botoesDesabilitados),

            new ButtonBuilder()
                .setCustomId(`bet|${jogoId}|empate`)
                .setLabel(`Empate (${formatOdd(jogo.oddEmpate)})`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(botoesDesabilitados),

            new ButtonBuilder()
                .setCustomId(`bet|${jogoId}|time2`)
                .setLabel(`${jogo.time2} (${formatOdd(jogo.odd2)})`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(botoesDesabilitados)
        )
    ];
}

function descobrirTextoStatus(jogo) {
    if (jogo.resultado) return "FINALIZADO";
    if (jogo.aberto) return "ABERTO";
    return "FECHADO";
}

function descobrirTextoResultado(jogo) {
    if (!jogo.resultado) return "Aguardando resultado";

    if (jogo.resultado === "time1") return jogo.time1;
    if (jogo.resultado === "empate") return "Empate";
    if (jogo.resultado === "time2") return jogo.time2;

    return jogo.resultado;
}

function montarMensagemJogo(jogoId, jogo, acertadoresSimples = []) {
    const status = descobrirTextoStatus(jogo);
    const resultado = descobrirTextoResultado(jogo);
    const dataHora = formatarDataHoraBR(jogo.dataJogo, jogo.horarioJogo);

    const linhas = [
        "🎮 **NOVA APOSTA CRIADA**",
        "",
        `🆔 Jogo: **${jogoId}**`,
        `⚽ **${jogo.time1}** x **${jogo.time2}**`,
        `📅 **${dataHora}**`,
        `📌 Status: **${status}**`
    ];

    if (jogo.resultado) {
        linhas.push(`🏁 Resultado: **${resultado}**`);
    }

    if (Array.isArray(acertadoresSimples) && acertadoresSimples.length > 0) {
        linhas.push("");
        linhas.push("✅ **Acertaram na aposta simples:**");
        linhas.push(acertadoresSimples.map(userId => `• <@${userId}>`).join("\n"));
    }

    if (!jogo.resultado) {
        linhas.push("");
        linhas.push("Escolha uma opção abaixo para adicionar ao seu bilhete.");
    }

    return linhas.join("\n");
}

async function atualizarMensagemJogo(client, jogoId, jogo, acertadoresSimples = []) {
    if (!jogo?.channelId || !jogo?.messageId) {
        return;
    }

    try {
        const channel = await client.channels.fetch(jogo.channelId);
        if (!channel || !channel.isTextBased()) return;

        const message = await channel.messages.fetch(jogo.messageId);

        await message.edit({
            content: montarMensagemJogo(jogoId, jogo, acertadoresSimples),
            components: criarBotoesJogo(jogoId, jogo),
            allowedMentions: { parse: [] }
        });
    } catch (error) {
        console.error(`Erro ao atualizar mensagem do jogo ${jogoId}:`, error);
    }
}

function fecharMercadosAutomaticamente(jogos) {
    const jogosFechados = [];

    for (const jogoId of Object.keys(jogos)) {
        const jogo = jogos[jogoId];

        if (!jogo) continue;
        if (!jogo.aberto) continue;
        if (jogo.resultado) continue;

        if (jogoJaComecou(jogo)) {
            jogo.aberto = false;
            jogosFechados.push(jogoId);
        }
    }

    return jogosFechados;
}

/* ========================= */
/* 🔥 NOVO: RESUMO DA RODADA */
/* ========================= */

function montarRankingMoedasResumo(saldos) {
    const ranking = Object.entries(saldos)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 10);

    if (ranking.length === 0) return "ninguém";

    return ranking
        .map(([userId, saldo], index) =>
            `${index + 1}. <@${userId}> — **${Number(saldo).toFixed(2)} moedas**`
        )
        .join("\n");
}

function montarRankingRodadaResumo(rodadaStats) {
    const ranking = Object.entries(rodadaStats)
        .filter(([, d]) =>
            Number(d.apostado) > 0 ||
            Number(d.retorno) > 0 ||
            Number(d.lucro) !== 0
        )
        .sort((a, b) => Number(b[1].lucro) - Number(a[1].lucro))
        .slice(0, 10);

    if (ranking.length === 0) return "ninguém";

    return ranking
        .map(([userId, d], index) =>
            `${index + 1}. <@${userId}> — **${Number(d.lucro).toFixed(2)}** | Apostado: ${Number(d.apostado).toFixed(2)} | Retorno: ${Number(d.retorno).toFixed(2)}`
        )
        .join("\n");
}

function montarResumoResultadosRodada(jogos, saldos, rodadaStats) {
    const finalizados = Object.entries(jogos)
        .filter(([, jogo]) => jogo?.resultado)
        .map(([_, jogo]) => {
            let resultadoTexto = "Aguardando";

            if (jogo.resultado === "time1") resultadoTexto = jogo.time1;
            if (jogo.resultado === "empate") resultadoTexto = "Empate";
            if (jogo.resultado === "time2") resultadoTexto = jogo.time2;

            return `• **${jogo.time1} x ${jogo.time2}** — ${resultadoTexto}`;
        });

    return [
        "🏁 **RESULTADOS DA RODADA**",
        "",
        finalizados.length
            ? finalizados.join("\n")
            : "Nenhum resultado registrado ainda.",
        "",
        "🏆 **RANKING DE MOEDAS**",
        montarRankingMoedasResumo(saldos),
        "",
        "📊 **RANKING DA RODADA**",
        montarRankingRodadaResumo(rodadaStats)
    ].join("\n");
}

async function atualizarOuCriarPainelRodada(
    client,
    painelRodada,
    jogos,
    saldos,
    rodadaStats
) {
    const conteudo = montarResumoResultadosRodada(
        jogos,
        saldos,
        rodadaStats
    );

    if (painelRodada?.channelId && painelRodada?.messageId) {
        try {
            const channel = await client.channels.fetch(painelRodada.channelId);
            if (!channel?.isTextBased()) return;

            const message = await channel.messages.fetch(
                painelRodada.messageId
            );

            await message.edit({
                content: conteudo,
                allowedMentions: { parse: [] }
            });

            return true;
        } catch (error) {
            console.error("Erro ao atualizar painel da rodada:", error);
        }
    }

    return false;
}

/* ========================= */

module.exports = {
    formatOdd,
    formatarDataHoraBR,
    jogoJaComecou,
    criarBotoesJogo,
    montarMensagemJogo,
    atualizarMensagemJogo,
    fecharMercadosAutomaticamente,
    montarResumoResultadosRodada,
    atualizarOuCriarPainelRodada
};

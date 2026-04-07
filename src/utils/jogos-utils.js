const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

function formatOdd(valor) {
    return Number(valor).toFixed(2);
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

    const linhas = [
        "🎮 **NOVA APOSTA CRIADA**",
        "",
        `🆔 Jogo: **${jogoId}**`,
        `⚽ **${jogo.time1}** x **${jogo.time2}**`,
        `📅 Data: **${jogo.dataJogo || "Não definida"}**`,
        `🕒 Horário: **${jogo.horarioJogo || "Não definido"}**`,
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

module.exports = {
    formatOdd,
    jogoJaComecou,
    criarBotoesJogo,
    montarMensagemJogo,
    atualizarMensagemJogo,
    fecharMercadosAutomaticamente
};

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

function statusBonito(status) {
    if (status === "ativa") return "🟡 ativa";
    if (status === "ganhou") return "🟢 ganhou";
    if (status === "perdeu") return "🔴 perdeu";
    return "⚪ desconhecido";
}

function montarLinhasUsuario(userId, lista) {
    if (!Array.isArray(lista) || lista.length === 0) {
        return `👤 <@${userId}>\nNenhuma aposta registrada.\n`;
    }

    const ordenadas = [...lista].sort((a, b) => {
        return new Date(b.criadaEm || 0).getTime() - new Date(a.criadaEm || 0).getTime();
    });

    let texto = `👤 <@${userId}>\n`;

    for (const aposta of ordenadas) {
        if (aposta.tipo === "simples") {
            texto += `• **Simples** | ${statusBonito(aposta.status)} | Jogo: \`${aposta.jogo}\` | Escolha: **${aposta.nomeEscolha || aposta.escolha}** | Valor: **${Number(aposta.valor).toFixed(2)}** | Odd: **${Number(aposta.odd).toFixed(2)}**\n`;
        } else if (aposta.tipo === "multipla") {
            const selecoesTexto = Array.isArray(aposta.selecoes)
                ? aposta.selecoes.map(s => `${s.jogo}: ${s.nomeEscolha}`).join(", ")
                : "sem seleções";

            texto += `• **Múltipla** | ${statusBonito(aposta.status)} | Valor: **${Number(aposta.valor).toFixed(2)}** | Odd total: **${Number(aposta.oddTotal).toFixed(2)}**\n`;
            texto += `  Seleções: ${selecoesTexto}\n`;
        }
    }

    texto += "\n";
    return texto;
}

function dividirEmBlocos(texto, limite = 1900) {
    const linhas = texto.split("\n");
    const blocos = [];
    let atual = "";

    for (const linha of linhas) {
        if ((atual + linha + "\n").length > limite) {
            if (atual.trim()) blocos.push(atual);
            atual = `${linha}\n`;
        } else {
            atual += `${linha}\n`;
        }
    }

    if (atual.trim()) blocos.push(atual);
    return blocos;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ver-apostas")
        .setDescription("Mostra o histórico de apostas dos membros")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, historicoApostas) {
        const userIds = Object.keys(historicoApostas || {});

        if (userIds.length === 0) {
            return interaction.reply({
                content: "❌ Nenhuma aposta foi registrada ainda.",
                ephemeral: true
            });
        }

        let texto = "📄 **HISTÓRICO DE APOSTAS DOS MEMBROS**\n\n";

        for (const userId of userIds) {
            texto += montarLinhasUsuario(userId, historicoApostas[userId]);
        }

        const blocos = dividirEmBlocos(texto);

        await interaction.reply({
            content: blocos[0],
            ephemeral: true
        });

        for (let i = 1; i < blocos.length; i++) {
            await interaction.followUp({
                content: blocos[i],
                ephemeral: true
            });
        }
    }
};

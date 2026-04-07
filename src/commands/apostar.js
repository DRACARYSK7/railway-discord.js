const { SlashCommandBuilder } = require("discord.js");

function formatOdd(valor) {
    return Number(valor).toFixed(2);
}

function oddDecimal(valor) {
    return Number(valor);
}

function gerarIdAposta() {
    return `simples_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("apostar")
        .setDescription("Faz uma aposta com moedas")
        .addStringOption(option =>
            option.setName("jogo")
                .setDescription("Identificador do jogo. Ex: remo_vasco")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("escolha")
                .setDescription("Sua escolha")
                .setRequired(true)
                .addChoices(
                    { name: "time1", value: "time1" },
                    { name: "empate", value: "empate" },
                    { name: "time2", value: "time2" }
                ))
        .addIntegerOption(option =>
            option.setName("valor")
                .setDescription("Quantidade de moedas para apostar")
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction, saldos, jogos, apostasValores, historicoApostas, saveAll) {
        const userId = interaction.user.id;
        const jogo = interaction.options.getString("jogo");
        const escolha = interaction.options.getString("escolha");
        const valor = interaction.options.getInteger("valor");

        if (saldos[userId] == null) {
            saldos[userId] = 100;
        }

        if (!jogos[jogo]) {
            return interaction.reply({
                content: "❌ Esse jogo não existe.",
                ephemeral: true
            });
        }

        if (!jogos[jogo].aberto) {
            return interaction.reply({
                content: "❌ As apostas para esse jogo estão fechadas.",
                ephemeral: true
            });
        }

        if (Number(saldos[userId]) < valor) {
            return interaction.reply({
                content: `❌ Você não tem saldo suficiente. Seu saldo atual é **${Number(saldos[userId]).toFixed(2)} moedas**.`,
                ephemeral: true
            });
        }

        if (!apostasValores[jogo]) {
            apostasValores[jogo] = {};
        }

        if (apostasValores[jogo][userId]) {
            return interaction.reply({
                content: "❌ Você já fez uma aposta simples com valor nesse jogo.",
                ephemeral: true
            });
        }

        let odd = 1;
        let nomeEscolha = "";

        if (escolha === "time1") {
            odd = jogos[jogo].odd1;
            nomeEscolha = jogos[jogo].time1;
        }

        if (escolha === "empate") {
            odd = jogos[jogo].oddEmpate;
            nomeEscolha = "Empate";
        }

        if (escolha === "time2") {
            odd = jogos[jogo].odd2;
            nomeEscolha = jogos[jogo].time2;
        }

        const oddCalculada = oddDecimal(odd);
        const retornoPossivel = valor * oddCalculada;
        const idAposta = gerarIdAposta();

        saldos[userId] = Number(saldos[userId]) - Number(valor);

        apostasValores[jogo][userId] = {
            idAposta,
            escolha,
            valor: Number(valor),
            odd: Number(odd),
            nomeEscolha
        };

        if (!Array.isArray(historicoApostas[userId])) {
            historicoApostas[userId] = [];
        }

        historicoApostas[userId].push({
            idAposta,
            tipo: "simples",
            jogo,
            escolha,
            nomeEscolha,
            valor: Number(valor),
            odd: Number(odd),
            retornoPossivel: Number(retornoPossivel),
            status: "ativa",
            criadaEm: new Date().toISOString()
        });

        saveAll();

        return interaction.reply({
            content:
`✅ **Aposta registrada!**

🎮 Jogo: **${jogo}**
🎯 Escolha: **${nomeEscolha}**
💰 Valor apostado: **${Number(valor).toFixed(2)} moedas**
📈 Odd travada: **${formatOdd(odd)}**
💸 Retorno possível: **${retornoPossivel.toFixed(2)} moedas**
💳 Saldo restante: **${Number(saldos[userId]).toFixed(2)} moedas**`,
            ephemeral: true
        });
    }
};

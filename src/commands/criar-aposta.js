const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

function formatOdd(valor) {
    return Number(valor).toFixed(2);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("criar-aposta")
        .setDescription("Cria uma aposta com botões")
        .addStringOption(option =>
            option.setName("jogo")
                .setDescription("Identificador do jogo. Ex: remo_vasco")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("time1")
                .setDescription("Nome do primeiro time")
                .setRequired(true))
        .addNumberOption(option =>
            option.setName("odd1")
                .setDescription("Odd do primeiro time")
                .setRequired(true))
        .addNumberOption(option =>
            option.setName("oddempate")
                .setDescription("Odd do empate")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("time2")
                .setDescription("Nome do segundo time")
                .setRequired(true))
        .addNumberOption(option =>
            option.setName("odd2")
                .setDescription("Odd do segundo time")
                .setRequired(true)),

    async execute(interaction, jogos, saveData) {
        const jogo = interaction.options.getString("jogo").trim().toLowerCase();
        const time1 = interaction.options.getString("time1").trim();
        const odd1 = interaction.options.getNumber("odd1");
        const oddEmpate = interaction.options.getNumber("oddempate");
        const time2 = interaction.options.getString("time2").trim();
        const odd2 = interaction.options.getNumber("odd2");

        if (jogos[jogo]) {
            return interaction.reply({
                content: "❌ Já existe um jogo com esse identificador.",
                ephemeral: true
            });
        }

        jogos[jogo] = {
            time1,
            odd1,
            oddEmpate,
            time2,
            odd2,
            aberto: true,
            resultado: null
        };

        saveData();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`bet|${jogo}|time1`)
                .setLabel(`${time1} (${formatOdd(odd1)})`)
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(`bet|${jogo}|empate`)
                .setLabel(`Empate (${formatOdd(oddEmpate)})`)
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId(`bet|${jogo}|time2`)
                .setLabel(`${time2} (${formatOdd(odd2)})`)
                .setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({
            content:
`🎮 **Nova aposta criada**

🆔 Jogo: **${jogo}**
⚽ **${time1}** x **${time2}**

Escolha uma opção abaixo para adicionar ao seu bilhete.`,
            components: [row]
        });
    }
};

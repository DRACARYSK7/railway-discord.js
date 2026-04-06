const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("criar-aposta")
        .setDescription("Cria uma aposta com botões e odds")
        .addStringOption(option =>
            option.setName("jogo")
                .setDescription("ID do jogo. Ex: remo_vasco")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("time1")
                .setDescription("Nome do primeiro time")
                .setRequired(true))
        .addNumberOption(option =>
            option.setName("odd1")
                .setDescription("Odd do time1. Ex: 2.70")
                .setRequired(true))
        .addNumberOption(option =>
            option.setName("oddempate")
                .setDescription("Odd do empate. Ex: 3.25")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("time2")
                .setDescription("Nome do segundo time")
                .setRequired(true))
        .addNumberOption(option =>
            option.setName("odd2")
                .setDescription("Odd do time2. Ex: 2.40")
                .setRequired(true)),

    async execute(interaction, jogos) {
        const jogo = interaction.options.getString("jogo");
        const time1 = interaction.options.getString("time1");
        const odd1 = interaction.options.getNumber("odd1");
        const oddEmpate = interaction.options.getNumber("oddempate");
        const time2 = interaction.options.getString("time2");
        const odd2 = interaction.options.getNumber("odd2");

        jogos[jogo] = {
            jogo,
            time1,
            odd1,
            oddEmpate,
            time2,
            odd2,
            aberto: true
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`apostar|${jogo}|time1`)
                .setLabel(`${time1}`)
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`apostar|${jogo}|empate`)
                .setLabel("Empate")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId(`apostar|${jogo}|time2`)
                .setLabel(`${time2}`)
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            content:
`⚽ **APOSTA ABERTA**

🎮 **${time1} x ${time2}**

🔥 **${time1}** — odd **${odd1.toFixed(2)}**
🤝 **Empate** — odd **${oddEmpate.toFixed(2)}**
🔥 **${time2}** — odd **${odd2.toFixed(2)}**

💰 Clique em uma opção para informar o valor da aposta.`,
            components: [row]
        });
    }
};

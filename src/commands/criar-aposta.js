const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("criar-aposta")
        .setDescription("Cria uma aposta com odds")
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
                .setDescription("Odd do time1")
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
                .setDescription("Odd do time2")
                .setRequired(true)),

    async execute(interaction, jogos) {
        const jogo = interaction.options.getString("jogo");
        const time1 = interaction.options.getString("time1");
        const odd1 = interaction.options.getNumber("odd1");
        const oddEmpate = interaction.options.getNumber("oddempate");
        const time2 = interaction.options.getString("time2");
        const odd2 = interaction.options.getNumber("odd2");

        jogos[jogo] = {
            time1,
            odd1,
            oddEmpate,
            time2,
            odd2,
            aberto: true
        };

        return interaction.reply({
            content:
`⚽ **APOSTA ABERTA!**

🎮 Jogo: **${jogo}**

🔥 **${time1}** — odd **${odd1.toFixed(2)}**
🤝 **Empate** — odd **${oddEmpate.toFixed(2)}**
🔥 **${time2}** — odd **${odd2.toFixed(2)}**

Use:
\`/apostar jogo:${jogo} escolha:time1 valor:10\`
\`/apostar jogo:${jogo} escolha:empate valor:10\`
\`/apostar jogo:${jogo} escolha:time2 valor:10\``
        });
    }
};

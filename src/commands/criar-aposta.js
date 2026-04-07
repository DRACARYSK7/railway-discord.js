const { SlashCommandBuilder } = require("discord.js");
const {
    criarBotoesJogo,
    montarMensagemJogo
} = require("../utils/jogos-utils");

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
                .setRequired(true))
        .addStringOption(option =>
            option.setName("data")
                .setDescription("Data do jogo no formato AAAA-MM-DD. Ex: 2026-04-08")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("horario")
                .setDescription("Horário do jogo no formato HH:MM. Ex: 21:30")
                .setRequired(true)),

    async execute(interaction, jogos, saveData) {
        const jogo = interaction.options.getString("jogo").trim().toLowerCase();
        const time1 = interaction.options.getString("time1").trim();
        const odd1 = interaction.options.getNumber("odd1");
        const oddEmpate = interaction.options.getNumber("oddempate");
        const time2 = interaction.options.getString("time2").trim();
        const odd2 = interaction.options.getNumber("odd2");
        const dataJogo = interaction.options.getString("data").trim();
        const horarioJogo = interaction.options.getString("horario").trim();

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
            resultado: null,
            dataJogo,
            horarioJogo,
            channelId: null,
            messageId: null
        };

        const components = criarBotoesJogo(jogo, jogos[jogo]);

        await interaction.reply({
            content: montarMensagemJogo(jogo, jogos[jogo]),
            components
        });

        const resposta = await interaction.fetchReply();

        jogos[jogo].channelId = resposta.channelId;
        jogos[jogo].messageId = resposta.id;

        saveData();

        return;
    }
};

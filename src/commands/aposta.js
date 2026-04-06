const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aposta')
    .setDescription('Cria uma aposta')
    .addStringOption(option =>
      option.setName('time1')
        .setDescription('Primeiro time')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('time2')
        .setDescription('Segundo time')
        .setRequired(true)),

  async execute(interaction) {
    const time1 = interaction.options.getString('time1');
    const time2 = interaction.options.getString('time2');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('time1')
          .setLabel(`🔥 ${time1}`)
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId('empate')
          .setLabel('🤝 Empate')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId('time2')
          .setLabel(`🔥 ${time2}`)
          .setStyle(ButtonStyle.Danger),
      );

    await interaction.reply({
      content: `⚽ **APOSTA ABERTA!**\n\n${time1} x ${time2}\n\nEscolha abaixo:`,
      components: [row],
    });
  },
};

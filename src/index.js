require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require("discord.js");

const { loadDatabase, saveDatabase, DB_PATH } = require("./storage");
const {
    fecharMercadosAutomaticamente,
    atualizarMensagemJogo
} = require("./utils/jogos-utils");

const pingCommand = require("./commands/ping.js");
const saldoCommand = require("./commands/saldo.js");
const apostaCommand = require("./commands/aposta.js");
const apostarCommand = require("./commands/apostar.js");
const criarApostaCommand = require("./commands/criar-aposta.js");
const fecharMercadoCommand = require("./commands/fechar-mercado.js");
const resultadoJogoCommand = require("./commands/resultado-jogo.js");
const rankingCommand = require("./commands/ranking.js");
const rankingRodadaCommand = require("./commands/ranking-rodada.js");
const resetarRodadaCommand = require("./commands/resetar-rodada.js");
const verApostasCommand = require("./commands/ver-apostas.js");
const painelStaffCommand = require("./commands/painel-staff.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const database = loadDatabase();

const saldos = database.saldos || {};
const jogos = database.jogos || {};
const carrinhos = database.carrinhos || {};
const multiplas = database.multiplas || {};
const rodadaStats = database.rodadaStats || {};
const apostasValores = database.apostasValores || {};
const historicoApostas = database.historicoApostas || {};
const painelRodada = database.painelRodada || {
    channelId: null,
    messageId: null
};

const paineisBilhete = {};
const painelStaffAtivo = {};

function saveAll() {
    saveDatabase({
        saldos,
        jogos,
        carrinhos,
        multiplas,
        rodadaStats,
        apostasValores,
        historicoApostas,
        painelRodada
    });
}

function gerarIdAposta() {
    return `multipla_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function temPermissaoStaff(interaction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

function extrairUserId(input) {
    if (!input) return null;

    const texto = input.trim();

    const mentionMatch = texto.match(/^<@!?(\d+)>$/);
    if (mentionMatch) return mentionMatch[1];

    const idMatch = texto.match(/^(\d{16,25})$/);
    if (idMatch) return idMatch[1];

    return null;
}

function formatarStatusAposta(status) {
    if (status === "ativa") return "🟡 ativa";
    if (status === "ganhou") return "🟢 ganhou";
    if (status === "perdeu") return "🔴 perdeu";
    return "⚪ desconhecido";
}

function criarBotoesPainel(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`painel_saldo|${userId}`)
            .setLabel("Ver saldo")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId(`painel_bilhete|${userId}`)
            .setLabel("Ver bilhete")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`painel_apostas|${userId}`)
            .setLabel("Minhas apostas")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId(`painel_fechar|${userId}`)
            .setLabel("Fechar múltipla")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId(`painel_limpar|${userId}`)
            .setLabel("Limpar bilhete")
            .setStyle(ButtonStyle.Danger)
    );
}

function criarBotoesPainelStaff() {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("staff_atualizar")
            .setLabel("Atualizar painel")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("staff_ver_apostas")
            .setLabel("Ver apostas")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("staff_ver_ranking")
            .setLabel("Ver ranking")
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("staff_adicionar_moedas")
            .setLabel("Adicionar moedas")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("staff_remover_moedas")
            .setLabel("Remover moedas")
            .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
            .setCustomId("staff_ver_saldo_membro")
            .setLabel("Ver saldo membro")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("staff_resetar_rodada")
            .setLabel("Resetar rodada")
            .setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("staff_excluir_jogo")
            .setLabel("Excluir jogo")
            .setStyle(ButtonStyle.Danger)
    );

    return [row1, row2, row3];
}

function montarConteudoBilhete(userId, extra = "") {
    const itens = Array.isArray(carrinhos[userId]) ? carrinhos[userId] : [];
    const saldo = Number(saldos[userId] ?? 100);

    if (itens.length === 0) {
        return [
            `🧾 **Bilhete de <@${userId}>**`,
            "",
            "❌ Seu bilhete está vazio.",
            "",
            `💰 Saldo: **${saldo.toFixed(2)} moedas**`,
            extra ? `\n${extra}` : ""
        ].join("\n");
    }

    const lista = itens
        .map(item => `🎯 **${item.jogo}** → **${item.nomeEscolha}** (${Number(item.odd).toFixed(2)})`)
        .join("\n");

    const oddParcial = itens.reduce((acc, item) => acc * Number(item.odd), 1);

    return [
        `🧾 **Bilhete de <@${userId}>**`,
        "",
        lista,
        "",
        `📈 Odd parcial: **${oddParcial.toFixed(2)}**`,
        `💰 Saldo: **${saldo.toFixed(2)} moedas**`,
        extra ? `\n${extra}` : ""
    ].join("\n");
}

function montarConteudoMinhasApostas(userId, extra = "") {
    const lista = Array.isArray(historicoApostas[userId]) ? [...historicoApostas[userId]] : [];
    const saldo = Number(saldos[userId] ?? 100);

    if (lista.length === 0) {
        return [
            `📄 **Apostas de <@${userId}>**`,
            "",
            "❌ Você ainda não fez apostas confirmadas.",
            "",
            `💰 Saldo: **${saldo.toFixed(2)} moedas**`,
            extra ? `\n${extra}` : ""
        ].join("\n");
    }

    lista.sort((a, b) => new Date(b.criadaEm || 0) - new Date(a.criadaEm || 0));

    const textoApostas = lista.slice(0, 10).map((aposta, index) => {
        if (aposta.tipo === "simples") {
            return `**${index + 1}.** [SIMPLES - ${String(aposta.status || "ativa").toUpperCase()}] \`${aposta.jogo}\` → **${aposta.nomeEscolha || aposta.escolha}** | Valor: **${Number(aposta.valor).toFixed(2)}** | Odd: **${Number(aposta.odd).toFixed(2)}**`;
        }

        const quantidadeSelecoes = Array.isArray(aposta.selecoes) ? aposta.selecoes.length : 0;
        return `**${index + 1}.** [MÚLTIPLA - ${String(aposta.status || "ativa").toUpperCase()}] ${quantidadeSelecoes} seleções | Valor: **${Number(aposta.valor).toFixed(2)}** | Odd total: **${Number(aposta.oddTotal).toFixed(2)}**`;
    }).join("\n");

    return [
        `📄 **Apostas de <@${userId}>**`,
        "",
        textoApostas,
        "",
        `💰 Saldo: **${saldo.toFixed(2)} moedas**`,
        lista.length > 10 ? `📌 Mostrando as 10 mais recentes de ${lista.length}.` : "",
        extra ? `\n${extra}` : ""
    ].join("\n");
}
function contarApostasSimplesAtivas() {
    let total = 0;

    for (const jogoId of Object.keys(apostasValores)) {
        const apostasDoJogo = apostasValores[jogoId] || {};
        total += Object.keys(apostasDoJogo).length;
    }

    return total;
}

function somarApostasSimplesAtivas() {
    let total = 0;

    for (const jogoId of Object.keys(apostasValores)) {
        const apostasDoJogo = apostasValores[jogoId] || {};

        for (const userId of Object.keys(apostasDoJogo)) {
            total += Number(apostasDoJogo[userId]?.valor || 0);
        }
    }

    return total;
}

function contarMultiplasAtivas() {
    let total = 0;

    for (const userId of Object.keys(multiplas)) {
        if (multiplas[userId] && !multiplas[userId].resolvida) {
            total += 1;
        }
    }

    return total;
}

function somarMultiplasAtivas() {
    let total = 0;

    for (const userId of Object.keys(multiplas)) {
        if (multiplas[userId] && !multiplas[userId].resolvida) {
            total += Number(multiplas[userId].valor || 0);
        }
    }

    return total;
}

function montarConteudoPainelStaff(extra = "") {
    const totalJogos = Object.keys(jogos).length;
    const jogosAbertos = Object.values(jogos).filter(jogo => jogo?.aberto).length;
    const jogosFechados = Object.values(jogos).filter(jogo => jogo && !jogo.aberto).length;
    const simplesAtivas = contarApostasSimplesAtivas();
    const multiplasAtivas = contarMultiplasAtivas();
    const totalSimples = somarApostasSimplesAtivas();
    const totalMultiplas = somarMultiplasAtivas();
    const totalUsuariosSaldo = Object.keys(saldos).length;
    const totalHistoricos = Object.values(historicoApostas).reduce((acc, lista) => {
        return acc + (Array.isArray(lista) ? lista.length : 0);
    }, 0);

    return [
        "📊 **PAINEL STAFF - VISÃO GERAL**",
        "",
        `👥 Usuários com saldo registrado: **${totalUsuariosSaldo}**`,
        `🎮 Jogos cadastrados: **${totalJogos}**`,
        `🟢 Jogos abertos: **${jogosAbertos}**`,
        `🔴 Jogos fechados: **${jogosFechados}**`,
        "",
        `🎟️ Apostas simples ativas: **${simplesAtivas}**`,
        `🧾 Múltiplas ativas: **${multiplasAtivas}**`,
        `📚 Histórico total de apostas: **${totalHistoricos}**`,
        "",
        `💰 Total apostado em simples ativas: **${totalSimples.toFixed(2)} moedas**`,
        `💰 Total apostado em múltiplas ativas: **${totalMultiplas.toFixed(2)} moedas**`,
        extra ? `\n${extra}` : ""
    ].join("\n");
}

function montarRankingGeralTexto() {
    const ranking = Object.entries(saldos)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 10);

    if (ranking.length === 0) {
        return "❌ Ainda não há jogadores no ranking de moedas.";
    }

    const textoRanking = ranking
        .map(([userId, saldo], index) => {
            return `${index + 1}. <@${userId}> — **${Number(saldo).toFixed(2)} moedas**`;
        })
        .join("\n");

    return `🏆 **RANKING GERAL DE MOEDAS**\n\n${textoRanking}`;
}

function montarHistoricoCompletoTexto() {
    const userIds = Object.keys(historicoApostas || {});

    if (userIds.length === 0) {
        return "❌ Nenhuma aposta foi registrada ainda.";
    }

    let texto = "📄 **HISTÓRICO DE APOSTAS DOS MEMBROS**\n\n";

    for (const userId of userIds) {
        const lista = Array.isArray(historicoApostas[userId]) ? [...historicoApostas[userId]] : [];

        texto += `👤 <@${userId}>\n`;

        if (lista.length === 0) {
            texto += "Nenhuma aposta registrada.\n\n";
            continue;
        }

        lista.sort((a, b) => new Date(b.criadaEm || 0) - new Date(a.criadaEm || 0));

        for (const aposta of lista.slice(0, 10)) {
            if (aposta.tipo === "simples") {
                texto += `• **Simples** | ${formatarStatusAposta(aposta.status)} | Jogo: \`${aposta.jogo}\` | Escolha: **${aposta.nomeEscolha || aposta.escolha}** | Valor: **${Number(aposta.valor).toFixed(2)}** | Odd: **${Number(aposta.odd).toFixed(2)}**\n`;
            } else {
                const selecoesTexto = Array.isArray(aposta.selecoes)
                    ? aposta.selecoes.map(s => `${s.jogo}: ${s.nomeEscolha}`).join(", ")
                    : "sem seleções";

                texto += `• **Múltipla** | ${formatarStatusAposta(aposta.status)} | Valor: **${Number(aposta.valor).toFixed(2)}** | Odd total: **${Number(aposta.oddTotal).toFixed(2)}**\n`;
                texto += `  Seleções: ${selecoesTexto}\n`;
            }
        }

        if (lista.length > 10) {
            texto += `• ... e mais **${lista.length - 10}** aposta(s)\n`;
        }

        texto += "\n";
    }

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

async function buscarMensagemPainel(userId) {
    const painel = paineisBilhete[userId];
    if (!painel) return null;

    try {
        const channel = await client.channels.fetch(painel.channelId);
        if (!channel || !channel.isTextBased()) return null;

        const message = await channel.messages.fetch(painel.messageId);
        return message;
    } catch {
        return null;
    }
}

async function atualizarOuCriarPainelBilhete(interaction, userId, extra = "", modo = "bilhete") {
    const conteudo = modo === "apostas"
        ? montarConteudoMinhasApostas(userId, extra)
        : montarConteudoBilhete(userId, extra);

    const components = [criarBotoesPainel(userId)];
    const mensagemExistente = await buscarMensagemPainel(userId);

    if (mensagemExistente) {
        await mensagemExistente.edit({
            content: conteudo,
            components,
            allowedMentions: { parse: [] }
        });
        return mensagemExistente;
    }

    const novaMensagem = await interaction.channel.send({
        content: conteudo,
        components,
        allowedMentions: { parse: [] }
    });

    paineisBilhete[userId] = {
        channelId: novaMensagem.channelId,
        messageId: novaMensagem.id
    };

    return novaMensagem;
}

async function removerPainelBilhete(userId) {
    const mensagem = await buscarMensagemPainel(userId);

    if (mensagem) {
        try {
            await mensagem.delete();
        } catch {}
    }

    delete paineisBilhete[userId];
}
async function buscarMensagemPainelStaff() {
    if (!painelStaffAtivo.channelId || !painelStaffAtivo.messageId) {
        return null;
    }

    try {
        const channel = await client.channels.fetch(painelStaffAtivo.channelId);
        if (!channel || !channel.isTextBased()) return null;

        const message = await channel.messages.fetch(painelStaffAtivo.messageId);
        return message;
    } catch {
        return null;
    }
}

async function atualizarOuCriarPainelStaff(interaction, extra = "") {
    const conteudo = montarConteudoPainelStaff(extra);
    const components = criarBotoesPainelStaff();

    const mensagemExistente = await buscarMensagemPainelStaff();

    if (mensagemExistente) {
        await mensagemExistente.edit({
            content: conteudo,
            components,
            allowedMentions: { parse: [] }
        });
        return mensagemExistente;
    }

    const novaMensagem = await interaction.channel.send({
        content: conteudo,
        components,
        allowedMentions: { parse: [] }
    });

    painelStaffAtivo.channelId = novaMensagem.channelId;
    painelStaffAtivo.messageId = novaMensagem.id;

    return novaMensagem;
}

async function processarFechamentoAutomaticoMercados() {
    const jogosFechados = fecharMercadosAutomaticamente(jogos);

    if (jogosFechados.length === 0) {
        return;
    }

    saveAll();

    for (const jogoId of jogosFechados) {
        try {
            await atualizarMensagemJogo(client, jogoId, jogos[jogoId]);
            console.log(`Mercado fechado automaticamente: ${jogoId}`);
        } catch (error) {
            console.error(`Erro ao fechar automaticamente o mercado ${jogoId}:`, error);
        }
    }
}

client.once("clientReady", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Database carregado de: ${DB_PATH}`);

    const clientId = client.user.id;
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

    try {
        console.log("Registering slash commands...");

        await rest.put(
            Routes.applicationCommands(clientId),
            {
                body: [
                    pingCommand.data.toJSON(),
                    saldoCommand.data.toJSON(),
                    apostaCommand.data.toJSON(),
                    apostarCommand.data.toJSON(),
                    criarApostaCommand.data.toJSON(),
                    fecharMercadoCommand.data.toJSON(),
                    resultadoJogoCommand.data.toJSON(),
                    rankingCommand.data.toJSON(),
                    rankingRodadaCommand.data.toJSON(),
                    resetarRodadaCommand.data.toJSON(),
                    verApostasCommand.data.toJSON(),
                    painelStaffCommand.data.toJSON()
                ]
            }
        );

        console.log("Slash commands registered.");
    } catch (error) {
        console.error(error);
    }

    await processarFechamentoAutomaticoMercados();

    setInterval(async () => {
        await processarFechamentoAutomaticoMercados();
    }, 60 * 1000);
});

client.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === pingCommand.data.name) {
            return pingCommand.execute(interaction);
        }

        if (interaction.commandName === saldoCommand.data.name) {
            return saldoCommand.execute(interaction, saldos, saveAll);
        }

        if (interaction.commandName === apostaCommand.data.name) {
            return apostaCommand.execute(interaction);
        }

        if (interaction.commandName === apostarCommand.data.name) {
            return apostarCommand.execute(
                interaction,
                saldos,
                jogos,
                apostasValores,
                historicoApostas,
                saveAll
            );
        }

        if (interaction.commandName === criarApostaCommand.data.name) {
            return criarApostaCommand.execute(interaction, jogos, saveAll);
        }

        if (interaction.commandName === fecharMercadoCommand.data.name) {
            return fecharMercadoCommand.execute(interaction, jogos, saveAll, client);
        }

        if (interaction.commandName === resultadoJogoCommand.data.name) {
            return resultadoJogoCommand.execute(
                interaction,
                jogos,
                multiplas,
                saldos,
                rodadaStats,
                apostasValores,
                historicoApostas,
                painelRodada,
                saveAll,
                client
            );
        }

        if (interaction.commandName === rankingCommand.data.name) {
            return rankingCommand.execute(interaction, saldos);
        }

        if (interaction.commandName === rankingRodadaCommand.data.name) {
            return rankingRodadaCommand.execute(interaction, rodadaStats);
        }

        if (interaction.commandName === resetarRodadaCommand.data.name) {
            return resetarRodadaCommand.execute(interaction, rodadaStats, saveAll);
        }

        if (interaction.commandName === verApostasCommand.data.name) {
            return verApostasCommand.execute(interaction, historicoApostas);
        }

        if (interaction.commandName === painelStaffCommand.data.name) {
            if (!temPermissaoStaff(interaction)) {
                return interaction.reply({
                    content: "❌ Você não tem permissão para usar o painel staff.",
                    ephemeral: true
                });
            }

            await interaction.reply({
                content: "✅ Painel staff enviado no canal.",
                ephemeral: true
            });

            await atualizarOuCriarPainelStaff(interaction);
            return;
        }
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith("bet|")) {
            const [tipo, jogo, escolha] = customId.split("|");

            if (tipo !== "bet") return;

            if (!jogos[jogo]) {
                return interaction.reply({
                    content: "❌ Esse jogo não existe mais.",
                    ephemeral: true
                });
            }

            if (!jogos[jogo].aberto) {
                return interaction.reply({
                    content: "❌ As apostas para esse jogo estão fechadas.",
                    ephemeral: true
                });
            }

            const userId = interaction.user.id;

            if (saldos[userId] == null) {
                saldos[userId] = 100;
            }

            if (!Array.isArray(carrinhos[userId])) {
                carrinhos[userId] = [];
            }

            const jaExisteNoBilhete = carrinhos[userId].some(item => item.jogo === jogo);

            if (jaExisteNoBilhete) {
                return interaction.reply({
                    content: "❌ Você já adicionou uma opção desse jogo no seu bilhete.",
                    ephemeral: true
                });
            }

            let odd = 1;
            let nomeEscolha = "";

            if (escolha === "time1") {
                odd = Number(jogos[jogo].odd1);
                nomeEscolha = jogos[jogo].time1;
            }

            if (escolha === "empate") {
                odd = Number(jogos[jogo].oddEmpate);
                nomeEscolha = "Empate";
            }

            if (escolha === "time2") {
                odd = Number(jogos[jogo].odd2);
                nomeEscolha = jogos[jogo].time2;
            }

            carrinhos[userId].push({
                jogo,
                escolha,
                odd,
                nomeEscolha
            });

            saveAll();

            await interaction.deferUpdate();
            await atualizarOuCriarPainelBilhete(interaction, userId, "✅ Bilhete atualizado.", "bilhete");
            return;
        }

        if (customId.startsWith("painel_")) {
            const [acao, ownerId] = customId.split("|");
            const userId = interaction.user.id;

            if (userId !== ownerId) {
                return interaction.reply({
                    content: "❌ Esse painel não é seu.",
                    ephemeral: true
                });
            }

            if (saldos[userId] == null) {
                saldos[userId] = 100;
                saveAll();
            }

            if (acao === "painel_saldo") {
                await interaction.deferUpdate();
                await atualizarOuCriarPainelBilhete(interaction, userId, "💰 Saldo atualizado.", "bilhete");
                return;
            }

            if (acao === "painel_bilhete") {
                await interaction.deferUpdate();
                await atualizarOuCriarPainelBilhete(interaction, userId, "", "bilhete");
                return;
            }

            if (acao === "painel_apostas") {
                await interaction.deferUpdate();
                await atualizarOuCriarPainelBilhete(interaction, userId, "📄 Histórico carregado.", "apostas");
                return;
            }

            if (acao === "painel_limpar") {
                carrinhos[userId] = [];
                saveAll();

                await interaction.deferUpdate();
                await atualizarOuCriarPainelBilhete(interaction, userId, "🗑️ Bilhete limpo.", "bilhete");
                return;
            }

            if (acao === "painel_fechar") {
                if (!Array.isArray(carrinhos[userId]) || carrinhos[userId].length === 0) {
                    return interaction.reply({
                        content: "❌ Seu bilhete está vazio.",
                        ephemeral: true
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`modal_fechar_multipla|${userId}`)
                    .setTitle("Fechar múltipla");

                const valorInput = new TextInputBuilder()
                    .setCustomId("valor")
                    .setLabel("Digite o valor da aposta")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: 10")
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(valorInput);
                modal.addComponents(row);

                return interaction.showModal(modal);
            }
        }
                if (customId.startsWith("staff_")) {
            if (!temPermissaoStaff(interaction)) {
                return interaction.reply({
                    content: "❌ Você não tem permissão para usar o painel staff.",
                    ephemeral: true
                });
            }

            if (customId === "staff_atualizar") {
                await interaction.deferUpdate();
                await atualizarOuCriarPainelStaff(interaction, "🔄 Painel atualizado.");
                return;
            }

            if (customId === "staff_ver_ranking") {
                return interaction.reply({
                    content: montarRankingGeralTexto(),
                    ephemeral: true
                });
            }

            if (customId === "staff_ver_apostas") {
                const texto = montarHistoricoCompletoTexto();
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

                return;
            }

            if (customId === "staff_adicionar_moedas") {
                const modal = new ModalBuilder()
                    .setCustomId("modal_staff_adicionar_moedas")
                    .setTitle("Adicionar moedas");

                const usuarioInput = new TextInputBuilder()
                    .setCustomId("usuario")
                    .setLabel("Mencione ou cole o ID do membro")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: @usuario ou 123456789...")
                    .setRequired(true);

                const valorInput = new TextInputBuilder()
                    .setCustomId("valor")
                    .setLabel("Quantidade de moedas")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: 100")
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(usuarioInput),
                    new ActionRowBuilder().addComponents(valorInput)
                );

                return interaction.showModal(modal);
            }

            if (customId === "staff_remover_moedas") {
                const modal = new ModalBuilder()
                    .setCustomId("modal_staff_remover_moedas")
                    .setTitle("Remover moedas");

                const usuarioInput = new TextInputBuilder()
                    .setCustomId("usuario")
                    .setLabel("Mencione ou cole o ID do membro")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: @usuario ou 123456789...")
                    .setRequired(true);

                const valorInput = new TextInputBuilder()
                    .setCustomId("valor")
                    .setLabel("Quantidade de moedas")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: 100")
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(usuarioInput),
                    new ActionRowBuilder().addComponents(valorInput)
                );

                return interaction.showModal(modal);
            }

            if (customId === "staff_ver_saldo_membro") {
                const modal = new ModalBuilder()
                    .setCustomId("modal_staff_ver_saldo")
                    .setTitle("Ver saldo de membro");

                const usuarioInput = new TextInputBuilder()
                    .setCustomId("usuario")
                    .setLabel("Mencione ou cole o ID do membro")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: @usuario ou 123456789...")
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(usuarioInput)
                );

                return interaction.showModal(modal);
            }

            if (customId === "staff_excluir_jogo") {
                const modal = new ModalBuilder()
                    .setCustomId("modal_staff_excluir_jogo")
                    .setTitle("Excluir jogo");

                const jogoInput = new TextInputBuilder()
                    .setCustomId("jogo")
                    .setLabel("Digite o ID do jogo")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: vasco_corinthians")
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(jogoInput)
                );

                return interaction.showModal(modal);
            }

            if (customId === "staff_resetar_rodada") {
                for (const userId of Object.keys(rodadaStats)) {
                    delete rodadaStats[userId];
                }

                painelRodada.channelId = null;
                painelRodada.messageId = null;

                saveAll();

                await interaction.deferUpdate();
                await atualizarOuCriarPainelStaff(interaction, "🗑️ Ranking da rodada resetado com sucesso.");
                return;
            }
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("modal_fechar_multipla|")) {
            const [, ownerId] = interaction.customId.split("|");
            const userId = interaction.user.id;

            if (userId !== ownerId) {
                return interaction.reply({
                    content: "❌ Esse bilhete não é seu.",
                    ephemeral: true
                });
            }

            if (saldos[userId] == null) {
                saldos[userId] = 100;
            }

            if (!Array.isArray(carrinhos[userId]) || carrinhos[userId].length === 0) {
                return interaction.reply({
                    content: "❌ Seu bilhete está vazio.",
                    ephemeral: true
                });
            }

            const valorTexto = interaction.fields.getTextInputValue("valor");
            const valor = parseFloat(valorTexto.replace(",", "."));

            if (Number.isNaN(valor) || valor <= 0) {
                return interaction.reply({
                    content: "❌ Digite um valor válido maior que 0.",
                    ephemeral: true
                });
            }

            if (Number(saldos[userId]) < valor) {
                return interaction.reply({
                    content: `❌ Você não tem saldo suficiente. Seu saldo atual é **${Number(saldos[userId]).toFixed(2)} moedas**.`,
                    ephemeral: true
                });
            }

            let oddTotal = 1;

            for (const selecao of carrinhos[userId]) {
                oddTotal *= Number(selecao.odd);
            }

            const retornoPossivel = valor * oddTotal;
            const idAposta = gerarIdAposta();

            saldos[userId] = Number(saldos[userId]) - valor;

            multiplas[userId] = {
                idAposta,
                valor: Number(valor),
                oddTotal: Number(oddTotal),
                retornoPossivel: Number(retornoPossivel),
                selecoes: carrinhos[userId].map(item => ({
                    jogo: item.jogo,
                    escolha: item.escolha,
                    odd: Number(item.odd),
                    nomeEscolha: item.nomeEscolha
                })),
                resolvida: false
            };

            if (!Array.isArray(historicoApostas[userId])) {
                historicoApostas[userId] = [];
            }

            historicoApostas[userId].push({
                idAposta,
                tipo: "multipla",
                valor: Number(valor),
                oddTotal: Number(oddTotal),
                retornoPossivel: Number(retornoPossivel),
                selecoes: carrinhos[userId].map(item => ({
                    jogo: item.jogo,
                    escolha: item.escolha,
                    odd: Number(item.odd),
                    nomeEscolha: item.nomeEscolha
                })),
                status: "ativa",
                criadaEm: new Date().toISOString()
            });

            const lista = carrinhos[userId]
                .map(item => `🎯 **${item.jogo}** → **${item.nomeEscolha}** (${Number(item.odd).toFixed(2)})`)
                .join("\n");

            carrinhos[userId] = [];

            saveAll();
            await removerPainelBilhete(userId);

            return interaction.reply({
                content:
`✅ **Múltipla registrada!**

${lista}

💰 Valor apostado: **${valor.toFixed(2)} moedas**
📈 Odd total: **${oddTotal.toFixed(2)}**
💸 Retorno possível: **${retornoPossivel.toFixed(2)} moedas**
💳 Saldo restante: **${Number(saldos[userId]).toFixed(2)} moedas**`,
                ephemeral: true
            });
        }

        if (interaction.customId === "modal_staff_adicionar_moedas") {
            if (!temPermissaoStaff(interaction)) {
                return interaction.reply({
                    content: "❌ Você não tem permissão para isso.",
                    ephemeral: true
                });
            }

            const usuarioTexto = interaction.fields.getTextInputValue("usuario");
            const valorTexto = interaction.fields.getTextInputValue("valor");

            const userId = extrairUserId(usuarioTexto);
            const valor = parseFloat(valorTexto.replace(",", "."));

            if (!userId) {
                return interaction.reply({
                    content: "❌ Não consegui identificar o usuário. Use menção ou ID.",
                    ephemeral: true
                });
            }

            if (Number.isNaN(valor) || valor <= 0) {
                return interaction.reply({
                    content: "❌ Digite um valor válido maior que 0.",
                    ephemeral: true
                });
            }

            if (saldos[userId] == null) {
                saldos[userId] = 100;
            }

            saldos[userId] = Number(saldos[userId]) + Number(valor);
            saveAll();

            return interaction.reply({
                content: `✅ Foram adicionadas **${Number(valor).toFixed(2)} moedas** para <@${userId}>.\n💰 Novo saldo: **${Number(saldos[userId]).toFixed(2)} moedas**`,
                ephemeral: true
            });
        }

        if (interaction.customId === "modal_staff_remover_moedas") {
            if (!temPermissaoStaff(interaction)) {
                return interaction.reply({
                    content: "❌ Você não tem permissão para isso.",
                    ephemeral: true
                });
            }

            const usuarioTexto = interaction.fields.getTextInputValue("usuario");
            const valorTexto = interaction.fields.getTextInputValue("valor");

            const userId = extrairUserId(usuarioTexto);
            const valor = parseFloat(valorTexto.replace(",", "."));

            if (!userId) {
                return interaction.reply({
                    content: "❌ Não consegui identificar o usuário. Use menção ou ID.",
                    ephemeral: true
                });
            }

            if (Number.isNaN(valor) || valor <= 0) {
                return interaction.reply({
                    content: "❌ Digite um valor válido maior que 0.",
                    ephemeral: true
                });
            }

            if (saldos[userId] == null) {
                saldos[userId] = 100;
            }

            if (Number(saldos[userId]) < valor) {
                return interaction.reply({
                    content: `❌ Esse membro não tem moedas suficientes para essa remoção.\n💰 Saldo atual: **${Number(saldos[userId]).toFixed(2)} moedas**`,
                    ephemeral: true
                });
            }

            saldos[userId] = Number(saldos[userId]) - Number(valor);
            saveAll();

            return interaction.reply({
                content: `✅ Foram removidas **${Number(valor).toFixed(2)} moedas** de <@${userId}>.\n💰 Novo saldo: **${Number(saldos[userId]).toFixed(2)} moedas**`,
                ephemeral: true
            });
        }

        if (interaction.customId === "modal_staff_ver_saldo") {
            if (!temPermissaoStaff(interaction)) {
                return interaction.reply({
                    content: "❌ Você não tem permissão para isso.",
                    ephemeral: true
                });
            }

            const usuarioTexto = interaction.fields.getTextInputValue("usuario");
            const userId = extrairUserId(usuarioTexto);

            if (!userId) {
                return interaction.reply({
                    content: "❌ Não consegui identificar o usuário. Use menção ou ID.",
                    ephemeral: true
                });
            }

            const saldo = Number(saldos[userId] ?? 100);

            return interaction.reply({
                content: `👤 Saldo de <@${userId}>: **${saldo.toFixed(2)} moedas**`,
                ephemeral: true
            });
        }

        if (interaction.customId === "modal_staff_excluir_jogo") {
            if (!temPermissaoStaff(interaction)) {
                return interaction.reply({
                    content: "❌ Você não tem permissão para isso.",
                    ephemeral: true
                });
            }

            const jogo = interaction.fields.getTextInputValue("jogo").trim().toLowerCase();

            if (!jogos[jogo]) {
                return interaction.reply({
                    content: `❌ O jogo \`${jogo}\` não existe.`,
                    ephemeral: true
                });
            }

            if (apostasValores[jogo] && Object.keys(apostasValores[jogo]).length > 0) {
                return interaction.reply({
                    content: "❌ Não é possível excluir esse jogo porque já existem apostas simples vinculadas a ele.",
                    ephemeral: true
                });
            }

            const existeEmCarrinho = Object.values(carrinhos).some(lista =>
                Array.isArray(lista) && lista.some(item => item.jogo === jogo)
            );

            if (existeEmCarrinho) {
                return interaction.reply({
                    content: "❌ Não é possível excluir esse jogo porque ele está no bilhete de algum membro.",
                    ephemeral: true
                });
            }

            const existeEmMultipla = Object.values(multiplas).some(multipla =>
                multipla &&
                Array.isArray(multipla.selecoes) &&
                multipla.selecoes.some(item => item.jogo === jogo)
            );

            if (existeEmMultipla) {
                return interaction.reply({
                    content: "❌ Não é possível excluir esse jogo porque já existe múltipla vinculada a ele.",
                    ephemeral: true
                });
            }

            delete jogos[jogo];
            saveAll();

            return interaction.reply({
                content: `✅ O jogo \`${jogo}\` foi excluído com sucesso.`,
                ephemeral: true
            });
        }
    }
});

if (!process.env.TOKEN) {
    console.error("Erro: TOKEN não definido.");
    process.exit(1);
}

client.login(process.env.TOKEN);

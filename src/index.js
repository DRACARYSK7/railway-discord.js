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
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const { loadDatabase, saveDatabase, DB_PATH } = require("./storage");
const {
    fecharMercadosAutomaticamente,
    atualizarMensagemJogo
} = require("./utils/jogos-utils");

const pingCommand = require("./commands/ping.js");
const saldoCommand = require("./commands/saldo.js");
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
const multiplas = Array.isArray(database.multiplas) ? database.multiplas : [];
const rodadaStats = database.rodadaStats || {};
const apostasValores = database.apostasValores || {};
const historicoApostas = database.historicoApostas || {};
const painelRodada = database.painelRodada || {
    channelId: null,
    messageId: null
};

const slashCommands = [
    pingCommand,
    saldoCommand,
    apostarCommand,
    criarApostaCommand,
    fecharMercadoCommand,
    resultadoJogoCommand,
    rankingCommand,
    rankingRodadaCommand,
    resetarRodadaCommand,
    verApostasCommand,
    painelStaffCommand
];

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

function garantirUsuario(userId) {
    let alterou = false;

    if (saldos[userId] == null) {
        saldos[userId] = 100;
        alterou = true;
    }

    if (!Array.isArray(carrinhos[userId])) {
        carrinhos[userId] = [];
        alterou = true;
    }

    if (alterou) {
        saveAll();
    }
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

function formatarOdd(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero.toFixed(2) : "0.00";
}

function limitarTexto(texto, limite = 40) {
    const valor = String(texto || "").trim();
    if (valor.length <= limite) return valor;
    return `${valor.slice(0, limite - 3)}...`;
}

function gerarSiglaTime(nome) {
    const texto = String(nome || "").trim();
    if (!texto) return "TIME";

    const partes = texto
        .split(/[\s/-]+/)
        .map(parte => parte.replace(/[^A-Za-zÀ-ÿ0-9]/g, ""))
        .filter(Boolean);

    if (partes.length >= 2) {
        return partes.map(parte => parte[0]).join("").toUpperCase().slice(0, 4);
    }

    const nomeLimpo = (partes[0] || texto).replace(/[^A-Za-zÀ-ÿ0-9]/g, "");
    return nomeLimpo.slice(0, 3).toUpperCase();
}

function montarLabelBotaoTime(nome, odd, limiteTotal = 12) {
    const oddTexto = ` (${formatarOdd(odd)})`;
    const nomeCompleto = String(nome || "").trim().toUpperCase();
    const labelCompleta = `${nomeCompleto}${oddTexto}`;

    if (labelCompleta.length <= limiteTotal) {
        return labelCompleta;
    }

    const sigla = gerarSiglaTime(nome);
    const labelSigla = `${sigla}${oddTexto}`;

    if (labelSigla.length <= limiteTotal) {
        return labelSigla;
    }

    const espacoNome = Math.max(1, limiteTotal - oddTexto.length);
    return `${sigla.slice(0, espacoNome)}${oddTexto}`;
}

function montarLabelBotaoEmpate(odd) {
    return `X (${formatarOdd(odd)})`;
}

function formatarDataPainelBR(data) {
    if (!data) return "";

    const texto = String(data).trim();
    const partes = texto.split("-");

    if (partes.length !== 3) {
        return texto;
    }

    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
}

function obterDataJogo(jogo) {
    return jogo?.dataJogo || jogo?.data || "";
}

function obterHorarioJogo(jogo) {
    return jogo?.horarioJogo || jogo?.hora || "";
}

function obterSelecaoDoJogo(jogo, escolha) {
    if (escolha === "time1") {
        return {
            odd: Number(jogo.odd1),
            nomeEscolha: jogo.time1
        };
    }

    if (escolha === "empate") {
        return {
            odd: Number(jogo.oddEmpate),
            nomeEscolha: "Empate"
        };
    }

    return {
        odd: Number(jogo.odd2),
        nomeEscolha: jogo.time2
    };
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
            .setLabel("Concluir aposta")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId(`painel_limpar|${userId}`)
            .setLabel("Limpar bilhete")
            .setStyle(ButtonStyle.Danger)
    );
}

function criarBotoesPainelStaff() {
    return [
        new ActionRowBuilder().addComponents(
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
        ),

        new ActionRowBuilder().addComponents(
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
        ),

        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("staff_excluir_jogo")
                .setLabel("Excluir jogo")
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId("staff_postar_painel_aposta")
                .setLabel("Postar painel de aposta")
                .setStyle(ButtonStyle.Success)
        )
    ];
}

function obterJogosDisponiveisParaPainel() {
    return Object.entries(jogos).filter(([, jogo]) => {
        return jogo && jogo.aberto && !jogo.resultado;
    });
}

function normalizarIndicePainel(indice, total) {
    if (total <= 0) return 0;

    const numero = Number(indice);
    if (!Number.isFinite(numero)) return 0;
    if (numero < 0) return total - 1;
    if (numero >= total) return 0;
    return numero;
}

function obterIndiceJogoNoPainel(jogoId) {
    return obterJogosDisponiveisParaPainel().findIndex(([id]) => id === jogoId);
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
            extra || ""
        ].filter(Boolean).join("\n");
    }

    const lista = itens
        .map(item => `🎯 **${item.jogo}** → **${item.nomeEscolha}** (${formatarOdd(item.odd)})`)
        .join("\n");

    const oddParcial = itens.reduce((acc, item) => acc * Number(item.odd), 1);

    return [
        `🧾 **Bilhete de <@${userId}>**`,
        "",
        lista,
        "",
        `📈 Odd parcial: **${oddParcial.toFixed(2)}**`,
        `💰 Saldo: **${saldo.toFixed(2)} moedas**`,
        extra || ""
    ].filter(Boolean).join("\n");
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
            extra || ""
        ].filter(Boolean).join("\n");
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
        extra || ""
    ].filter(Boolean).join("\n");
}

function contarApostasSimplesAtivas() {
    return Object.values(apostasValores).reduce((acc, apostasDoJogo) => {
        return acc + (Array.isArray(apostasDoJogo) ? apostasDoJogo.length : 0);
    }, 0);
}

function somarApostasSimplesAtivas() {
    return Object.values(apostasValores).reduce((acc, apostasDoJogo) => {
        if (!Array.isArray(apostasDoJogo)) return acc;
        return acc + apostasDoJogo.reduce((sub, aposta) => sub + Number(aposta?.valor || 0), 0);
    }, 0);
}

function contarMultiplasAtivas() {
    return multiplas.filter(multipla => multipla && !multipla.resolvida).length;
}

function somarMultiplasAtivas() {
    return multiplas.reduce((acc, multipla) => {
        if (!multipla || multipla.resolvida) return acc;
        return acc + Number(multipla.valor || 0);
    }, 0);
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
        extra || ""
    ].filter(Boolean).join("\n");
}

function montarRankingGeralTexto() {
    const ranking = Object.entries(saldos)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 10);

    if (ranking.length === 0) {
        return "❌ Ainda não há jogadores no ranking de moedas.";
    }

    return [
        "🏆 **RANKING GERAL DE MOEDAS**",
        "",
        ...ranking.map(([userId, saldo], index) => `${index + 1}. <@${userId}> — **${Number(saldo).toFixed(2)} moedas**`)
    ].join("\n");
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
                continue;
            }

            const selecoesTexto = Array.isArray(aposta.selecoes)
                ? aposta.selecoes.map(s => `${s.jogo}: ${s.nomeEscolha}`).join(", ")
                : "sem seleções";

            texto += `• **Múltipla** | ${formatarStatusAposta(aposta.status)} | Valor: **${Number(aposta.valor).toFixed(2)}** | Odd total: **${Number(aposta.oddTotal).toFixed(2)}**\n`;
            texto += `  Seleções: ${selecoesTexto}\n`;
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

function montarConteudoPainelAposta(userId, indice, extra = "") {
    const jogosDisponiveis = obterJogosDisponiveisParaPainel();
    const saldo = Number(saldos[userId] ?? 100);
    const itensBilhete = Array.isArray(carrinhos[userId]) ? carrinhos[userId].length : 0;

    if (jogosDisponiveis.length === 0) {
        return [
            "🎟️ **PAINEL DE APOSTA**",
            "",
            "❌ Nenhum jogo disponível no momento.",
            "",
            `💰 Saldo: **${saldo.toFixed(2)} moedas**`,
            `🧾 Itens no bilhete: **${itensBilhete}**`,
            extra || ""
        ].filter(Boolean).join("\n");
    }

    const indiceAtual = normalizarIndicePainel(indice, jogosDisponiveis.length);
    const [jogoId, jogo] = jogosDisponiveis[indiceAtual];
    const dataJogo = formatarDataPainelBR(obterDataJogo(jogo));
    const horarioJogo = obterHorarioJogo(jogo);

    return [
        "🎟️ **PAINEL DE APOSTA**",
        "",
        `📍 Jogo **${indiceAtual + 1}/${jogosDisponiveis.length}**`,
        `🆔 ID: \`${jogoId}\``,
        `⚽ Partida: **${jogo.time1} x ${jogo.time2}**`,
        dataJogo ? `📅 Data: **${dataJogo}**` : "",
        horarioJogo ? `🕒 Hora: **${horarioJogo}**` : "",
        `💰 Saldo: **${saldo.toFixed(2)} moedas**`,
        `🧾 Itens no bilhete: **${itensBilhete}**`,
        extra || ""
    ].filter(Boolean).join("\n");
}

function criarBotoesPainelAposta(userId, indice) {
    const jogosDisponiveis = obterJogosDisponiveisParaPainel();

    if (jogosDisponiveis.length === 0) {
        return [criarBotoesPainel(userId)];
    }

    const indiceAtual = normalizarIndicePainel(indice, jogosDisponiveis.length);
    const [jogoId, jogo] = jogosDisponiveis[indiceAtual];

    const labelTime1 = montarLabelBotaoTime(jogo.time1, jogo.odd1, 12);
    const labelEmpate = montarLabelBotaoEmpate(jogo.oddEmpate);
    const labelTime2 = montarLabelBotaoTime(jogo.time2, jogo.odd2, 12);

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`mercado_apostar|${userId}|${jogoId}|time1`)
                .setLabel(labelTime1)
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(`mercado_apostar|${userId}|${jogoId}|empate`)
                .setLabel(labelEmpate)
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId(`mercado_apostar|${userId}|${jogoId}|time2`)
                .setLabel(labelTime2)
                .setStyle(ButtonStyle.Danger)
        ),

        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`mercado_nav|${userId}|${indiceAtual - 1}`)
                .setLabel("⬅️ Anterior")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(jogosDisponiveis.length <= 1),

            new ButtonBuilder()
                .setCustomId(`mercado_indicador|${userId}|${indiceAtual}`)
                .setLabel(`${indiceAtual + 1}/${jogosDisponiveis.length}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),

            new ButtonBuilder()
                .setCustomId(`mercado_nav|${userId}|${indiceAtual + 1}`)
                .setLabel("Próximo ➡️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(jogosDisponiveis.length <= 1)
        ),

        criarBotoesPainel(userId)
    ];
}

async function responderPainelAposta(interaction, userId, indice = 0, extra = "") {
    const payload = {
        content: montarConteudoPainelAposta(userId, indice, extra),
        components: criarBotoesPainelAposta(userId, indice),
        allowedMentions: { parse: [] }
    };

    if (interaction.isButton() && interaction.customId === "abrir_painel_aposta_publico") {
        return interaction.reply({ ...payload, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith("mercado_")) {
        return interaction.update(payload);
    }

    if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ ...payload, ephemeral: true });
    }

    return interaction.reply({ ...payload, ephemeral: true });
}

async function atualizarOuCriarPainelBilhete(interaction, userId, extra = "", modo = "bilhete") {
    const payload = {
        content: modo === "apostas"
            ? montarConteudoMinhasApostas(userId, extra)
            : montarConteudoBilhete(userId, extra),
        components: [criarBotoesPainel(userId)],
        allowedMentions: { parse: [] },
        ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
        return interaction.followUp(payload);
    }

    return interaction.reply(payload);
}

async function atualizarOuCriarPainelStaff(interaction, extra = "") {
    const payload = {
        content: montarConteudoPainelStaff(extra),
        components: criarBotoesPainelStaff(),
        allowedMentions: { parse: [] },
        ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
        return interaction.followUp(payload);
    }

    return interaction.reply(payload);
}

async function processarFechamentoAutomaticoMercados() {
    const jogosFechados = fecharMercadosAutomaticamente(jogos);
    if (jogosFechados.length === 0) return;

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

async function registrarComandos(rest, clientId) {
    const body = slashCommands.map(command => command.data.toJSON());

    console.log("Limpando comandos globais antigos...");
    await rest.put(Routes.applicationCommands(clientId), { body: [] });

    console.log("Limpando comandos antigos do servidor...");
    await rest.put(
        Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
        { body: [] }
    );

    console.log("Registrando comandos do servidor...");
    await rest.put(
        Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
        { body }
    );
}

client.once("clientReady", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Database carregado de: ${DB_PATH}`);

    const clientId = client.user.id;
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

    try {
        await registrarComandos(rest, clientId);
        console.log("Slash commands registrados com sucesso.");
    } catch (error) {
        console.error("Erro ao registrar comandos:", error);
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

            return atualizarOuCriarPainelStaff(interaction);
        }
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId === "abrir_painel_aposta_publico") {
            const userId = interaction.user.id;
            garantirUsuario(userId);
            return responderPainelAposta(interaction, userId, 0);
        }

        if (customId.startsWith("mercado_nav|")) {
            const [, ownerId, indiceTexto] = customId.split("|");
            const userId = interaction.user.id;

            if (userId !== ownerId) {
                return interaction.reply({
                    content: "❌ Esse painel não é seu.",
                    ephemeral: true
                });
            }

            return responderPainelAposta(interaction, userId, Number(indiceTexto));
        }

        if (customId.startsWith("mercado_apostar|")) {
            const [, ownerId, jogoId, escolha] = customId.split("|");
            const userId = interaction.user.id;

            if (userId !== ownerId) {
                return interaction.reply({
                    content: "❌ Esse painel não é seu.",
                    ephemeral: true
                });
            }

            if (!jogos[jogoId] || !jogos[jogoId].aberto || jogos[jogoId].resultado) {
                return responderPainelAposta(
                    interaction,
                    userId,
                    0,
                    "❌ Esse jogo saiu do painel porque o mercado foi fechado."
                );
            }

            garantirUsuario(userId);

            const jaExisteNoBilhete = carrinhos[userId].some(item => item.jogo === jogoId);
            if (jaExisteNoBilhete) {
                const indiceJogo = obterIndiceJogoNoPainel(jogoId);
                return responderPainelAposta(
                    interaction,
                    userId,
                    indiceJogo >= 0 ? indiceJogo : 0,
                    "❌ Você já adicionou uma opção desse jogo no seu bilhete."
                );
            }

            const selecao = obterSelecaoDoJogo(jogos[jogoId], escolha);
            carrinhos[userId].push({
                jogo: jogoId,
                escolha,
                odd: selecao.odd,
                nomeEscolha: selecao.nomeEscolha
            });
            saveAll();

            const indiceJogo = obterIndiceJogoNoPainel(jogoId);
            return responderPainelAposta(
                interaction,
                userId,
                indiceJogo >= 0 ? indiceJogo : 0,
                "✅ Seleção adicionada ao bilhete."
            );
        }

        if (customId.startsWith("bet|")) {
            const [, jogoId, escolha] = customId.split("|");

            if (!jogos[jogoId]) {
                return interaction.reply({
                    content: "❌ Esse jogo não existe mais.",
                    ephemeral: true
                });
            }

            if (!jogos[jogoId].aberto) {
                return interaction.reply({
                    content: "❌ As apostas para esse jogo estão fechadas.",
                    ephemeral: true
                });
            }

            const userId = interaction.user.id;
            garantirUsuario(userId);

            const jaExisteNoBilhete = carrinhos[userId].some(item => item.jogo === jogoId);
            if (jaExisteNoBilhete) {
                return interaction.reply({
                    content: "❌ Você já adicionou uma opção desse jogo no seu bilhete.",
                    ephemeral: true
                });
            }

            const selecao = obterSelecaoDoJogo(jogos[jogoId], escolha);
            carrinhos[userId].push({
                jogo: jogoId,
                escolha,
                odd: selecao.odd,
                nomeEscolha: selecao.nomeEscolha
            });
            saveAll();

            return atualizarOuCriarPainelBilhete(interaction, userId, "✅ Bilhete atualizado.", "bilhete");
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

            garantirUsuario(userId);

            if (acao === "painel_saldo") {
                return atualizarOuCriarPainelBilhete(interaction, userId, "💰 Saldo atualizado.", "bilhete");
            }

            if (acao === "painel_bilhete") {
                return atualizarOuCriarPainelBilhete(interaction, userId, "", "bilhete");
            }

            if (acao === "painel_apostas") {
                return atualizarOuCriarPainelBilhete(interaction, userId, "📄 Histórico carregado.", "apostas");
            }

            if (acao === "painel_limpar") {
                carrinhos[userId] = [];
                saveAll();

                return atualizarOuCriarPainelBilhete(interaction, userId, "🗑️ Bilhete limpo.", "bilhete");
            }

            if (acao === "painel_fechar") {
                if (carrinhos[userId].length === 0) {
                    return interaction.reply({
                        content: "❌ Seu bilhete está vazio.",
                        ephemeral: true
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`modal_concluir_aposta|${userId}`)
                    .setTitle("Concluir aposta")
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("valor")
                                .setLabel("Digite o valor da aposta")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder("Ex: 10")
                                .setRequired(true)
                        )
                    );

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
                return atualizarOuCriarPainelStaff(interaction, "🔄 Painel atualizado.");
            }

            if (customId === "staff_ver_ranking") {
                return interaction.reply({
                    content: montarRankingGeralTexto(),
                    ephemeral: true
                });
            }

            if (customId === "staff_ver_apostas") {
                const blocos = dividirEmBlocos(montarHistoricoCompletoTexto());

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

            if (customId === "staff_postar_painel_aposta") {
                const embed = new EmbedBuilder()
                    .setTitle("🎟️ PAINEL DE APOSTA")
                    .setDescription("Clique no botão abaixo para abrir o painel privado da rodada.")
                    .setFooter({ text: "BetPRL • Paraisópolis" });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("abrir_painel_aposta_publico")
                        .setLabel("Abrir painel de aposta")
                        .setStyle(ButtonStyle.Success)
                );

                await interaction.channel.send({
                    embeds: [embed],
                    components: [row]
                });

                return atualizarOuCriarPainelStaff(interaction, "✅ Painel de aposta postado no canal.");
            }

            if (customId === "staff_adicionar_moedas" || customId === "staff_remover_moedas") {
                const adicionando = customId === "staff_adicionar_moedas";
                const modal = new ModalBuilder()
                    .setCustomId(adicionando ? "modal_staff_adicionar_moedas" : "modal_staff_remover_moedas")
                    .setTitle(adicionando ? "Adicionar moedas" : "Remover moedas")
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("usuario")
                                .setLabel("Mencione ou cole o ID do membro")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder("Ex: @usuario ou 123456789...")
                                .setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("valor")
                                .setLabel("Quantidade de moedas")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder("Ex: 100")
                                .setRequired(true)
                        )
                    );

                return interaction.showModal(modal);
            }

            if (customId === "staff_ver_saldo_membro") {
                const modal = new ModalBuilder()
                    .setCustomId("modal_staff_ver_saldo")
                    .setTitle("Ver saldo de membro")
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("usuario")
                                .setLabel("Mencione ou cole o ID do membro")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder("Ex: @usuario ou 123456789...")
                                .setRequired(true)
                        )
                    );

                return interaction.showModal(modal);
            }

            if (customId === "staff_excluir_jogo") {
                const modal = new ModalBuilder()
                    .setCustomId("modal_staff_excluir_jogo")
                    .setTitle("Excluir jogo")
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("jogo")
                                .setLabel("Digite o ID do jogo")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder("Ex: vasco_corinthians")
                                .setRequired(true)
                        )
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

                return atualizarOuCriarPainelStaff(interaction, "🗑️ Ranking da rodada resetado com sucesso.");
            }
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("modal_concluir_aposta|")) {
            const [, ownerId] = interaction.customId.split("|");
            const userId = interaction.user.id;

            if (userId !== ownerId) {
                return interaction.reply({
                    content: "❌ Esse bilhete não é seu.",
                    ephemeral: true
                });
            }

            garantirUsuario(userId);

            if (carrinhos[userId].length === 0) {
                return interaction.reply({
                    content: "❌ Seu bilhete está vazio.",
                    ephemeral: true
                });
            }

            const selecoesInvalidas = carrinhos[userId].filter(item => {
                const jogo = jogos[item.jogo];
                return !jogo || !jogo.aberto || jogo.resultado;
            });

            if (selecoesInvalidas.length > 0) {
                const jogosInvalidos = selecoesInvalidas.map(item => `• \`${item.jogo}\``).join("\n");
                return interaction.reply({
                    content:
`❌ Não foi possível concluir essa aposta porque há jogo(s) indisponível(is) no bilhete:

${jogosInvalidos}

Use **Limpar bilhete** e monte novamente com mercados abertos.`,
                    ephemeral: true
                });
            }

            const valor = parseFloat(interaction.fields.getTextInputValue("valor").replace(",", "."));
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

            const oddTotal = carrinhos[userId].reduce((acc, selecao) => acc * Number(selecao.odd), 1);
            const retornoPossivel = valor * oddTotal;
            const idAposta = gerarIdAposta();
            const selecoes = carrinhos[userId].map(item => ({
                jogo: item.jogo,
                escolha: item.escolha,
                odd: Number(item.odd),
                nomeEscolha: item.nomeEscolha
            }));

            saldos[userId] = Number(saldos[userId]) - valor;

            multiplas.push({
                idAposta,
                userId,
                valor: Number(valor),
                oddTotal: Number(oddTotal),
                retornoPossivel: Number(retornoPossivel),
                selecoes,
                resolvida: false,
                criadaEm: new Date().toISOString()
            });

            if (!Array.isArray(historicoApostas[userId])) {
                historicoApostas[userId] = [];
            }

            historicoApostas[userId].push({
                idAposta,
                tipo: "multipla",
                valor: Number(valor),
                oddTotal: Number(oddTotal),
                retornoPossivel: Number(retornoPossivel),
                selecoes,
                status: "ativa",
                criadaEm: new Date().toISOString()
            });

            const lista = selecoes
                .map(item => `🎯 **${item.jogo}** → **${item.nomeEscolha}** (${formatarOdd(item.odd)})`)
                .join("\n");

            saveAll();

            await interaction.reply({
                content:
`✅ **Aposta concluída com sucesso!**

${lista}

💰 Valor apostado: **${valor.toFixed(2)} moedas**
📈 Odd total: **${oddTotal.toFixed(2)}**
💸 Retorno possível: **${retornoPossivel.toFixed(2)} moedas**
💳 Saldo restante: **${Number(saldos[userId]).toFixed(2)} moedas**`,
                ephemeral: true
            });

            await atualizarOuCriarPainelBilhete(
                interaction,
                userId,
                "✅ Aposta concluída. Você pode manter esse mesmo bilhete ou limpar para montar outro.",
                "bilhete"
            );
            return;
        }

        if (interaction.customId === "modal_staff_adicionar_moedas" || interaction.customId === "modal_staff_remover_moedas") {
            if (!temPermissaoStaff(interaction)) {
                return interaction.reply({
                    content: "❌ Você não tem permissão para isso.",
                    ephemeral: true
                });
            }

            const userId = extrairUserId(interaction.fields.getTextInputValue("usuario"));
            const valor = parseFloat(interaction.fields.getTextInputValue("valor").replace(",", "."));
            const adicionando = interaction.customId === "modal_staff_adicionar_moedas";

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

            garantirUsuario(userId);

            if (!adicionando && Number(saldos[userId]) < valor) {
                return interaction.reply({
                    content: `❌ Esse membro não tem moedas suficientes para essa remoção.\n💰 Saldo atual: **${Number(saldos[userId]).toFixed(2)} moedas**`,
                    ephemeral: true
                });
            }

            saldos[userId] = adicionando
                ? Number(saldos[userId]) + Number(valor)
                : Number(saldos[userId]) - Number(valor);

            saveAll();

            return interaction.reply({
                content: adicionando
                    ? `✅ Foram adicionadas **${Number(valor).toFixed(2)} moedas** para <@${userId}>.\n💰 Novo saldo: **${Number(saldos[userId]).toFixed(2)} moedas**`
                    : `✅ Foram removidas **${Number(valor).toFixed(2)} moedas** de <@${userId}>.\n💰 Novo saldo: **${Number(saldos[userId]).toFixed(2)} moedas**`,
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

            const userId = extrairUserId(interaction.fields.getTextInputValue("usuario"));
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

            const jogoId = interaction.fields.getTextInputValue("jogo").trim().toLowerCase();

            if (!jogos[jogoId]) {
                return interaction.reply({
                    content: `❌ O jogo \`${jogoId}\` não existe.`,
                    ephemeral: true
                });
            }

            if (Array.isArray(apostasValores[jogoId]) && apostasValores[jogoId].length > 0) {
                return interaction.reply({
                    content: "❌ Não é possível excluir esse jogo porque já existem apostas simples vinculadas a ele.",
                    ephemeral: true
                });
            }

            const existeEmCarrinho = Object.values(carrinhos).some(lista =>
                Array.isArray(lista) && lista.some(item => item.jogo === jogoId)
            );

            if (existeEmCarrinho) {
                return interaction.reply({
                    content: "❌ Não é possível excluir esse jogo porque ele está no bilhete de algum membro.",
                    ephemeral: true
                });
            }

            const existeEmMultipla = multiplas.some(multipla =>
                multipla &&
                Array.isArray(multipla.selecoes) &&
                multipla.selecoes.some(item => item.jogo === jogoId)
            );

            if (existeEmMultipla) {
                return interaction.reply({
                    content: "❌ Não é possível excluir esse jogo porque já existe múltipla vinculada a ele.",
                    ephemeral: true
                });
            }

            delete jogos[jogoId];
            saveAll();

            return interaction.reply({
                content: `✅ O jogo \`${jogoId}\` foi excluído com sucesso.`,
                ephemeral: true
            });
        }
    }
});

if (!process.env.TOKEN) {
    console.error("Erro: TOKEN não definido.");
    process.exit(1);
}

if (!process.env.GUILD_ID) {
    console.error("Erro: GUILD_ID não definido.");
    process.exit(1);
}

client.login(process.env.TOKEN);

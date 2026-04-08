const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "database.json");

const DEFAULT_DB = {
    saldos: {},
    jogos: {},
    carrinhos: {},
    multiplas: [],
    rodadaStats: {},
    apostasValores: {},
    historicoApostas: {},
    painelRodada: {
        channelId: null,
        messageId: null
    }
};

function cloneDefaultDb() {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
}

function normalizarApostaSimplesAtiva(aposta, userIdFallback = null, jogoFallback = null) {
    if (!aposta || typeof aposta !== "object") return null;

    return {
        idAposta: aposta.idAposta || `simples_migrada_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        userId: aposta.userId || userIdFallback,
        jogo: aposta.jogo || jogoFallback,
        escolha: aposta.escolha || null,
        valor: Number(aposta.valor || 0),
        odd: Number(aposta.odd || 0),
        nomeEscolha: aposta.nomeEscolha || aposta.escolha || "Escolha desconhecida"
    };
}

function normalizeApostasValores(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return {};
    }

    const normalizado = {};

    for (const jogoId of Object.keys(data)) {
        const apostasDoJogo = data[jogoId];

        if (Array.isArray(apostasDoJogo)) {
            normalizado[jogoId] = apostasDoJogo
                .map(aposta => normalizarApostaSimplesAtiva(aposta, aposta?.userId || null, jogoId))
                .filter(Boolean);

            continue;
        }

        if (apostasDoJogo && typeof apostasDoJogo === "object") {
            const lista = [];

            for (const chave of Object.keys(apostasDoJogo)) {
                const item = apostasDoJogo[chave];

                if (Array.isArray(item)) {
                    for (const aposta of item) {
                        const normalizada = normalizarApostaSimplesAtiva(aposta, aposta?.userId || chave, jogoId);
                        if (normalizada) lista.push(normalizada);
                    }
                    continue;
                }

                const normalizada = normalizarApostaSimplesAtiva(item, item?.userId || chave, jogoId);
                if (normalizada) lista.push(normalizada);
            }

            normalizado[jogoId] = lista;
            continue;
        }

        normalizado[jogoId] = [];
    }

    return normalizado;
}

function normalizarMultiplaAtiva(multipla, userIdFallback = null) {
    if (!multipla || typeof multipla !== "object") return null;

    return {
        idAposta: multipla.idAposta || `multipla_migrada_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        userId: multipla.userId || userIdFallback,
        valor: Number(multipla.valor || 0),
        oddTotal: Number(multipla.oddTotal || 0),
        retornoPossivel: Number(multipla.retornoPossivel || 0),
        selecoes: Array.isArray(multipla.selecoes)
            ? multipla.selecoes.map(item => ({
                jogo: item.jogo,
                escolha: item.escolha,
                odd: Number(item.odd || 0),
                nomeEscolha: item.nomeEscolha || item.escolha || "Escolha desconhecida"
            }))
            : [],
        resolvida: Boolean(multipla.resolvida),
        criadaEm: multipla.criadaEm || null
    };
}

function normalizeMultiplas(data) {
    if (Array.isArray(data)) {
        return data
            .map(item => normalizarMultiplaAtiva(item, item?.userId || null))
            .filter(Boolean);
    }

    if (data && typeof data === "object") {
        const lista = [];

        for (const userId of Object.keys(data)) {
            const item = data[userId];

            if (Array.isArray(item)) {
                for (const multipla of item) {
                    const normalizada = normalizarMultiplaAtiva(multipla, multipla?.userId || userId);
                    if (normalizada) lista.push(normalizada);
                }
                continue;
            }

            const normalizada = normalizarMultiplaAtiva(item, item?.userId || userId);
            if (normalizada) lista.push(normalizada);
        }

        return lista;
    }

    return [];
}

function normalizeDb(data) {
    return {
        saldos: data && typeof data.saldos === "object" && data.saldos !== null ? data.saldos : {},
        jogos: data && typeof data.jogos === "object" && data.jogos !== null ? data.jogos : {},
        carrinhos: data && typeof data.carrinhos === "object" && data.carrinhos !== null ? data.carrinhos : {},
        multiplas: normalizeMultiplas(data?.multiplas),
        rodadaStats: data && typeof data.rodadaStats === "object" && data.rodadaStats !== null ? data.rodadaStats : {},
        apostasValores: normalizeApostasValores(data?.apostasValores),
        historicoApostas: data && typeof data.historicoApostas === "object" && data.historicoApostas !== null ? data.historicoApostas : {},
        painelRodada: data && typeof data.painelRodada === "object" && data.painelRodada !== null
            ? {
                channelId: data.painelRodada.channelId || null,
                messageId: data.painelRodada.messageId || null
            }
            : { channelId: null, messageId: null }
    };
}

function ensureDatabaseFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
    }
}

function loadDatabase() {
    ensureDatabaseFile();

    try {
        const raw = fs.readFileSync(DB_PATH, "utf8");

        if (!raw.trim()) {
            const fresh = cloneDefaultDb();
            saveDatabase(fresh);
            return fresh;
        }

        const parsed = JSON.parse(raw);
        return normalizeDb(parsed);
    } catch (error) {
        console.error("Erro ao carregar database.json:", error);

        const fresh = cloneDefaultDb();
        saveDatabase(fresh);
        return fresh;
    }
}

function saveDatabase(data) {
    ensureDatabaseFile();

    const normalized = normalizeDb(data);
    fs.writeFileSync(DB_PATH, JSON.stringify(normalized, null, 2), "utf8");
}

module.exports = {
    DATA_DIR,
    DB_PATH,
    loadDatabase,
    saveDatabase
};

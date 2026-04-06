const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "database.json");

const DEFAULT_DB = {
    saldos: {},
    jogos: {},
    carrinhos: {},
    multiplas: {},
    rodadaStats: {}
};

function cloneDefaultDb() {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
}

function normalizeDb(data) {
    return {
        saldos: data && typeof data.saldos === "object" && data.saldos !== null ? data.saldos : {},
        jogos: data && typeof data.jogos === "object" && data.jogos !== null ? data.jogos : {},
        carrinhos: data && typeof data.carrinhos === "object" && data.carrinhos !== null ? data.carrinhos : {},
        multiplas: data && typeof data.multiplas === "object" && data.multiplas !== null ? data.multiplas : {},
        rodadaStats: data && typeof data.rodadaStats === "object" && data.rodadaStats !== null ? data.rodadaStats : {}
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

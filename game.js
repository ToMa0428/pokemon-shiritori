// game.js の修正版

// --- グローバル変数と定数 ---
let allPokemon = [];
let usedPokemonNames = [];
let lastChar = '';
window.countdownInterval = null;
window.hintCountdownInterval = null;
let currentMode;
let currentHintOption;
let isPlayerTurn = true; // AIモード用
let aiThinkingInterval = null;

// 五十音フィルター用
let filteredPokemon = [];

// HTML要素の変数をグローバルスコープで宣言
let statusElement;
let inputElement;
let historyElement;
let hintElement;
let countdownElement;
let pokedexContent;
let highScoreSolo;
let highScoreAi;
let loadingMessage;
let progressBar;
let prevPageBtn;
let nextPageBtn;
let hintContainerElement;
let pokedexKanaSelect;

// DOMContentLoaded後に初期化を行う
document.addEventListener('DOMContentLoaded', () => {
    statusElement = document.getElementById("status");
    inputElement = document.getElementById("input");
    historyElement = document.getElementById("history");
    hintElement = document.getElementById("hint");
    countdownElement = document.getElementById("countdown");
    pokedexContent = document.getElementById("pokedexContent");
    highScoreSolo = document.getElementById("highScoreSolo");
    highScoreAi = document.getElementById("highScoreAi");
    loadingMessage = document.getElementById("loadingMessage");
    progressBar = document.getElementById("progressBar");
    prevPageBtn = document.getElementById("prevPageBtn");
    nextPageBtn = document.getElementById("nextPageBtn");
    hintContainerElement = document.getElementById("hint-container");
    pokedexKanaSelect = document.getElementById("pokedexKanaSelect"); // 新しい要素を取得

    // 五十音プルダウンのイベントリスナー
    pokedexKanaSelect.addEventListener('change', (e) => {
        const selectedKana = e.target.value;
        window.filterPokedex(selectedKana);
    });
});

// --- データ管理とダウンロード ---
window.isRegionCached = (gen) => { return !!localStorage.getItem(`region_${gen}`); };

window.updateProgressBar = (completed, total) => {
    const percentage = Math.floor((completed / total) * 100);
    progressBar.style.width = percentage + '%';
    progressBar.textContent = percentage + '%';
};

window.downloadAll = async () => {
    window.showScreen('loadingScreen');
    loadingMessage.textContent = "データをダウンロード中...";
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';

    const res = await fetch('https://pokeapi.co/api/v2/generation/');
    const data = await res.json();
    const generations = data.results;
    const totalGenerations = generations.length;
    let completedGenerations = 0;

    for (const genData of generations) {
        const gen = genData.url.split("/").filter(Boolean).pop();
        const isCached = window.isRegionCached(gen);

        if (isCached) {
            const cachedData = JSON.parse(localStorage.getItem(`region_${gen}`));
            const apiRes = await fetch(`https://pokeapi.co/api/v2/generation/${gen}`);
            const apiData = await apiRes.json();
            if (cachedData.length !== apiData.pokemon_species.length) {
                loadingMessage.textContent = `${genData.name}のデータを こうしんするよ…`;
                await window.fetchAndCacheRegion(gen, genData.name);
            }
        } else {
            loadingMessage.textContent = `${genData.name}のデータを もらってるよ…`;
            await window.fetchAndCacheRegion(gen, genData.name);
        }
        completedGenerations++;
        window.updateProgressBar(completedGenerations, totalGenerations);
    }
    
    // ダウンロード完了後にデータをまとめて、ゲームモード画面に遷移
    loadingMessage.textContent = "ダウンロードかんりょう！";
    allPokemon = [];
    generations.forEach(genData => {
        const gen = genData.url.split("/").filter(Boolean).pop();
        allPokemon = allPokemon.concat(JSON.parse(localStorage.getItem(`region_${gen}`)));
    });

    setTimeout(() => {
        window.showScreen('gameModeScreen');
        window.displayHighScores();
    }, 1000);
};

window.fetchAndCacheRegion = async (gen, name) => {
    const res = await fetch(`https://pokeapi.co/api/v2/generation/${gen}`);
    const data = await res.json();
    const speciesPromises = data.pokemon_species.map(async (species) => {
        const id = species.url.split("/").filter(Boolean).pop();
        try {
            const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
            const speciesData = await speciesRes.json();
            const jpName = speciesData.names.find(n => n.language.name === "ja-Hrkt")?.name;
            if (jpName) {
                const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
                const pokeData = await pokeRes.json();
                return { id: id, name: jpName, image: pokeData.sprites.front_default };
            }
        } catch (e) { console.error("ダウンロードしっぱい:", id, e); }
        return null;
    });
    const results = (await Promise.all(speciesPromises)).filter(p => p !== null);
    localStorage.setItem(`region_${gen}`, JSON.stringify(results));
};

// ゲーム準備
window.prepareGame = async () => {
    window.showScreen('loadingScreen');

    const res = await fetch('https://pokeapi.co/api/v2/generation/');
    const data = await res.json();
    const generations = data.results;

    let allGenerationsCached = true;
    generations.forEach(genData => {
        const gen = genData.url.split("/").filter(Boolean).pop();
        const cachedData = localStorage.getItem(`region_${gen}`);
        if (!cachedData || JSON.parse(cachedData).length === 0) {
            allGenerationsCached = false;
        }
    });

    if (!allGenerationsCached) {
        // すべての世代がキャッシュされていない、またはデータが空の場合はダウンロードする
        await window.downloadAll();
    } else {
        // すべての世代がキャッシュされている場合は、データをまとめてモード選択画面へ
        allPokemon = [];
        generations.forEach(genData => {
            const gen = genData.url.split("/").filter(Boolean).pop();
            allPokemon = allPokemon.concat(JSON.parse(localStorage.getItem(`region_${gen}`)));
        });
        window.showScreen('gameModeScreen');
        window.displayHighScores();
    }
};

// --- ゲームメインロジック ---
window.startGame = (mode, hintOption) => {
    // ゲームの状態をリセット
    usedPokemonNames = [];
    lastChar = '';
    currentMode = mode;
    currentHintOption = hintOption;
    
    // UIをリセット
    historyElement.innerHTML = '';
    hintContainerElement.innerHTML = '';
    inputElement.value = '';
    countdownElement.textContent = '';
    
    // タイマーをリセット
    if (window.countdownInterval) clearInterval(window.countdownInterval);
    if (window.hintCountdownInterval) clearInterval(window.hintCountdownInterval);
    if (aiThinkingInterval) clearInterval(aiThinkingInterval);

    window.showScreen('gameScreen');

    const firstPokemon = window.getValidFirstPokemon();
    // 最初のポケモンが見つからない場合はエラーメッセージを表示して終了
    if (!firstPokemon) {
        window.endGame("ごめんね！ポケモンデータがうまく読み込めなかったみたい。リロードしてみてね！", 0);
        return;
    }
    window.updateHistory(firstPokemon);
    lastChar = window.getLastChar(firstPokemon.name);

    statusElement.textContent = `「${firstPokemon.name}」から はじまるよ！つぎは「${lastChar}」だね！`;

    if (currentMode === 'solo') {
        inputElement.disabled = false;
        inputElement.focus();
        document.getElementById('inputForm').style.display = 'block';
        if (currentHintOption !== 'none') {
            window.startHintCountdown();
        }
    } else if (currentMode === 'ai') {
        inputElement.disabled = false;
        document.getElementById('inputForm').style.display = 'block';
        window.startAITurn();
    }
};

window.getValidFirstPokemon = () => {
    const validPokemon = allPokemon.filter(p => window.getLastChar(p.name) !== 'ン');
    return validPokemon[Math.floor(Math.random() * validPokemon.length)];
};

// ユーザーの入力をチェックする関数
window.checkUserInput = () => {
    const kanaName = inputElement.value.trim();
    const katakanaName = kanaName.replace(/[\u3041-\u3096]/g, function(match) {
        var chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });

    inputElement.value = '';

    // タイマーとヒントタイマーをリセット
    if (window.countdownInterval) clearInterval(window.countdownInterval);
    if (window.hintCountdownInterval) clearInterval(window.hintCountdownInterval);
    countdownElement.textContent = '';
    hintContainerElement.innerHTML = '';
    
    const pokemon = allPokemon.find(p => p.name === katakanaName);

    if (!pokemon) {
        statusElement.textContent = `あれ？「${katakanaName}」って、ポケモンかな？`;
        if (currentMode === 'ai' || currentMode === 'solo') {
            inputElement.disabled = false;
            inputElement.focus();
        }
        return;
    }
    if (usedPokemonNames.includes(katakanaName)) {
        statusElement.textContent = `「${katakanaName}」は、さっき言ったよ！`;
        if (currentMode === 'ai' || currentMode === 'solo') {
            inputElement.disabled = false;
            inputElement.focus();
        }
        return;
    }
    if (!katakanaName.startsWith(lastChar)) {
        statusElement.textContent = `「${lastChar}」から はじまるポケモンだよ！`;
        if (currentMode === 'ai' || currentMode === 'solo') {
            inputElement.disabled = false;
            inputElement.focus();
        }
        return;
    }
    
    // 正しい入力だった場合
    // AIモードの場合はinputElementを無効化し、AIのターンへ
    if (currentMode === 'ai') {
        inputElement.disabled = true;
    }
    
    window.updateHistory(pokemon);
    lastChar = window.getLastChar(pokemon.name);

    if (lastChar === 'ン') {
        window.endGame(`「${pokemon.name}」で「ん」がついちゃった！ おしまい！`, usedPokemonNames.length);
        return;
    }

    statusElement.textContent = `つぎは「${lastChar}」から！`;
    if (currentMode === 'solo' && currentHintOption !== 'none') {
        window.startHintCountdown();
    } else if (currentMode === 'ai') {
        window.startAITurn();
    }
};

// AIのターン
window.startAITurn = () => {
    isPlayerTurn = false;
    inputElement.disabled = true;
    hintContainerElement.innerHTML = '';
    
    statusElement.textContent = "AIがかんがえています…";

    aiThinkingInterval = setTimeout(() => {
        const candidates = allPokemon.filter(p =>
            !usedPokemonNames.includes(p.name) &&
            p.name.startsWith(lastChar) &&
            window.getLastChar(p.name) !== 'ン'
        );

        if (candidates.length > 0) {
            const aiPokemon = candidates[Math.floor(Math.random() * candidates.length)];
            window.updateHistory(aiPokemon);
            lastChar = window.getLastChar(aiPokemon.name);
            statusElement.textContent = `AIは「${aiPokemon.name}」だ！つぎは「${lastChar}」だよ！`;

            if (lastChar === 'ン') {
                window.endGame(`AIが「${aiPokemon.name}」で「ん」がついちゃった！キミの勝ち！`, usedPokemonNames.length);
            } else {
                window.startPlayerTurn();
            }
        } else {
            window.endGame("AIがこうさんした！キミの勝ち！", usedPokemonNames.length);
        }
    }, 2000);
};

// プレイヤーのターン
window.startPlayerTurn = () => {
    isPlayerTurn = true;
    inputElement.disabled = false;
    inputElement.focus();
    
    if (currentMode === 'ai') {
        window.startAITimer();
    }
    
    if (currentHintOption !== 'none') {
        window.startHintCountdown();
    }
};

// AIモード用タイマー
window.startAITimer = () => {
    if (window.countdownInterval) clearInterval(window.countdownInterval);
    let count = 30;
    countdownElement.textContent = `のこり ${count}びょう…`;
    window.countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownElement.textContent = `のこり ${count}びょう…`;
        } else {
            clearInterval(window.countdownInterval);
            countdownElement.textContent = '';
            window.endGame("じかんぎれだよ！おしまい！", usedPokemonNames.length);
        }
    }, 1000);
};

// ヒントカウントダウン
window.startHintCountdown = () => {
    if (window.hintCountdownInterval) clearInterval(window.hintCountdownInterval);
    hintContainerElement.innerHTML = '';
    
    let hintCount = 10;
    countdownElement.textContent = `ヒントは ${hintCount}びょうご…`;

    window.hintCountdownInterval = setInterval(() => {
        hintCount--;
        if (hintCount > 0) {
            countdownElement.textContent = `ヒントは ${hintCount}びょうご…`;
        } else {
            clearInterval(window.hintCountdownInterval);
            countdownElement.textContent = 'ヒントだよ！';
            
            const candidates = allPokemon.filter(p =>
                !usedPokemonNames.includes(p.name) &&
                p.name.startsWith(lastChar) &&
                window.getLastChar(p.name) !== 'ン'
            );

            if (candidates.length > 0) {
                const hintPokemon = candidates[Math.floor(Math.random() * candidates.length)];
                const img = document.createElement('img');
                img.src = hintPokemon.image;
                img.alt = 'つぎのポケモンのヒント';
                
                if (currentHintOption === 'silhouette') {
                    img.classList.add('silhouette');
                } else {
                    img.classList.remove('silhouette');
                }

                hintContainerElement.appendChild(img);
            } else {
                hintElement.textContent = "あれ…？このもじから はじまるポケモンが もういないみたい！";
                setTimeout(() => window.endGame("つづくポケモンが いなくなっちゃった！", usedPokemonNames.length), 2000);
            }
        }
    }, 1000);
};

// endGame関数を修正
window.endGame = (message, score) => {
    // すべてのタイマーを停止
    if (window.countdownInterval) clearInterval(window.countdownInterval);
    if (window.hintCountdownInterval) clearInterval(window.hintCountdownInterval);
    if (aiThinkingInterval) clearInterval(aiThinkingInterval);
    
    inputElement.disabled = true;
    
    window.showScreen('endScreen');

    let finalScore = score;
    if (currentMode === 'ai') {
        finalScore = Math.floor(usedPokemonNames.length / 2);
    }
    
    // ハイスコア更新チェックとメッセージ設定
    const highScoreKey = `shiritoriHighScore_${currentMode}_${currentHintOption}`;
    const storedHighScore = localStorage.getItem(highScoreKey);
    let highScore = 0;
    if (storedHighScore) {
        highScore = parseInt(storedHighScore, 10);
    }

    let finalMessage = message;
    if (finalScore > highScore) {
        highScore = finalScore;
        localStorage.setItem(highScoreKey, highScore);
        finalMessage += "<br>ハイスコアこうしん！✨";
    }

    document.getElementById('endMessage').innerHTML = finalMessage;
    document.getElementById('score').textContent = `つづいた かいすう: ${finalScore}かい`;
    const endHistoryContainer = document.getElementById('endHistory');
    endHistoryContainer.innerHTML = '<h3>今回のしりとり</h3>' + historyElement.innerHTML;
};

// ハイスコアを表示する関数
window.displayHighScores = () => {
    const hintOptions = ['normal', 'silhouette', 'none'];
    let soloScoreText = '<h4>ソロモード</h4>';
    let aiScoreText = '<h4>AIモード</h4>';

    hintOptions.forEach(option => {
        const soloHighScore = localStorage.getItem(`shiritoriHighScore_solo_${option}`) || 0;
        const aiHighScore = localStorage.getItem(`shiritoriHighScore_ai_${option}`) || 0;
        
        let label = '';
        if (option === 'normal') label = '（ヒントあり）';
        if (option === 'silhouette') label = '（シルエット）';
        if (option === 'none') label = '（ヒントなし）';

        soloScoreText += `
            <p style="margin: 5px 0; font-size: 14px;">${label} ハイスコア: ${soloHighScore}かい</p>
        `;
        aiScoreText += `
            <p style="margin: 5px 0; font-size: 14px;">${label} ハイスコア: ${aiHighScore}かい</p>
        `;
    });

    document.getElementById('highScoreSolo').innerHTML = soloScoreText;
    document.getElementById('highScoreAi').innerHTML = aiScoreText;
};

// --- ヘルパー関数 ---
window.updateHistory = (pokemon) => {
    usedPokemonNames.push(pokemon.name);
    const item = document.createElement("div");
    item.className = `history-item`;
    const img = document.createElement("img");
    img.src = pokemon.image;
    img.alt = pokemon.name;
    const name = document.createElement("span");
    name.textContent = pokemon.name;
    item.appendChild(img);
    item.appendChild(name);
    historyElement.appendChild(item);
    historyElement.scrollTop = historyElement.scrollHeight;
};

window.getLastChar = (name) => {
    let char = name.slice(-1);
    const smallToLarge = {'ァ':'ア','ィ':'イ','ゥ':'ウ','ェ':'エ','ォ':'オ','ッ':'ツ','ャ':'ヤ','ュ':'ユ','ョ':'ヨ'};
    if(smallToLarge[char]) char = smallToLarge[char];
    if (char === 'ー' && name.length > 1) {
        return name.slice(-2, -1);
    }
    return char;
};

// --- 図鑑モード関連 ---
const POKEMON_PER_PAGE = 200;
let allPokemonForPokedex = [];

window.loadPokedexData = () => {
    allPokemonForPokedex = [];
    for (let i = 1; i <= 10; i++) {
        const genData = localStorage.getItem(`region_${i}`);
        if (genData) {
            allPokemonForPokedex.push(...JSON.parse(genData));
        }
    }
    allPokemonForPokedex.sort((a, b) => a.id - b.id);
    filteredPokemon = [...allPokemonForPokedex];
};

// 五十音で図鑑をフィルタリングする関数を修正
window.filterPokedex = (kana) => {
    if (kana === 'all') {
        filteredPokemon = [...allPokemonForPokedex];
    } else {
        // 選択された一文字に正確にマッチするように修正
        filteredPokemon = allPokemonForPokedex.filter(p => {
            const firstChar = p.name.slice(0, 1);
            return firstChar === kana;
        });
    }
    window.renderPokedex(1);
};

window.renderPokedex = (page = 1) => {
    if (allPokemonForPokedex.length === 0) {
        window.loadPokedexData();
    }
    
    // 現在のプルダウンの値を同期
    pokedexKanaSelect.value = pokedexKanaSelect.value || 'all';

    if (filteredPokemon.length === 0) {
        pokedexContent.innerHTML = "条件にあうポケモンがみつかりませんでした。";
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        return;
    }

    const start = (page - 1) * POKEMON_PER_PAGE;
    const end = start + POKEMON_PER_PAGE;
    const paginatedPokemon = filteredPokemon.slice(start, end);

    pokedexContent.innerHTML = "";
    const listContainer = document.createElement("div");
    listContainer.className = "pokedex-list";
    paginatedPokemon.forEach(p => {
        const item = document.createElement("div");
        item.className = "pokedex-item";
        const img = document.createElement("img");
        img.src = p.image;
        img.alt = p.name;
        const name = document.createElement("p");
        name.textContent = `${p.id} ${p.name}`;
        item.appendChild(img);
        item.appendChild(name);
        listContainer.appendChild(item);
    });
    pokedexContent.appendChild(listContainer);

    prevPageBtn.disabled = (page === 1);
    nextPageBtn.disabled = (end >= filteredPokemon.length);

    prevPageBtn.onclick = () => { window.renderPokedex(page - 1); };
    nextPageBtn.onclick = () => { window.renderPokedex(page + 1); };
};
// main.js の修正版

document.addEventListener('DOMContentLoaded', () => {
    // game.jsからも呼び出せるように、windowオブジェクトに設定
    window.showScreen = (screenId) => {
        ['titleScreen', 'gameModeScreen', 'gameScreen', 'endScreen', 'pokedexScreen', 'loadingScreen'].forEach(id => {
            document.getElementById(id).style.display = (id === screenId) ? 'block' : 'none';
        });

        // モード選択画面に戻るたびにハイスコアを表示
        if (screenId === 'gameModeScreen') {
            window.displayHighScores();
        }
    };

    // --- 各ボタンのイベントリスナー ---
    // 「ゲームスタート」ボタンのクリックでダウンロード処理を開始
    document.getElementById('toGameModeBtnFromTitle').addEventListener('click', window.prepareGame);

    // モード選択画面
    document.getElementById('toGameSoloBtn').addEventListener('click', () => {
        const hintOption = document.querySelector('input[name="soloHint"]:checked').value;
        window.startGame('solo', hintOption);
    });

    document.getElementById('toGameAiBtn').addEventListener('click', () => {
        const hintOption = document.querySelector('input[name="aiHint"]:checked').value;
        window.startGame('ai', hintOption);
    });
    
    document.getElementById('toPokedexBtn').addEventListener('click', () => {
        window.showScreen('pokedexScreen');
        window.loadPokedexData();
        window.renderPokedex(1);
    });

    // ゲーム画面
    document.getElementById('inputForm').addEventListener('submit', (e) => {
        e.preventDefault();
        window.checkUserInput();
    });
    document.getElementById('toTitleBtn2').addEventListener('click', () => {
        if (window.countdownInterval) clearInterval(window.countdownInterval);
        window.showScreen('titleScreen');
    });
    // 「しりとりを終わる」ボタンのイベントリスナー
    document.getElementById('endGameBtn').addEventListener('click', () => {
        window.endGame("おつかれさま！じぶんでおわらせたよ！", usedPokemonNames.length);
    });

    // 終了画面
    document.getElementById('restartBtn2').addEventListener('click', window.prepareGame);
    document.getElementById('toTitleBtn3').addEventListener('click', () => window.showScreen('titleScreen'));

    // 図鑑画面
    document.getElementById('toGameModeBtn').addEventListener('click', () => {
        window.showScreen('gameModeScreen');
    });

    // ページ読み込み時にロード画面を表示し、データの準備を開始する
    window.prepareGame();
});
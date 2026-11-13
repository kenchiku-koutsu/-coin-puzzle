# コロスター参考素材（仮配置）

korostar-reference.png はユーザー提供 ZIP の korostar_reference_crop.png と同一です。
集合画像の左から3番目にいる緑の服・襟なしのコロスターの参考切り出しで、正式な単体透過マスターではありません。
描き直し、透明化、輪郭加工は行っていません。CSSのみで背景の表示位置と濃さを調整しています。
動画素材は提供されていないため、動かない背景として開始画面だけに配置しています。

開始用画像はキーボードでも押せるボタンです。装飾背景はクリックを妨げません。
既存の計算ロジックに変更はありません。

検証：Chromium/Playwrightで画像読込・Tab/Enter開始、3問題・全34通りの反転前後と復元、リセット・ヒント・5画面幅のテストに成功。
実機スマホ・Safari・読み上げは未実施。公開前に本人の画像・見た目の確認を待ちます。

再実行: node tests/browser.cjs
スマホ開始画像保存: PREVIEW_PATH=/tmp/korostar-preview.png node tests/browser.cjs

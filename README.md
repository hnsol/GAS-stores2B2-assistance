# GAS-stores2B2-assistance
assist editing Invoice data: from stores to yamato B2 Cloud

### 背景

[Stores（ストアーズ）](https://stores.jp/ec)には[「送り状CSV出力（ヤマトB2クラウド）」](https://officialmag.stores.jp/entry/kaigyou/kinou-okurijo-yamato)があって、送り状を簡単に作成できるはず……。だけれども、実際にはいくつか手作業が発生する。csvデータが落ちてくるので、Excelで編集しようとすると、いろいろワナがある。

- 数値データの冒頭にゼロが入っていると、ゼロが消えてしまう（郵便番号、電話番号）　←　これがExcel上ではいちばんクリティカル
- ステータス「未発送」のみがcsv出力対象で、「未入金」を出力できない　←　これはstoresのデータ書き出しにオプションがないから
- 依頼主が固定　←　これはstoresのデータ書き出しの仕様
- いくつかの列は、どうせ固定値を埋める　←　これはいずれにせよ手作業

などなど。全部は対応していないが、作業ミスを防ぐため、クリティカルなものから自動化した。


### how it works

- import order data (csv file), from stores
- import B2 output data stores (csv), from stores
- set data sheet name at cells in the spreadsheet
- click 'start' button
- modified B2 output data sheet are generated as a new sheet

### this assistant does...

- avoid deleting '0' on top of string
- concatinating '未発送' record
- some constant valies are filled automatically


### this assistant doesn't...



# GAS-stores2B2-assistance
assist editing Invoice data: from stores to yamato B2 Cloud

## はじめに

[Stores（ストアーズ）](https://stores.jp/ec)には[「送り状CSV出力（ヤマトB2クラウド）」](https://officialmag.stores.jp/entry/kaigyou/kinou-okurijo-yamato)という機能あって、送り状を簡単に作成できるはず……。だけれど実際にはいくつか手作業が発生する。たとえば、ダウンロードしたCSVデータを、Excelで編集しようと考える人が多いと思われる。

ところが、数値データの冒頭にゼロが入っていると、ゼロが消えてしまう。たとえば`09087654321`という電話番号をExcelに取り込むと`9087654321`となる。郵便番号も、北海道はゼロから始まる。これらのデータを手で編集するはめになる。

そのほかにも（ショップ固有の条件で）、手入力が面倒なことがいろいろある。これらをまとめて、勉強も兼ねて、GAS(Google Apps Script)でやってみた。

## 全体ワークフロー

<img src="https://github.com/hnsol/GAS-stores2B2-assistance/blob/main/images/DaaC/C4_Context.png" width=50%>

図の真ん中の「出荷作業支援」が今回のGASが支援する範囲。

<img src="https://github.com/hnsol/GAS-stores2B2-assistance/blob/main/images/DaaC/C4_Container.png" width=50%>


## 

- 数値データの冒頭にゼロが入っていると、ゼロが消えてしまう（郵便番号、電話番号）　←　これがExcel上ではいちばんクリティカル
- ステータス「未発送」のみがcsv出力対象で、「未入金」を出力できない　←　これはstoresのデータ書き出しにオプションがないから
- 依頼主が固定　←　これはstoresのデータ書き出しの仕様
- いくつかの列は、どうせ固定値を埋める　←　これはいずれにせよ手作業

などなど。全部は対応していないが、作業ミスを防ぐため、クリティカルなものから自動化した。

また、送り状作成後、出荷前のチェックが少しでも楽になるように、オーダー情報を整形するスクリプトを書いた。



<img src="https://github.com/hnsol/GAS-stores2B2-assistance/blob/main/images/SS_configsheet.png" width="320px">


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

### function structure


| #01           | #02                  | #03               |
| ------------- | -------------------- | ----------------- |
| buttonStart() | generateInvoiceSht() | initConfig        |
|               |                      | sht2arr           |
|               |                      | clipWPLine        |
|               |                      | mapOrderToB2      |
|               |                      | concat2DArray     |
|               |                      | formatYamatB2     |
|               |                      | outputArray2Sht   |
|               | generateOrderCkSht() | initConfig        |
|               |                      | sht2arr           |
|               |                      | formatOrder4Check |
|               |                      | outputArray2Sht   |
|               |                      |                   |

| #02                  | #03               | #04                   | #05            |
| -------------------- | ----------------- | --------------------- | -------------- |
| generateInvoiceSht() | initConfig        | convertSht2Obj        |                |
|                      | sht2arr           |                       |                |
|                      | clipWPLine        | clipLine              |                |
|                      |                   | groupConcat           |                |
|                      | mapOrderToB2      |                       |                |
|                      | concat2DArray     |                       |                |
|                      | formatYamatB2     | sortByOrderDate       |                |
|                      |                   | xxxUme                | fillConstValue |
|                      |                   | num2str               |                |
|                      | outputArray2Sht   | smartInsSheet         |                |
|                      |                   |                       |                |
| generateOrderCkSht() | initConfig        | convertSht2Obj        |                |
|                      | sht2arr           |                       |                |
|                      | formatOrder4Check | deleteOverlap         |                |
|                      |                   | clipRowsforCheck      |                |
|                      |                   | deleteOverlapOrderNum |                |
|                      |                   | num2str               |                |
|                      | outputArray2Sht   | smartInsSheet         |                |

不必要に複雑にしているのか……！？　書き換えたときに、おもったよりは影響範囲が少ないとは思ったけれども。


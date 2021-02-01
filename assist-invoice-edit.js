/**
 * storesのB2出力csvの編集を、少しだけ助けます
 */
function assistInvoiceEdit() {

  // 開始確認（OKボタン押下以外は処理を中断）
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('B2送り状データ作成支援', '処理を開始します。よろしいですか？', ui.ButtonSet.OK_CANCEL);
  if (response !== ui.Button.OK) return;

  // シート全体を取得
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // '設定シート'から設定値を取得;
  var confg = {};
  initConfig(ss, confg);

  // オーダー情報シートをオブジェクト化
  var shtOrder = ss.getSheetByName(confg.shtOrderName);

  // 入金待ちの行を取得
  var arrWPU = clipWPLine(shtOrder);

  // 入金待ちの配列を、オーダー情報形式からヤマトB2形式に変換
  var arrWPUB2 = mapOrderToB2(arrWPU);

  // yamato.csvデータと、入金待ちの配列を結合
  var shtYamat = ss.getSheetByName(confg.shtYamatName);
  var arrYamat = shtYamat.getDataRange().getValues();
  var arrWPUB2C = concatTwoDimensionalArray(arrYamat, arrWPUB2, 0);

  // 結合したデータをオーダー日でソート
  sortByOrderDate(arrWPUB2C, shtOrder);

  // xxx埋め
  xxxUme(arrWPUB2C, confg);

  // 数字だけの項目には"'"をつける
  num2str(arrWPUB2C);

  // 出力シートをyamato.csvからコピー
  copySheet(ss, confg.shtYamatName, confg.shtYamatCpName);
  var shtYamatCp = ss.getSheetByName(confg.shtYamatCpName);

  // シートをクリアして、配列を書き込む（すべて文字列とする）
  shtYamatCp.clearContents();
  shtYamatCp
    .getRange(1, 1, arrWPUB2C.length, arrWPUB2C[0].length)
    .setNumberFormat('@')
    .setValues(arrWPUB2C);

  // 終了メッセージ
  var response = ui.alert('完了しました！', 'シート作成が完了しました。ご確認ください。', ui.ButtonSet.OK);
}

/**
 * 設定値を、設定シートから取り込みます
 * @param {Object} ss     操作対象シート
 * @param {Object} confg  コンフィグ値
 */
// 設定値の初期化
function initConfig(ss, confg) {
  var arrConfg = ss.getSheetByName('設定シート').getDataRange().getValues();
  
  confg.shtOrderName   = arrConfg[1][2]; // like '20210111_order'
  confg.shtYamatName   = arrConfg[2][2]; // like '20210111_yamato'
  confg.shtOrderClName = arrConfg[3][2]; // like '20210111_order_calc'
  confg.shtYamatCpName = arrConfg[4][2]; // like '20210111_yamato_cp'
  confg.samaume        = arrConfg[5][2]; // like 'true,'様',17'
  confg.wareume        = arrConfg[6][2]; // like 'true,'ワレモノ注意',30'
  confg.tentume        = arrConfg[7][2]; // like 'true,'天地無用',31'
  confg.seikume        = arrConfg[8][2]; // like 'true,'09099999999',39'
  confg.untiume        = arrConfg[9][2]; // like 'true,'true,'01',41'

}

/**
 * 入金待ちの行を抽出します
 * @param {string} shtOrder オーダー情報シートの名前
 * @return {Array} arrWPU   取得データの2次元配列 
 */
function clipWPLine(shtOrder) {
  var arrOrder = shtOrder.getDataRange().getValues();

  // ①入金待ちのレコードを抽出
  // HACK:直打ち - 列1が値'入金待ち'であるものを抽出
  var arrWP = clipLine(arrOrder, '入金待ち', 1);

  // ②品名欄を連結し、重複レコードを削除
  // HACK:直打ち - 連結キーはオーダー番号で、0列　連結列は品名で、8列　デリミタは','
  var arrWPU = groupConcat(arrWP, 0, 8, ', ');

  return arrWPU; 
}

/**
 * 2次元配列arrのなかで、col列が値valであるものを抽出します
 * @param {Array}  arr        抽出用の2次元配列
 * @param {string} val        抽出キー
 * @param {number} col        抽出対象列
 * @return {Array} arrClipped 抽出後の2次元配列 
 */
function clipLine(arr, val, col) {

  var arrClipped = arr.filter( value => value[col] === val );

  return arrClipped;
}

/**
 * 2次元配列arrのなかで、key列が同じ行の、colを連結します
 * @param {Array}  arr    操作対象の2次元配列   
 * @param {number} key    重複判定対象列のインデックス
 * @param {number} col    連結対象列のインデックス
 * @param {string} dlm    デリミタ
 * @return {Array} arrGC  連結後の2次元配列 
 */
function groupConcat(arr, key, col, dlm){

  // arrのlengthの値を取っておく
  // arrLength にfirstindex、arrLength + 1に連結文字列を格納する
  // return前に長さを戻す、ため
  var arrLength = arr[0].length; 

  // 行列を入れ替える関数を定義
  // TODO:場所はここがいいか？
  const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
  var key_t = transpose(arr)[key];
  // console.log(key_t);
  // like [ '6649065905', '4314438123', '6666217936', '9928044714', '9928044714' ]

  // key列の値が、はじめて登場する行のindexを、valueのいちばん後ろに付与する(firstindex)
  arr.forEach( value => value.push(key_t.indexOf(value[key])) );

  // 行のindexとfirstindexが一致するなら、品名を配列のお尻にくっつける
  arr.forEach( function(value, index, array) {
    var aln = value.length;     // 現在行の項目数を取得（品名付与前）
    var fid = value[aln-1];     // firstindexの値をfidに入れる

    if (index === fid) {        // 現在行のindexが、firstindexと一致するなら
      value.push(value[col]);   // col列を現在行の最後にくっつける
    } else {                    // 現在行のindex <> firstindexなら
      // firstindex行のお尻の品名(=aln)に、現在行の品名をくっつける 
      // ''は文字列への変換保証のため
      array[fid][aln] += ( '' + dlm + value[col] );
    }
  })

  // col列に、結合した文字列（品名）を書き戻し、結合文字列は消す
  arr.forEach( (value, index) => {
    if (index === value[arrLength]) value[col] = value[arrLength + 1];
    value.length = arrLength + 1
  });

  // indexとfirstindexが一致するものだけ拾う
  var arrGC = arr.filter( (value, index) => {
    return index === value[value.length -1];
  });

  // もとの長さに戻す
  arrGC.forEach( value => value.length = arrLength );

  return arrGC;
}

/**
 * オーダー形式のデータをB2形式へマッピングする
 * @param  {Array} arrOrder 操作対象の2次元配列   
 * @return {Array} arrB2    連結後の2次元配列 
 */
function mapOrderToB2(arrOrder) {
  var arrB2 = [];

  // インデックス設定：1to1マッピング　※列数から1マイナスのこと
  var io_ordernum = 0,  ib_ordernum = 0;  // オーダー番号
  var io_phonenum = 38, ib_phonenum = 8;  // お届け先電話番号
  var io_yubinnum = 35, ib_yubinnum = 10; // お届け先郵便番号
  var io_senditem = 8,  ib_senditem = 27; // 品名１
  var io_emailadd = 45, ib_emailadd = 48; // お届け予定ｅメール
  var io_comments = 47, ib_comments = 95; // 備考欄
  var io_memomemo = 48, ib_memomemo = 96; // メモ
  var io_wpayment = 2,  ib_wpayment = 97; // 支払い方法
  
  // 固定値
  var ib_sendphon = 19,  cb_sendphon = '09xxxxxxxxxx'; // ご依頼主電話番号
  var ib_sendyubn = 21,  cb_sendyubn = 'xxxxxxx';      // ご依頼主郵便番号
  var ib_sendaddr = 22,  cb_sendaddr = 'xxxxxxxxx';    // ご依頼主住所
  var ib_sendname = 24,  cb_sendname = 'xxxxxxx';      // ご依頼主名
  var ib_clntcode = 39,  cb_clntcode = '099999999999'; // 請求先顧客コード
  var ib_chargnum = 41,  cb_chargnum = '01';           // 運賃管理番号
  var ib_itemstat = 98,  cb_itemstat = '入金待ち';      // ステータス
  
  // 結合値
  var io_ad1 = 36, io_ad2 = 37, ib_ad1 = 11, ib_ad2 = 12; // お届け先住所 マンション名
  var io_na1 = 33, io_na2 = 34, ib_nam = 15;              // お届け先名

  for (i=0 ;i<arrOrder.length; i++) {
    // console.log(i, arrB2[0,0], arrOrder[0][0]);
    var arrB2line = new Array(99);

    // 1to1マッピング
    // NOTE: 数値の冒頭ゼロ問題の回避は別途行うので、"'"をつけない
    arrB2line[ib_ordernum] = arrOrder[i][io_ordernum]; // オーダー番号
    arrB2line[ib_phonenum] = arrOrder[i][io_phonenum]; // お届け先電話番号
    arrB2line[ib_yubinnum] = arrOrder[i][io_yubinnum]; // お届け先郵便番号
    arrB2line[ib_senditem] = arrOrder[i][io_senditem]; // 品名１
    arrB2line[ib_emailadd] = arrOrder[i][io_emailadd]; // お届け予定ｅメール
    arrB2line[ib_comments] = arrOrder[i][io_comments]; // 備考欄
    arrB2line[ib_memomemo] = arrOrder[i][io_memomemo]; // メモ
    arrB2line[ib_wpayment] = arrOrder[i][io_wpayment]; // 支払い方法

    // 固定値
    // NOTE: 数値の冒頭ゼロ問題の回避は別途行うので、"'"をつけない
    arrB2line[ib_sendphon] = cb_sendphon; // ご依頼主電話番号
    arrB2line[ib_sendyubn] = cb_sendyubn; // ご依頼主郵便番号
    arrB2line[ib_sendaddr] = cb_sendaddr; // ご依頼主住所
    arrB2line[ib_sendname] = cb_sendname; // ご依頼主名
    arrB2line[ib_clntcode] = cb_clntcode; // 請求先顧客コード
    arrB2line[ib_chargnum] = cb_chargnum; // 運賃管理番号
    arrB2line[ib_itemstat] = cb_itemstat; // ステータス

    // 結合値
    arrB2line[ib_ad1] = arrOrder[i][io_ad1] + arrOrder[i][io_ad2];        // お届け先住所
    arrB2line[ib_nam] = arrOrder[i][io_na1] + ' ' + arrOrder[i][io_na2];  // お届け先名

    arrB2.push(arrB2line);
  }
    
  return arrB2
}

// オーダーからB2へマッピングする関数
/**
 * 2次元配列arrのなかで、key列が同じ行の、colを連結します
 * @param {Array}  arr1 連結対象の2次元配列
 * @param {Array}  arr2 連結対象の2次元配列
 * @param {number} axis   1:横方向に結合　1以外:縦方向に結合
 * @return {Array} arr3
 * https://qiita.com/hikobotch/items/bda1e23879dd842cee35 より
 */
function concatTwoDimensionalArray(arr1, arr2, axis) {
  if(axis != 1) axis = 0;
  var arr3 = [];
  if (axis == 0) {  // 縦方向の結合
    arr3 = arr1.slice();
    for (var i = 0; i < arr2.length; i++) {
      arr3.push(arr2[i]);
    }
  } else {          // 横方向の結合
    for (var i = 0; i < arr1.length; i++) {
      arr3[i] = arr1[i].concat(arr2[i]);
    }
  }
  return arr3;
}

/**
 * 配列をオーダー日でソートします
 * @param {Array}  arrWPUB2C  配列（ソート前）
 * @param {string} shtOrder   オーダー情報のシート名称
 * @return {Array} arrWPUB2C  配列（ソート後）
 */
function sortByOrderDate(arrWPUB2C, shtOrder) {
  // オーダーシートを配列に読み込み
  var arrOrder = shtOrder.getDataRange().getValues();
  // 行列を入れ替える関数を定義
  // todo:場所はここがいいか？ なんどもでているのでよくない気がする
  const transpose = a => a[0].map((_, c) => a.map(r => r[c]));

  // オーダーシートの、オーダー番号だけを拾った1次元配列
  // like [ 'オーダー番号', '2176468849', '6058601867', '5037548365', ... ]
  var orderNum = transpose(arrOrder)[0];

  // 入力配列のヘッダを取り分けておく、配列の長さも取っておく
  var arrWPUB2Cheader = arrWPUB2C.shift();
  var arrWPUB2Clength = arrWPUB2C[0].length;

  // 配列の各行の最終列にオーダー日を追加
  arrWPUB2C.forEach( value => {
    var idxorder = orderNum.indexOf(value[0]);
    // オーダー日の列[3]を直打ち
    // if (idxorder > 0) value.push(arrOrder[idxorder][3]);
    if (idxorder > 0) {
      value.push(arrOrder[idxorder][3]);  
    } else {
      // 何かの事情でオーダー情報からオーダー日を拾えなかった場合
      // ダミー値を入れておく（nullだとソートができないため）
      value.push('2001-01-01 01:00:00');
      // console.log(value[0], idxorder);
    }
  })

  // 配列をsc列で降順でソート（sc: Sort Column）
  var sc = arrWPUB2Clength;
  arrWPUB2C.sort(function(a, b){
	  if (a[sc] > b[sc]) return -1;
	  if (a[sc] < b[sc]) return 1;
	  return 0;
  });

  // 最終列に追加したオーダー日を削除
  arrWPUB2C.forEach( value => value.length = arrWPUB2Clength);

  //ヘッダを戻してリターン
  return arrWPUB2C.unshift(arrWPUB2Cheader);
}

/**
 * 配列の、特定の列を同じデータで埋めます
 * @param {Array}  arrWPUB2C  操作対象配列
 * @param {Object} confg      コンフィグ値の入っているオブジェクト
 */
function xxxUme(arrWPUB2C, confg) {
  fillConstValue(arrWPUB2C, confg.samaume); // 様埋め
  fillConstValue(arrWPUB2C, confg.wareume); // ワレモノ注意埋め
  fillConstValue(arrWPUB2C, confg.tentume); // 天地無用埋め
  fillConstValue(arrWPUB2C, confg.seikume); // 請求先顧客コード埋め
  fillConstValue(arrWPUB2C, confg.untiume); // 運賃管理番号埋め
}

/**
 * 同じデータで指定列を埋めます
 * @param {Array}  arr  操作対象の2次元配列
 * @param {string} str  設定値文字列 like 'false,様,17'
 * @return {Array} arr
 */ 
function fillConstValue(arr, str) {
  // strを分割して変数に格納
  var prm = str.split(',');
  var isGo = (prm[0] == 'true') ? true : false; // ON-OFFを判定
  var txt = prm[1], col = prm[2];

  var header = arr.shift();

  // col列をtxtで埋める
  if (isGo) arr.forEach( value => value[col] = txt );
  
  return arr.unshift(header);
}

/**
 * 数字だけの項目に"'"をつけます
 * @param {Array}  arr 操作対象の2次元配列
 * @return {Array} arr "'"付与済みの2次元配列
 */
function num2str(arr) {
  // 正規表現：正の整数値（カンマに対応していないことに注意）
  var regexp = new RegExp(/^[0-9]+(\.[0-9]+)?$/);

  arr.forEach( (line, idxlin) =>
    line.forEach( (col, idxcol) => {
      if ( regexp.test(col) ) arr[idxlin][idxcol] = "'" + col;  
    })
  )

  return arr;
}

/**
 * シートをコピーします
 * @param {string} origSheetName  コピー元のシート名称 
 * @param {string} newSheetName   生成するシート名称
 */
function copySheet(ss, origSheetName, newSheetName) {

  var origSht = ss.getSheetByName(origSheetName);

  // コピー先のシートがすでに存在する場合は、削除する
  var previousSht = ss.getSheetByName(newSheetName);
  if (previousSht !== null) ss.deleteSheet(previousSht);

  var newSht  = origSht.copyTo(ss);
  newSht.setName(newSheetName);
}



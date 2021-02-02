/**
 * 構造概要
 *  buttonGenerateCheckSheet()
 *    assistInvoiceEdit()
 *      initConfig
 *      clipWPLine
 *        clipLine
 *        groupConcat
 *      mapOrderToB2
 *      concatTwoDimensionalArray
 *      sortByOrderDate
 *      xxxUme
 *      num2str
 *      copySheet
 * 
 *  generateOrderChecker()
 *    initConfig
 *    sht2arr
 *    deleteOverlap
 *    clipRowsforCheck
 *    deleteOverlapOrderNum
 *    num2str
 * 
 */

/**
 * 「チェックシート生成」ボタンを押したときに反応を返します
 */
function buttonGenerateCheckSheet() {
  // 開始確認（OKボタン以外は処理を中断）
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('シート作成の開始', 'Excelコピペ用シートと、チェック用シートの作成を開始します。よろしいですか？', ui.ButtonSet.OK_CANCEL);
  if (response !== ui.Button.OK) return;

  assistInvoiceEdit();    // 入金待ちデータ取り込み & 編集支援
  generateOrderChecker(); // オーダー情報からチェックシートを作成

  // 終了メッセージ
  var response = ui.alert('完了しました！', 'シート作成が完了しました。ご確認ください。', ui.ButtonSet.OK);
}


/**
 * storesのB2出力csvの編集を、少しだけ助けます
 */
function assistInvoiceEdit() {

  // シート全体を取得
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // '設定シート'から設定値を取得;
  var confg = {};
  initConfig(ss, confg);

  // オーダー情報シート、ヤマトcsvシートをオブジェクト化
  var shtOrder = ss.getSheetByName(confg.shtOrderName);
  var shtYamat = ss.getSheetByName(confg.shtYamatName);

  // 入金待ちの行を取得
  var arrWPU = clipWPLine(shtOrder);

  // 入金待ちの配列を、オーダー情報形式からヤマトB2形式に変換
  var arrWPUB2 = mapOrderToB2(arrWPU);

  // yamato.csvデータと、入金待ちの配列を結合
  var arrYamat = sht2arr(shtYamat);
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

}

/**
 * 設定値を、設定シートから取り込みます
 * @param {Object} ss     操作対象シート
 * @param {Object} confg  コンフィグ値
 */
// 設定値の初期化
function initConfig(ss, confg) {
  var arrConfg = ss.getSheetByName('設定シート').getDataRange().getValues();
  
  // TODO:ここは、シートセルからオブジェクト化したい！
  confg.shtOrderName   = arrConfg[1][2];  // like '20210111_order'
  confg.shtYamatName   = arrConfg[2][2];  // like '20210111_yamato'
  confg.shtYamatCpName = arrConfg[3][2];  // like '20210111_yamato_cp'
  confg.shtOrderCkName = arrConfg[4][2];  // like '20210111_order_ck'
  confg.samaume = arrConfg[5][2].split(",");  // like 'true,'様',17'
  confg.bancume = arrConfg[6][2].split(",");  // like 'true,'京都府...町99-99',22'
  confg.kanaume = arrConfg[7][2].split(",");  // like 'true,'ﾄﾅﾘﾉﾄﾄﾛ',23'
  confg.wareume = arrConfg[8][2].split(",");  // like 'true,'ワレモノ注意',30'
  confg.tentume = arrConfg[9][2].split(",");  // like 'true,'天地無用',31'
  confg.seikume = arrConfg[10][2].split(","); // like 'true,'09099999999',39'
  confg.untiume = arrConfg[11][2].split(","); // like 'true,'true,'01',41'
  confg.odckolf = arrConfg[12][2].split(","); // like '33,34,35,36,37,38'
  confg.odckolt = arrConfg[13][2].split(","); // like '39,40,41,42,43,44'
  confg.odckrow = arrConfg[14][2].split(","); // like '0,8,12,13,33,34,35,36,37,38,46,47,39,40,41,42,43,44'

}

/**
 * 入金待ちの行を抽出します
 * @param {string} shtOrder オーダー情報シートの名前
 * @return {Array} arrWPU   取得データの2次元配列 
 * TODO: arrは上位で取っておいて、arrを受け取って処理するように変えたほうがいい
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
  fillConstValue(arrWPUB2C, confg.bancume); // 住所番地埋め
  fillConstValue(arrWPUB2C, confg.kanaume); // カナ埋め
  fillConstValue(arrWPUB2C, confg.wareume); // ワレモノ注意埋め
  fillConstValue(arrWPUB2C, confg.tentume); // 天地無用埋め
  fillConstValue(arrWPUB2C, confg.seikume); // 請求先顧客コード埋め
  fillConstValue(arrWPUB2C, confg.untiume); // 運賃管理番号埋め
}

/**
 * 同じデータで指定列を埋めます
 * @param {Array}  arr  操作対象の2次元配列
 * @param {Array}  prm  設定値配列 like [ 'false', '様', '17' ]
 * @return {Array} arr
 */ 
function fillConstValue(arr, prm) {
  var isGo = (prm[0] == 'true') ? true : false; // ON-OFFを判定
  var txt = prm[1];
  var col = prm[2];

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

/**
 * storesのB2出力について、オーダー情報からチェック用シートを作成します
 */
function generateOrderChecker() {

  // シート全体を取得
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // '設定シート'から設定値を取得;
  var confg = {};
  initConfig(ss, confg);

  // オーダー情報シートをオブジェクト化
  var shtOrder = ss.getSheetByName(confg.shtOrderName);

  // シートから配列に読み込み
  var arrOD = sht2arr(shtOrder);

  // 重複列を削除
  deleteOverlap(arrOD, confg.odckolf, confg.odckolt);

  // 必要列に集約
  var arrODC = clipRowsforCheck(arrOD, confg.odckrow);

  // オーダー番号をuniqueにする HACK: 0は直打ち
  deleteOverlapOrderNum(arrODC, 0);

  // 数字だけの項目には"'"をつける
  num2str(arrODC);

  // チェックシートをyamato.csvからコピー
  copySheet(ss, confg.shtOrderName, confg.shtOrderCkName);
  var shtOrderCk = ss.getSheetByName(confg.shtOrderCkName);

  // シートをクリアして、配列を書き込む（すべて文字列とする）
  shtOrderCk.clearContents();
  shtOrderCk
    .getRange(1, 1, arrODC.length, arrODC[0].length)
    .setNumberFormat('@')
    .setValues(arrODC);

}


/**
 * シートからデータを取得します
 * @param {Object} sht  操作対象シート
 * @return {Array} arr  シートから取得した値（2次元配列）
 */
function sht2arr(sht) {
  // シートから値を配列に取得
  var arr = sht.getDataRange().getValues();
  return arr;
}

/**
 * 2次元配列の、指定列F,Tでの重複があればT列を削除します
 * @param {Array}  arr   操作対象の2次元配列
 * @param {string} idxfm 重複チェックの指定列
 * @param {string} idxto 重複チェックの指定列、この列を削除
 * @return {Array} arr   書き換え後の2次元配列
 */
function deleteOverlap(arr, idxfm, idxto) {

  arr.forEach( line => {
    idxfm.forEach( (val, idx) => {
      if (line[val] == line[idxto[idx]]) line[idxto[idx]] = "";
    })
  })

  return arr;
}

/**
 * チェックシートに必要な行を抽出します
 * @param {Array} array     操作対象の2次元配列
 * @param {string} rowsClip 抽出する列 like [ '0', '8', '12', '13', '25' ]
 * @return {Array}          抽出後の2次元配列
 */
function clipRowsforCheck(array, rowsClip) {
  console.log(rowsClip);
  // 行列入れ替え
  const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
  var arrayT = transpose(array);

  // 抽出
  var arrayCT = [];
  rowsClip.forEach( val => arrayCT.push(arrayT[val]) );

  // 行列を入れ替えてリターン
  return transpose(arrayCT);
}

/**
 * 指定列の重複値を削除します
 * @param {Array} array   操作対象の2次元配列
 * @param {string} row    抽出する列 like 0
 * @return {Array} array  抽出後の2次元配列
 */
function deleteOverlapOrderNum(array, row) {

  // 行列を入れ替えた配列を用意
  // TODO:関数化しようね……
  const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
  var arrayT = transpose(array);

  // 指定列の値が、初出で「ない」ならば、その値を''に置き換える
  // NOTE: arrayT[row][idx]ではなくarray[idx][row]を書き換えている
  arrayT[row].forEach( (val, idx) => {
    if (idx !== arrayT[row].indexOf(val)) array[idx][row] = '';
  });

  return array;
}


// /**
//  * 2次元配列の行と列を入れ替えます
//  */
// function transpose(array) {
//   // const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
//   console.log(array[0]);
//   array[0].map((_, c) => array.map(r => r[c]));
//   console.log(array[0]);
  
//   return array;
// }  


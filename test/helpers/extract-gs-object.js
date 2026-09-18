/*
 * `.gs`ファイル（`var Foo = {...(JSON.stringifyされたリテラル)...};`という末尾の1文）から
 * オブジェクトを取り出すテスト用ヘルパー。生成物はJSON.stringifyで作られているため、
 * 変数宣言以降をJSON.parseするだけで安全に取り出せる。
 */
'use strict';

function extractGsObject(source, varName) {
  var marker = 'var ' + varName + ' = ';
  var start = source.indexOf(marker);
  if (start === -1) throw new Error(varName + ' が見つからない');
  var jsonStart = start + marker.length;
  var jsonEnd = source.lastIndexOf('\n};');
  var jsonText = source.slice(jsonStart, jsonEnd + 2);
  return JSON.parse(jsonText);
}

module.exports = { extractGsObject: extractGsObject };

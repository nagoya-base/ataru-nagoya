/*
 * targetCount / crossTargetCount / 複数選択重複カウント / excluded除外のテスト用フィクスチャ。
 * multiValueDelimiter（'|'）で連結した保存形式を模している。
 */
'use strict';

module.exports = [
  { response_id: 'R1', excluded: false, q2_gender: '男性', q4_interest: '興味がある', q15_gate: 'はい',
    q11_uniform: '野球|サッカー', q22_visit: '日程が合えば', q24_price: '3,000円程度', q25_intent: '日程が合えば参加したい' },

  { response_id: 'R2', excluded: false, q2_gender: '男性', q4_interest: 'あまり興味はない', q15_gate: '内容による',
    q11_uniform: '野球', q22_visit: '内容が合えば', q24_price: '2,000円以下', q25_intent: '開催案内が欲しい' },

  { response_id: 'R3', excluded: false, q2_gender: '男性', q4_interest: 'とても好き', q15_gate: '興味はない',
    q11_uniform: 'サッカー', q22_visit: '', q24_price: '', q25_intent: '' },

  { response_id: 'R4', excluded: false, q2_gender: '女性', q4_interest: '興味がある', q15_gate: '',
    q11_uniform: '', q22_visit: '', q24_price: '', q25_intent: '' },

  { response_id: 'R5', excluded: false, q2_gender: 'その他', q4_interest: '苦手', q15_gate: '',
    q11_uniform: '', q22_visit: '', q24_price: '', q25_intent: '' },

  { response_id: 'R6_excluded', excluded: true, q2_gender: '男性', q4_interest: '興味がある', q15_gate: 'はい',
    q11_uniform: '野球', q22_visit: '日程が合えば', q24_price: '3,000円程度', q25_intent: '日程が合えば参加したい' },

  { response_id: 'R7', excluded: false, q2_gender: '男性', q4_interest: '苦手', q15_gate: 'はい',
    /* 「野球」を重複させて保存し、二重カウントされないことを検証する */
    q11_uniform: '野球|野球|ラグビー・アメフト', q22_visit: '友人と一緒なら', q24_price: '4,000円程度', q25_intent: '友人と一緒なら参加したい' },

  { response_id: 'R8', excluded: false, q2_gender: '男性', q4_interest: '興味がある', q15_gate: '内容による',
    q11_uniform: 'バスケットボール', q22_visit: '宿泊を伴っても', q24_price: '5,000円程度', q25_intent: '見学してから考えたい' }
];

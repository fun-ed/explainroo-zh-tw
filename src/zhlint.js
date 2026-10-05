// Finds Simplified characters and mainland Chinese wording in a Traditional
// Chinese (Taiwan) video, in the narration, the subtitles and scenes.js.
// ponytail: a short list of common cases, not a full converter; add pairs as they come up.

// Simplified characters whose Traditional form differs, with that form.
const SIMPLIFIED = {
  们: '們', 这: '這', 说: '說', 时: '時', 为: '為', 国: '國', 会: '會', 来: '來', 个: '個', 对: '對',
  过: '過', 发: '發', 后: '後', 现: '現', 问: '問', 关: '關', 题: '題', 开: '開', 无: '無', 机: '機',
  电: '電', 话: '話', 点: '點', 进: '進', 实: '實', 动: '動', 应: '應', 学: '學', 样: '樣', 经: '經',
  报: '報', 线: '線', 听: '聽', 达: '達', 战: '戰', 联: '聯', 苏: '蘇', 号: '號', 种: '種', 运: '運',
  据: '據', 网: '網', 络: '絡', 软: '軟', 视: '視', 频: '頻', 计: '計', 设: '設', 统: '統',
  还: '還', 让: '讓', 认: '認', 识: '識', 气: '氣', 长: '長', 东: '東', 车: '車', 门: '門',
  见: '見', 观: '觀', 历: '歷', 华: '華', 万: '萬', 亿: '億', 与: '與', 从: '從', 两: '兩', 么: '麼',
  图: '圖', 书: '書', 写: '寫', 读: '讀', 语: '語', 词: '詞', 测: '測', 试: '試', 验: '驗', 证: '證',
  结: '結', 构: '構', 变: '變', 简: '簡', 单: '單', 复: '複', 杂: '雜', 处: '處', 级: '級', 类: '類',
  术: '術', 难: '難', 获: '獲', 环: '環', 节: '節', 传: '傳', 务: '務', 当: '當', 际: '際', 区: '區',
  导: '導', 弹: '彈', 军: '軍', 卫: '衛', 尔: '爾', 维: '維', 预: '預',
  场: '場', 声: '聲', 脉: '脈', 冲: '衝', 谋: '謀', 论: '論', 阴: '陰', 厉: '厲', 带: '帶',
};

// Mainland words and the usual Taiwan wording.
const MAINLAND = {
  視頻: '影片', 视频: '影片', 軟件: '軟體', 软件: '軟體', 硬件: '硬體', 信息: '資訊', 質量: '品質',
  屏幕: '螢幕', 默認: '預設', 默认: '預設', 服務器: '伺服器', 网络: '網路', 網絡: '網路',
  数据: '資料', 文件夾: '資料夾', 鼠標: '滑鼠', 激光: '雷射', 導彈: '飛彈', 打印: '列印',
  優化: '最佳化', 菜單: '選單', 用戶: '使用者', 內存: '記憶體', 芯片: '晶片',
  博客: '部落格', 短信: '簡訊', 出租車: '計程車', 土豆: '馬鈴薯', 自行車: '腳踏車', 互聯網: '網際網路',
  咱們: '我們', 啥: '什麼', 咋: '怎麼', 忽悠: '唬弄', 溜達: '散步', 牛逼: '厲害', 搞定: '完成', 靠譜: '可靠', 給力: '厲害', 點贊: '按讚', 視屏: '影片',
};

export function zhIssues(project, scenesSource = '') {
  const issues = [];
  const seen = new Set();
  const scan = (text, where, scene = null) => {
    for (const [word, tw] of Object.entries(MAINLAND)) {
      if (text.includes(word) && !seen.has(`${where}:${word}`)) {
        seen.add(`${where}:${word}`);
        issues.push({ level: 'warn', scene, t: null, message: `${where} uses the mainland word "${word}"; in Taiwan say "${tw}"` });
      }
    }
    const simp = [...new Set([...text].filter((c) => SIMPLIFIED[c]))];
    if (simp.length) issues.push({ level: 'warn', scene, t: null, message: `${where} has Simplified characters: ${simp.slice(0, 12).map((c) => `${c}→${SIMPLIFIED[c]}`).join(' ')}; write Traditional Chinese (繁體中文)` });
  };
  for (const sc of project.script.scenes) {
    const narration = sc.units.filter((u) => u.type === 'word').map((u) => u.display + u.spoken).join('');
    scan(narration, 'the narration', sc.id);
    issues.push(...punctuationIssues(sc), ...lengthIssues(sc));
  }
  // Only the strings in scenes.js, not the code around them.
  const strings = (scenesSource.match(/(['"`])(?:\\.|(?!\1).)*\1/g) || []).join(' ');
  scan(strings, 'scenes.js');
  return issues;
}

// Taiwanese writing uses full-width punctuation next to Chinese, 「」 for quotes
// and …… for trailing off. The voice reads both the same, but captions show them.
function punctuationIssues(sc) {
  const text = sc.text;
  const issues = [];
  const add = (message) => issues.push({ level: 'warn', scene: sc.id, t: null, message });
  const half = [...text.matchAll(/(?<=\p{Script=Han})[,.?!:;]|[,.?!:;](?=\p{Script=Han})/gu)].map((m) => m[0]);
  if (half.length) add(`half-width punctuation next to Chinese (${[...new Set(half)].join(' ')}); use full-width ，。？！：；`);
  if (/[“”"](?=\p{Script=Han})|(?<=\p{Script=Han})[“”"]/u.test(text)) add('use 「」 for quotes in Chinese, and 『』 inside them');
  if (/(?<!…)…(?!…)|\.\.\.|。。/.test(text) && /\p{Script=Han}/u.test(text)) add('write a trailing-off pause as ……, two characters; it gets a 0.5 s pause');
  return issues;
}

// Spoken Taiwanese keeps sentences short; a long stretch with no comma is hard to follow.
function lengthIssues(sc) {
  const runs = sc.text.split(/[，。！？、；：……—\s]+/).filter((r) => [...r.matchAll(/\p{Script=Han}/gu)].length > 30);
  return runs.length ? [{ level: 'hint', scene: sc.id, t: null, message: `"${runs[0].slice(0, 16)}…" runs over 30 characters without a pause; Taiwanese narration reads better in 10 to 20 character pieces` }] : [];
}

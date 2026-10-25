'use strict';

function searchableText(record) {
  return JSON.stringify([
    record.id, record.title, record.tags, record.type, record.uses,
    record.role, record.cautions, record.batch, record.layerBehavior
  ]).toLocaleLowerCase();
}

function selectRecords(records, query = '', type = '') {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(record => (!type || record.type === type)
    && words.every(word => searchableText(record).includes(word)));
}

function browserApp(catalog) {
  const elements = Object.fromEntries(['q', 'kind', 'count', 'grid', 'background'].map(id => [id, document.getElementById(id)]));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const render = () => {
    const records = selectRecords(catalog.records, elements.q.value, elements.kind.value);
    elements.count.textContent = records.length + ' / ' + catalog.records.length + ' 项';
    elements.grid.innerHTML = records.map(record => {
      const history = record.generationHistory;
      const edits = (history.editPrompts || []).map((prompt, index) => '<h3>局部编辑 ' + (index + 1) + '</h3><pre>' + esc(prompt) + '</pre>').join('');
      return '<article class="card"><a class="image" href="' + esc(record.file) + '"><img loading="lazy" src="' + esc(record.file) + '" alt="' + esc(record.title) + '"></a><div class="info"><small>' + esc(record.id) + ' · ' + esc(record.type) + '</small><h2>' + esc(record.title) + '</h2><p>' + esc(record.uses) + '</p><p class="tags">' + esc(record.tags.join(' · ')) + '</p><p class="meta">' + record.width + ' × ' + record.height + ' · alpha=0 像素 ' + (record.transparentFraction * 100).toFixed(1) + '%</p><p class="caution">' + esc(record.cautions) + '</p><p><a href="' + esc(record.file) + '" download>保存原始 PNG</a></p><details><summary>提示词、锚点与来源</summary><p>可见边界（alpha ≥ 16）：' + esc(JSON.stringify(record.bbox)) + '</p><p>可见边界中心：' + record.anchor.x + ', ' + record.anchor.y + '</p><p class="hash">SHA-256：' + record.sha256 + '</p><p>' + esc(record.provenance) + '</p><p>来源记录：' + esc(history.sourceRecords.join('；')) + '</p><p>历史检查登记：' + esc(record.inspectionStatus || '以原目录元数据为准；此次导出未重复视觉审查') + '</p><h3>原始生成提示词</h3><pre>' + esc(history.originalGenerationPrompt || record.prompt) + '</pre>' + edits + '<p><a href="generation-records.json">完整生成记录 JSON</a></p></details></div></article>';
    }).join('');
  };
  elements.q.addEventListener('input', render);
  elements.kind.addEventListener('change', render);
  elements.background.addEventListener('change', () => { elements.grid.className = 'grid ' + elements.background.value; });
  render();
}

function renderGallery(catalog) {
  const json = JSON.stringify(catalog).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>教育 3D 素材库 · 44 项</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0b1017;color:#f3f0e8;font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;padding:36px;line-height:1.7}header,main,footer{max-width:1440px;margin:auto}h1{font-size:clamp(27px,4vw,40px);line-height:1.25;margin:0 0 16px}header p{max-width:1000px;color:#b2c7d6}a{color:#acdeee}label{display:inline-block;margin:6px 16px 12px 0}input,select{display:block;background:#1b2d3c;color:#f3f0e8;border:1px solid #527082;border-radius:8px;padding:12px;font:inherit}input{width:440px;max-width:80vw}#count{display:block;color:#dab780;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:22px}.card{background:#172735;border:1px solid #94b6cb40;border-radius:14px;overflow:hidden}.image{height:240px;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse,#314b5e,#111b25)}.light .image{background:#e9edf0}.checker .image{background-color:#d2d7dd;background-image:linear-gradient(45deg,#a6afb8 25%,transparent 25%),linear-gradient(-45deg,#a6afb8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#a6afb8 75%),linear-gradient(-45deg,transparent 75%,#a6afb8 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}img{width:100%;height:100%;object-fit:contain}.info{padding:20px}h2{font-size:19px;margin:8px 0}small,.meta{color:#9dbdce}.tags{color:#dab780;font-size:13px}.caution{font-size:14px;color:#d4dde2}details{font-size:13px;color:#adc4d0;margin-top:12px}summary{cursor:pointer;color:#acdfee}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.65 ui-monospace,monospace}h3{font-size:14px}.hash{overflow-wrap:anywhere}footer{border-top:1px solid #527082;margin-top:36px;padding-top:18px;color:#9dbdce;font-size:14px}@media(max-width:600px){body{padding:20px}input{width:100%;max-width:100%}label{display:block;margin-right:0}.image{height:260px}}
</style></head><body><header><h1>教育 3D · 可复用素材库</h1><p>44 项原始 PNG：28 个透明主体、16 幅完整场景。按语义选图，再添加当期文字、事实和数据；静态素材的整组移动不等于人物关节运动或真实 3D 转视角。</p><p>此页面自带目录，双击即可离线搜索。透明比例、边界和锚点来自已归档测量；技术校验不能自动验证内容事实、科学结构、校情或政策。</p><p><a href="README.md">使用说明</a> · <a href="catalog.json">素材目录 JSON</a> · <a href="generation-records.json">生成与编辑记录</a> · <a href="previews/batch-01.jpg">首批 10 项总览</a> · <a href="previews/batch-02.jpg">第二批 10 项总览</a> · <a href="../LICENSE">仓库根 LICENSE</a></p></header>
<main><div role="search"><label for="q">语义、用途或限制<input id="q" type="search" placeholder="例如：学生、门槛、精密仪器、2026-10-25第二批"></label><label for="kind">素材类型<select id="kind"><option value="">全部类型</option><option value="透明主体">透明主体</option><option value="完整场景">完整场景</option></select></label><label for="background">预览底色<select id="background"><option value="dark">深色</option><option value="light">浅色</option><option value="checker">棋盘格</option></select></label></div><output id="count" aria-live="polite"></output><div class="grid dark" id="grid"></div><noscript>请启用 JavaScript 以使用离线搜索；也可直接查阅 catalog.json 与 assets 目录。</noscript></main>
<footer>使用范围以仓库根 LICENSE 为准。本页未额外授予许可，也不作公有领域、独占权或不侵权保证。请保留原始 PNG，带字或合成版本另存。</footer>
<script>
${searchableText.toString()}
${selectRecords.toString()}
${browserApp.toString()}
browserApp(${json});
</script></body></html>
`;
}

module.exports = { searchableText, selectRecords, renderGallery };

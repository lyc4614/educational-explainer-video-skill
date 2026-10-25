'use strict';
// This build reads only files within this published directory.
const fs = require('node:fs');
const path = require('node:path');
const { renderGallery } = require('./lib/gallery.cjs');
const root = __dirname;
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
fs.writeFileSync(path.join(root, 'index.html'), renderGallery(catalog));
console.log(`Built offline gallery: ${catalog.records.length} items. Original PNG files were not written.`);

import assert from 'node:assert/strict';
import { validateExportSettings } from '../src/export-settings.js';
const valid=validateExportSettings({duration:12.2,width:1280,height:720,fps:30});
assert.equal(valid.totalFramesEstimate,366);
for (const input of [
 {duration:NaN,width:1280,height:720,fps:30},
 {duration:Infinity,width:1280,height:720,fps:30},
 {duration:0,width:1280,height:720,fps:30},
 {duration:5,width:0,height:720,fps:30},
 {duration:5,width:1280,height:-1,fps:30},
 {duration:5,width:1280.5,height:720,fps:30},
 {duration:5,width:1280,height:720,fps:0},
 {duration:5,width:1280,height:720,fps:61},
 {duration:1e100,width:1280,height:720,fps:60}
]) assert.throws(()=>validateExportSettings(input));
console.log('Export settings validation tests passed.');

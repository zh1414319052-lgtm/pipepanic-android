const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),asset=path.join(root,'app/src/main/assets/jspp');
test('packaged GLB contains every playable direction, baked texture, glass and queue asset',()=>{
 const raw=fs.readFileSync(path.join(root,'art/fidelity/pipepanic-modules.glb'));
 assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(8),raw.length);
 const doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString());
 const names=new Set(doc.nodes.map(n=>n.name));
 for(let i=0;i<17;i++)assert.ok(names.has('p'+i+'_opaque'));
 for(let i=2;i<17;i++)assert.ok(names.has('q'+i+'_opaque'));
 for(const id of [0,1,2,3,4,5,11,12,13,14,15,16])assert.ok(names.has('p'+id+'_glass'));
 for(const id of [6,7,8,9,10])assert.ok(!names.has('p'+id+'_glass'),'integral brass junction has no overlapping glass');
 for(const material of doc.materials.filter(m=>m.name.startsWith('FixedView_'))){
  assert.ok(material.extensions.KHR_materials_unlit);
  assert.ok(material.pbrMetallicRoughness.baseColorTexture);
  assert.equal(material.emissiveTexture,undefined,'avoid applying a second PBR lighting pass');
 }
 const encoded=fs.readFileSync(path.join(asset,'fidelity-assets.js'),'utf8').match(/PUMP_ASSET_BASE64="([^"]+)"/)[1];
 assert.ok(raw.equals(Buffer.from(encoded,'base64')),'APK asset and editable GLB are identical');
 for(const ui of ['console-panel.png','console-action.png'])assert.equal(fs.readFileSync(path.join(asset,'fidelity-ui',ui)).subarray(1,4).toString(),'PNG');
});

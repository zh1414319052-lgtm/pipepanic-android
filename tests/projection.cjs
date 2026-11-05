const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/jspp/pump-board.js'),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const geometry=context.PumpProjection;

test('the orthographic overhead camera maps visible tile and pipe centers to their real cells',()=>{
    for(const [width,height] of [[5,3],[6,5],[7,6],[8,6],[11,11]]) {
        const view=geometry.frame(width,height);
        for(let row=0;row<height;row++) for(let col=0;col<width;col++) {
            for(const z of [.076,.35,.48]) {
                const at=geometry.project(view,geometry.cell(view,col,row,z));
                assert.deepEqual(at,geometry.project(view,geometry.cell(view,col,row,0)));
                assert.ok(at[0]>0 && at[0]<1 && at[1]>0 && at[1]<1);
                const cell=geometry.pick(view,...at);
                assert.equal(cell[0],col);
                assert.equal(cell[1],row);
            }
        }
        for(const pos of [[-width/2-.12,0,.076],[width/2+.12,0,.076],
                          [0,-height/2-.12,.076],[0,height/2+.12,.076]]) {
            assert.equal(geometry.pick(view,...geometry.project(view,pos)),null);
        }
    }
});


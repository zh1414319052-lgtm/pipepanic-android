"""Package standard GLB and a reusable cut of the approved Mantaflow cache."""
import base64,json,struct,gzip,sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'app/src/main/assets/jspp'
art=ROOT/'art/fidelity'

def glb():
 path=art/'pipepanic-modules.glb';raw=path.read_bytes()
 length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);tail=raw[20+length:]
 for mat in doc['materials']:
  if mat.get('name','').startswith('FixedView_') and 'emissiveTexture' in mat:
   tex=mat.pop('emissiveTexture');mat.pop('emissiveFactor',None)
   mat['pbrMetallicRoughness']={'baseColorFactor':[1,1,1,1],'baseColorTexture':tex,'metallicFactor':0,'roughnessFactor':1}
   mat['extensions']={'KHR_materials_unlit':{}}
 for field in ('extensionsUsed','extensionsRequired'):
  doc.setdefault(field,[])
  if 'KHR_materials_unlit' not in doc[field]:doc[field].append('KHR_materials_unlit')
 encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
 raw=struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail
 path.write_bytes(raw)
 (OUT/'fidelity-assets.js').write_text('/* Generated standard GLB with baked Cycles appearance. */\nvar PUMP_ASSET_BASE64="'+base64.b64encode(raw).decode()+'";\n')
 print('GLB',len(raw),len(doc['meshes']),len(doc['images']))

def liquid(source):
 frames=[]
 # Mature straight-channel surface: retain simulated crests and cavities, then
 # bend this reusable mesh to each connected pipe. Not a live fluid simulation.
 for frame in range(57,104,3):
  actual=frame if frame%2 else frame-1
  raw=gzip.decompress((source/f'water-{actual:03}.wtr').read_bytes())
  _,nv,nt=struct.unpack_from('<4sII',raw)
  pos=np.frombuffer(raw,dtype='<f4',count=nv*3,offset=12).reshape((-1,3))
  normal=np.frombuffer(raw,dtype='<f4',count=nv*3,offset=12+nv*12).reshape((-1,3))
  index=np.frombuffer(raw,dtype='<u4',count=nt*3,offset=12+nv*24).reshape((-1,3))
  chosen=(pos[:,0]>.49)&(pos[:,0]<1.50)&(abs(pos[:,2]+176/130)<.18)
  tris=index[chosen[index].all(axis=1)]
  ids,inv=np.unique(tris,return_inverse=True)
  p=pos[ids].copy();p[:,0]=(p[:,0]-.995)*1.04;p[:,2]+=176/130
  # Mantaflow was simulated at the original pipe elevation.
  n=normal[ids].copy()
  packed=struct.pack('<II',len(p),len(tris))+p.astype('<f4').tobytes()+n.astype('<f4').tobytes()+inv.astype('<u2').tobytes()
  frames.append(base64.b64encode(packed).decode())
  print('WATER',actual,len(p),len(tris))
 payload={'method':'Reusable Mantaflow mesh samples, route deformation and game-state front clipping; not realtime fluid physics','fps':12,'frames':frames}
 (OUT/'fidelity-water.js').write_text('var PUMP_LIQUID='+json.dumps(payload,separators=(',',':'))+';\n')
 (art/'water-provenance.json').write_text(json.dumps({'source':str(source),'frames':list(range(57,104,3)),'method':payload['method']},indent=2))

if __name__=='__main__':
 if '--water' in sys.argv:liquid(Path(sys.argv[-1]))
 else:glb()
